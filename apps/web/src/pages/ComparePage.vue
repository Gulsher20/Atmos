<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ArrowLeftRight } from 'lucide-vue-next'
import type { HistoryReport, WeatherLocation } from '@weather/shared-types'
import { getAqiMeta, getConditionMeta } from '@weather/weather-core'
import BrutalChart from '@/components/ui/BrutalChart.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import WeatherIcon from '@/components/ui/WeatherIcon.vue'
import { useDashboard } from '@/composables/useDashboard'
import { useFormat } from '@/composables/useFormat'
import { weatherApi } from '@/services/api/weather.api'
import { useLocationStore } from '@/stores/location.store'

const store = useLocationStore()
const { locations } = storeToRefs(store)
const f = useFormat()

const aId = ref(store.active?.id ?? locations.value[0]?.id ?? '')
const bId = ref(locations.value.find((l) => l.id !== aId.value)?.id ?? '')
const tab = ref<'today' | 'week' | 'history'>('today')

const a = computed<WeatherLocation | null>(() => locations.value.find((l) => l.id === aId.value) ?? null)
const b = computed<WeatherLocation | null>(() => locations.value.find((l) => l.id === bId.value) ?? null)
const A = useDashboard(a)
const B = useDashboard(b)

function swap() {
  ;[aId.value, bId.value] = [bId.value, aId.value]
}

const rows = computed(() => {
  const da = A.data.value
  const db = B.data.value
  if (!da || !db) return []
  const ca = da.current
  const cb = db.current
  const ta = da.daily[0]
  const tb = db.daily[0]
  return [
    { label: 'Temperature', a: f.temp(ca.temperature), b: f.temp(cb.temperature), diff: ca.temperature - cb.temperature, higher: 'warmer' },
    { label: 'Feels like', a: f.temp(ca.feelsLike), b: f.temp(cb.feelsLike), diff: ca.feelsLike - cb.feelsLike, higher: 'warmer' },
    { label: 'Humidity', a: `${Math.round(ca.humidity)}%`, b: `${Math.round(cb.humidity)}%`, diff: ca.humidity - cb.humidity, higher: 'more humid' },
    { label: 'Wind', a: f.wind(ca.windSpeed), b: f.wind(cb.windSpeed), diff: ca.windSpeed - cb.windSpeed, higher: 'windier' },
    { label: 'UV', a: `${Math.round(ca.uvIndex)}`, b: `${Math.round(cb.uvIndex)}`, diff: ca.uvIndex - cb.uvIndex, higher: 'sunnier' },
    { label: 'Rain today', a: f.precip(ta?.precipitationSum), b: f.precip(tb?.precipitationSum), diff: (ta?.precipitationSum ?? 0) - (tb?.precipitationSum ?? 0), higher: 'wetter' },
    { label: 'Air quality', a: da.airQuality ? `${da.airQuality.aqi}` : '—', b: db.airQuality ? `${db.airQuality.aqi}` : '—', diff: (da.airQuality?.aqi ?? 0) - (db.airQuality?.aqi ?? 0), higher: 'more polluted' },
  ]
})

const summary = computed(() => {
  const da = A.data.value
  const db = B.data.value
  if (!da || !db || !a.value || !b.value) return []
  const lines: string[] = []
  const dt = da.current.temperature - db.current.temperature
  if (Math.abs(dt) >= 1) lines.push(`${dt > 0 ? a.value.name : b.value.name} is ${Math.abs(f.tempDelta(dt))}° warmer right now.`)
  else lines.push('Both places are about the same temperature right now.')
  const rainA = da.daily.reduce((s, d) => s + d.precipitationSum, 0)
  const rainB = db.daily.reduce((s, d) => s + d.precipitationSum, 0)
  if (Math.abs(rainA - rainB) >= 2) lines.push(`${rainA > rainB ? a.value.name : b.value.name} expects more rain this week (${f.precip(Math.max(rainA, rainB))} vs ${f.precip(Math.min(rainA, rainB))}).`)
  const avgA = da.daily.reduce((s, d) => s + d.tempMax, 0) / da.daily.length
  const avgB = db.daily.reduce((s, d) => s + d.tempMax, 0) / db.daily.length
  if (Math.abs(avgA - avgB) >= 1) lines.push(`Across the week, highs in ${avgA > avgB ? a.value.name : b.value.name} run ${Math.abs(f.tempDelta(avgA - avgB))}° higher on average.`)
  if (da.airQuality && db.airQuality) {
    const better = da.airQuality.aqi <= db.airQuality.aqi ? a.value.name : b.value.name
    lines.push(`Cleaner air in ${better} (${getAqiMeta(Math.min(da.airQuality.aqi, db.airQuality.aqi)).label.toLowerCase()}).`)
  }
  const bestA = da.recommendations.activities.find((x) => x.activity !== 'indoor_activity')
  if (bestA) lines.push(`Best outdoor pick in ${a.value.name}: ${bestA.title.toLowerCase()} (${bestA.score}/100).`)
  return lines
})

const weekLabels = computed(() => (A.data.value?.daily ?? []).map((d) => f.weekday(d.date)))
const weekSeries = computed(() => [
  { name: `${a.value?.name ?? 'A'} high`, color: '#FF5A1F', values: (A.data.value?.daily ?? []).map((d) => f.tempValue(d.tempMax)) },
  { name: `${b.value?.name ?? 'B'} high`, color: '#7CC6FE', values: (B.data.value?.daily ?? []).map((d) => f.tempValue(d.tempMax)) },
])
const weekRain = computed(() => [
  { name: `${a.value?.name ?? 'A'} rain`, color: '#FF5A1F', values: (A.data.value?.daily ?? []).map((d) => d.precipitationSum), bars: true },
  { name: `${b.value?.name ?? 'B'} rain`, color: '#7CC6FE', values: (B.data.value?.daily ?? []).map((d) => d.precipitationSum), bars: true },
])

const history = ref<{ a: HistoryReport; b: HistoryReport } | null>(null)
const historyError = ref<string | null>(null)
const historyLoading = ref(false)

async function loadHistory() {
  if (!a.value || !b.value) return
  historyLoading.value = true
  historyError.value = null
  const end = new Date()
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - 29)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  try {
    const [ha, hb] = await Promise.all([
      weatherApi.history(a.value.latitude, a.value.longitude, iso(start), iso(end)),
      weatherApi.history(b.value.latitude, b.value.longitude, iso(start), iso(end)),
    ])
    history.value = { a: ha, b: hb }
  } catch (e) {
    historyError.value = e instanceof Error ? e.message : 'History unavailable'
  } finally {
    historyLoading.value = false
  }
}

watch([tab, aId, bId], () => {
  if (tab.value === 'history') {
    history.value = null
    void loadHistory()
  }
})

const historyLabels = computed(() => history.value?.a.days.map((d) => f.shortDate(d.date)) ?? [])
const historySeries = computed(() =>
  history.value
    ? [
        { name: `${a.value?.name} mean`, color: '#FF5A1F', values: history.value.a.days.map((d) => (d.tempMean === null ? null : f.tempValue(d.tempMean))) },
        { name: `${b.value?.name} mean`, color: '#7CC6FE', values: history.value.b.days.map((d) => (d.tempMean === null ? null : f.tempValue(d.tempMean))) },
      ]
    : [],
)
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <header>
      <p class="b-label inline-block border-3 border-ink bg-ink px-2 py-1 text-sun">Head to head</p>
      <h1 class="b-title mt-2 w-fit border-3 border-ink bg-paper px-4 pb-1 pt-3 text-6xl shadow-brutal sm:text-7xl">Compare</h1>
    </header>

    <EmptyState v-if="locations.length < 2" title="Need two places" message="Save at least two places to compare them." tone="sun">
      <RouterLink to="/locations" class="b-btn b-btn-ink">Add places</RouterLink>
    </EmptyState>

    <template v-else>
      <div class="b-card grid items-end gap-3 bg-paper p-4 sm:grid-cols-[1fr_auto_1fr] sm:p-5">
        <div>
          <label for="cmp-a" class="b-label mb-1 block">Place A</label>
          <select id="cmp-a" v-model="aId" class="b-input bg-flame/20">
            <option v-for="l in locations" :key="l.id" :value="l.id" :disabled="l.id === bId">{{ l.name }}</option>
          </select>
        </div>
        <button type="button" class="b-btn b-btn-sun h-[46px] transition-transform hover:rotate-180" aria-label="Swap places" @click="swap">
          <ArrowLeftRight :size="18" :stroke-width="3" />
        </button>
        <div>
          <label for="cmp-b" class="b-label mb-1 block">Place B</label>
          <select id="cmp-b" v-model="bId" class="b-input bg-sky/30">
            <option v-for="l in locations" :key="l.id" :value="l.id" :disabled="l.id === aId">{{ l.name }}</option>
          </select>
        </div>
      </div>

      <SegmentedControl
        v-model="tab"
        label="Comparison view"
        :options="[{ value: 'today', label: 'Today' }, { value: 'week', label: '7 days' }, { value: 'history', label: 'Last 30 days' }]"
      />

      <template v-if="A.data.value && B.data.value">
        <div v-if="tab === 'today'" class="grid grid-cols-1 gap-6">
          <div class="grid gap-4 sm:grid-cols-2">
            <div v-for="(side, i) in [{ loc: a, d: A.data.value, bg: 'bg-flame' }, { loc: b, d: B.data.value, bg: 'bg-sky' }]" :key="i" class="b-card p-5" :class="side.bg">
              <p class="b-label">{{ i === 0 ? 'A' : 'B' }} · {{ side.loc?.country }}</p>
              <p class="b-title text-5xl">{{ side.loc?.name }}</p>
              <div class="mt-3 flex items-center gap-4">
                <span class="b-icon-box h-16 w-16 bg-paper"><WeatherIcon :condition="side.d.current.condition" :is-day="side.d.current.isDay" :size="36" /></span>
                <span class="b-title text-7xl">{{ f.temp(side.d.current.temperature) }}</span>
              </div>
              <p class="mt-2 font-mono text-xs font-bold uppercase">{{ getConditionMeta(side.d.current.condition).label }}</p>
            </div>
          </div>

          <div class="b-card overflow-x-auto bg-paper">
            <table class="w-full min-w-[460px] text-left">
              <thead class="border-b-3 border-ink bg-ink text-paper">
                <tr>
                  <th class="b-label p-3">Metric</th>
                  <th class="b-label p-3">{{ a?.name }}</th>
                  <th class="b-label p-3">{{ b?.name }}</th>
                  <th class="b-label p-3">Verdict</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in rows" :key="r.label" class="border-b-2 border-ink last:border-b-0">
                  <td class="p-3 font-mono text-xs font-bold uppercase">{{ r.label }}</td>
                  <td class="b-title p-3 text-2xl" :class="r.diff >= 0.5 ? 'bg-flame/30' : ''">{{ r.a }}</td>
                  <td class="b-title p-3 text-2xl" :class="r.diff <= -0.5 ? 'bg-sky/40' : ''">{{ r.b }}</td>
                  <td class="p-3 text-sm">
                    <template v-if="Math.abs(r.diff) < 0.5">≈ Same</template>
                    <template v-else>{{ r.diff > 0 ? '▲' : '▼' }} {{ (r.diff > 0 ? a : b)?.name }} is {{ r.higher }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-else-if="tab === 'week'" class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="b-card bg-paper p-4 sm:p-5">
            <h2 class="b-section-title mb-3">Daily highs</h2>
            <BrutalChart :labels="weekLabels" :series="weekSeries" :format="(v) => `${Math.round(v)}°`" summary="Daily high temperature for both places over the next week." />
          </div>
          <div class="b-card bg-paper p-4 sm:p-5">
            <h2 class="b-section-title mb-3">Daily rain</h2>
            <BrutalChart :labels="weekLabels" :series="weekRain" :format="(v) => f.precip(v)" summary="Daily rainfall for both places over the next week." zero-based />
          </div>
        </div>

        <div v-else class="grid grid-cols-1 gap-6">
          <SkeletonBlock v-if="historyLoading" height="18rem" />
          <EmptyState v-else-if="historyError" title="History unavailable" :message="historyError" tone="flame" />
          <template v-else-if="history">
            <div class="b-card bg-paper p-4 sm:p-5">
              <h2 class="b-section-title mb-3">Mean temperature</h2>
              <BrutalChart :labels="historyLabels" :series="historySeries" :format="(v) => `${Math.round(v)}°`" summary="Daily mean temperature for both places over the last 30 days." />
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div v-for="(side, i) in [{ loc: a, h: history.a, bg: 'bg-flame' }, { loc: b, h: history.b, bg: 'bg-sky' }]" :key="i" class="b-card p-5" :class="side.bg">
                <p class="b-title text-3xl">{{ side.loc?.name }}</p>
                <dl class="mt-3 grid grid-cols-2 gap-2 font-mono text-xs font-bold uppercase">
                  <div><dt class="opacity-70">Avg temp</dt><dd class="b-title text-2xl">{{ f.temp(side.h.summary.avgTemp) }}</dd></div>
                  <div><dt class="opacity-70">Total rain</dt><dd class="b-title text-2xl">{{ f.precip(side.h.summary.totalPrecipitation) }}</dd></div>
                  <div><dt class="opacity-70">Rainy days</dt><dd class="b-title text-2xl">{{ side.h.summary.rainyDays }}</dd></div>
                  <div><dt class="opacity-70">Sunshine</dt><dd class="b-title text-2xl">{{ side.h.summary.sunshineHours === null ? '—' : `${Math.round(side.h.summary.sunshineHours)} h` }}</dd></div>
                </dl>
              </div>
            </div>
          </template>
        </div>

        <div class="b-card bg-sun p-5">
          <p class="b-label mb-2">The short version</p>
          <ul class="space-y-1 text-lg font-semibold">
            <li v-for="line in summary" :key="line">→ {{ line }}</li>
          </ul>
        </div>
      </template>
      <EmptyState v-else-if="A.error.value || B.error.value" title="Couldn't load" :message="A.error.value ?? B.error.value ?? ''" tone="flame" />
      <SkeletonBlock v-else height="20rem" />
    </template>
  </div>
</template>
