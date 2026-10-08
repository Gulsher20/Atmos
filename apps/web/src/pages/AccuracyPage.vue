<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Trophy } from 'lucide-vue-next'
import type { AccuracyMetric, AccuracyReport, ProviderStatusInfo } from '@weather/shared-types'
import BrutalChart, { type ChartSeries } from '@/components/ui/BrutalChart.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ScoreBar from '@/components/ui/ScoreBar.vue'
import { useFormat } from '@/composables/useFormat'
import { weatherApi } from '@/services/api/weather.api'
import { useLocationStore } from '@/stores/location.store'

const store = useLocationStore()
const { locations } = storeToRefs(store)
const f = useFormat()

const locationId = ref(store.active?.id ?? '')
const metric = ref<AccuracyMetric>('temperature')
const horizon = ref(24)
const report = ref<AccuracyReport | null>(null)
const providers = ref<ProviderStatusInfo[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const location = computed(() => locations.value.find((l) => l.id === locationId.value) ?? store.active)
const COLORS = ['#FF5A1F', '#7CC6FE', '#3DDC97', '#A77BFF', '#FFD400', '#0E0E0E']
const medal = ['bg-sun', 'bg-smoke', 'bg-flame']

let seq = 0
async function load() {
  const l = location.value
  if (!l) return
  const id = ++seq
  loading.value = true
  error.value = null
  try {
    const r = await weatherApi.accuracy(l.latitude, l.longitude, metric.value, horizon.value)
    if (id === seq) report.value = r
  } catch (e) {
    if (id === seq) error.value = e instanceof Error ? e.message : 'Accuracy data unavailable'
  } finally {
    if (id === seq) loading.value = false
  }
}

watch([locationId, metric, horizon], load, { immediate: true })
onMounted(async () => {
  providers.value = await weatherApi.providers().catch(() => [])
})

const unit = computed(() => (metric.value === 'temperature' ? '°C' : metric.value === 'wind' ? 'km/h' : 'mm'))
const rows = computed(() => [...(report.value?.rows ?? [])].sort((a, b) => a.mae - b.mae))

const chart = computed(() => {
  const c = report.value?.comparison
  if (!c) return null
  const step = Math.max(1, Math.ceil(c.times.length / 120))
  const pick = <T,>(arr: T[]) => arr.filter((_, i) => i % step === 0)
  const names = new Map(report.value!.ranking.map((r) => [r.providerId, r.providerName]))
  const series: ChartSeries[] = [
    { name: 'Actual', color: '#0E0E0E', values: pick(c.actual) },
    ...Object.entries(c.predicted).map(([id, values], i) => ({ name: names.get(id) ?? id, color: COLORS[i % COLORS.length]!, values: pick(values), dashed: true })),
  ]
  return { labels: pick(c.times).map((t) => `${f.shortDate(t.slice(0, 10))} ${t.slice(11, 13)}h`), series }
})
const statusBg: Record<string, string> = { online: 'bg-mint', degraded: 'bg-sun', offline: 'bg-flame', unknown: 'bg-smoke' }
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="b-label inline-block border-3 border-ink bg-ink px-2 py-1 text-sun">Who called it right?</p>
        <h1 class="b-title mt-2 w-fit border-3 border-ink bg-paper px-4 pb-1 pt-3 text-6xl shadow-brutal sm:text-7xl">Accuracy</h1>
      </div>
      <div class="b-card w-full bg-paper p-3 sm:w-64">
        <label for="acc-loc" class="b-label mb-1 block">Place</label>
        <select id="acc-loc" v-model="locationId" class="b-input">
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
      </div>
    </header>

    <div class="b-card flex flex-wrap items-center gap-4 bg-paper p-4">
      <SegmentedControl v-model="metric" label="Metric" :options="[{ value: 'temperature', label: 'Temperature' }, { value: 'precipitation', label: 'Rain' }, { value: 'wind', label: 'Wind' }]" />
      <SegmentedControl
        v-model="horizon"
        label="Forecast lead time"
        :options="[{ value: 6, label: '6h' }, { value: 12, label: '12h' }, { value: 24, label: '24h' }, { value: 48, label: '48h' }, { value: 72, label: '72h' }]"
      />
      <span class="font-mono text-[11px] font-bold uppercase">Forecast made {{ horizon }}h before it happened</span>
    </div>

    <EmptyState v-if="error && !report" title="No accuracy data" :message="error" tone="flame">
      <button type="button" class="b-btn b-btn-ink" @click="load">Try again</button>
    </EmptyState>
    <template v-else-if="report">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]" :class="loading ? 'opacity-60' : ''">
        <section class="b-card bg-sun" aria-labelledby="rank-title">
          <h2 id="rank-title" class="b-section-title border-b-3 border-ink p-4"><Trophy :size="28" :stroke-width="3" /> Ranking</h2>
          <ol class="stagger divide-y-3 divide-ink">
            <li v-for="(r, i) in report.ranking" :key="r.providerId" class="flex items-center gap-3 bg-paper p-4" :style="{ '--i': i }">
              <span class="b-icon-box b-title h-12 w-12 text-3xl" :class="medal[i] ?? 'bg-white'">{{ i + 1 }}</span>
              <div class="flex-1">
                <div class="flex items-baseline justify-between">
                  <p class="b-title text-2xl">{{ r.providerName }}</p>
                  <p class="b-title text-3xl">{{ Math.round(r.score) }}</p>
                </div>
                <ScoreBar :score="r.score" :label="`${r.providerName} accuracy score`" />
                <p class="mt-1 font-mono text-[10px] font-bold uppercase">Blend weight {{ Math.round(r.weight * 100) }}%</p>
              </div>
            </li>
            <li v-if="!report.ranking.length" class="bg-paper p-4">Not enough data yet — check back after the first backtest finishes.</li>
          </ol>
        </section>

        <section class="b-card bg-paper p-4 sm:p-5" aria-labelledby="pva-title">
          <h2 id="pva-title" class="b-section-title mb-3">Predicted vs actual</h2>
          <BrutalChart
            v-if="chart"
            :key="`${metric}-${horizon}-${locationId}`"
            :labels="chart.labels"
            :series="chart.series"
            :format="(v) => `${Math.round(v * 10) / 10}`"
            :height="280"
            :summary="`Predicted versus observed ${metric} for each source at ${horizon} hour lead time.`"
          />
          <p v-else class="py-10 text-center">No comparison series for this lead time yet.</p>
          <p class="mt-2 font-mono text-[10px] font-bold uppercase">{{ report.periodStart }} → {{ report.periodEnd }} · units {{ unit }}</p>
        </section>
      </div>

      <section class="b-card overflow-x-auto bg-paper" aria-labelledby="err-title">
        <h2 id="err-title" class="b-section-title border-b-3 border-ink p-4">Error table</h2>
        <table class="w-full min-w-[620px] text-left">
          <thead class="border-b-3 border-ink bg-ink text-paper">
            <tr>
              <th class="b-label p-3">Source</th>
              <th class="b-label p-3">Test</th>
              <th class="b-label p-3">MAE</th>
              <th class="b-label p-3">RMSE</th>
              <th class="b-label p-3">Bias</th>
              <th class="b-label p-3">Samples</th>
              <th class="b-label p-3">Score</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="`${r.providerId}-${r.source}`" class="border-b-2 border-ink last:border-b-0" :class="i === 0 ? 'bg-mint/40' : ''">
              <td class="b-title p-3 text-xl">{{ r.providerName }}</td>
              <td class="p-3"><span class="b-chip" :class="r.source === 'live' ? 'bg-sky' : 'bg-white'">{{ r.source }}</span></td>
              <td class="p-3 font-mono text-sm font-bold">{{ r.mae.toFixed(2) }} {{ unit }}</td>
              <td class="p-3 font-mono text-sm">{{ r.rmse.toFixed(2) }}</td>
              <td class="p-3 font-mono text-sm">{{ r.bias > 0 ? '+' : '' }}{{ r.bias.toFixed(2) }}</td>
              <td class="p-3 font-mono text-sm">{{ r.samples }}</td>
              <td class="w-40 p-3"><ScoreBar :score="r.score" :label="`${r.providerName} score`" thin /></td>
            </tr>
            <tr v-if="!rows.length"><td colspan="7" class="p-4">No rows for this metric and lead time yet.</td></tr>
          </tbody>
        </table>
      </section>

      <section class="b-card bg-ink p-5 text-paper">
        <p class="b-label mb-2 text-sun">How this is measured · {{ report.liveSamples }} live samples</p>
        <ul class="space-y-1 text-sm">
          <li v-for="n in report.notes" :key="n">→ {{ n }}</li>
        </ul>
      </section>
    </template>
    <SkeletonBlock v-else height="24rem" />

    <section v-if="providers.length" class="b-card overflow-x-auto bg-paper" aria-labelledby="status-title">
      <h2 id="status-title" class="b-section-title border-b-3 border-ink p-4">Provider health</h2>
      <table class="w-full min-w-[560px] text-left">
        <thead class="border-b-3 border-ink bg-ink text-paper">
          <tr>
            <th class="b-label p-3">Provider</th>
            <th class="b-label p-3">Status</th>
            <th class="b-label p-3">Avg response</th>
            <th class="b-label p-3">Error rate</th>
            <th class="b-label p-3">Requests</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in providers" :key="p.id" class="border-b-2 border-ink last:border-b-0">
            <td class="p-3 font-bold">{{ p.name }}</td>
            <td class="p-3"><span class="b-chip" :class="statusBg[p.status]">{{ p.status }}{{ p.rateLimited ? ' · limited' : '' }}</span></td>
            <td class="p-3 font-mono text-sm">{{ p.avgResponseMs === null ? '—' : `${Math.round(p.avgResponseMs)} ms` }}</td>
            <td class="p-3 font-mono text-sm">{{ p.errorRate === null ? '—' : `${Math.round(p.errorRate * 100)}%` }}</td>
            <td class="p-3 font-mono text-sm">{{ p.requests }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
