<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { HistoryRange, HistoryReport, HistorySummary } from '@weather/shared-types'
import BrutalChart, { type ChartSeries } from '@/components/ui/BrutalChart.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useFormat } from '@/composables/useFormat'
import { weatherApi } from '@/services/api/weather.api'
import { useLocationStore } from '@/stores/location.store'

type Metric = 'temperature' | 'rain' | 'sunshine' | 'wind' | 'humidity'

const store = useLocationStore()
const { locations } = storeToRefs(store)
const f = useFormat()

const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysAgo = (n: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return iso(d)
}
const today = iso(new Date())

const locationId = ref(store.active?.id ?? '')
const range = ref<HistoryRange>('30d')
const metric = ref<Metric>('temperature')
const customStart = ref(daysAgo(14))
const customEnd = ref(today)
const report = ref<HistoryReport | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const location = computed(() => locations.value.find((l) => l.id === locationId.value) ?? store.active)
const PRESET_DAYS: Record<Exclude<HistoryRange, 'custom'>, number> = { '7d': 6, '30d': 29, '3m': 89, '1y': 364 }

const window_ = computed(() => (range.value === 'custom' ? { start: customStart.value, end: customEnd.value } : { start: daysAgo(PRESET_DAYS[range.value]), end: today }))
const customError = computed(() => {
  if (range.value !== 'custom') return null
  const { start, end } = window_.value
  if (!start || !end) return 'Pick both dates'
  if (start > end) return 'Start must be before end'
  if (end > today) return 'End date cannot be in the future'
  if ((Date.parse(end) - Date.parse(start)) / 86_400_000 > 365) return 'Maximum range is one year'
  if (start < '1940-01-01') return 'Records start in 1940'
  return null
})

let seq = 0
async function load() {
  const l = location.value
  if (!l || customError.value) return
  const id = ++seq
  loading.value = true
  error.value = null
  try {
    const result = await weatherApi.history(l.latitude, l.longitude, window_.value.start, window_.value.end)
    if (id === seq) report.value = result
  } catch (e) {
    if (id === seq) error.value = e instanceof Error ? e.message : 'History unavailable'
  } finally {
    if (id === seq) loading.value = false
  }
}

watch([locationId, window_], load, { immediate: true, deep: true })

const labels = computed(() => report.value?.days.map((d) => f.shortDate(d.date)) ?? [])
const series = computed<ChartSeries[]>(() => {
  const days = report.value?.days ?? []
  const t = (v: number | null) => (v === null ? null : f.tempValue(v))
  switch (metric.value) {
    case 'rain':
      return [
        { name: 'Precipitation', color: '#7CC6FE', values: days.map((d) => d.precipitation), bars: true },
        ...(days.some((d) => (d.snowfall ?? 0) > 0) ? [{ name: 'Snowfall (cm)', color: '#FFFFFF', values: days.map((d) => d.snowfall), bars: true }] : []),
      ]
    case 'sunshine':
      return [{ name: 'Sunshine hours', color: '#FFD400', values: days.map((d) => d.sunshineHours), bars: true }]
    case 'wind':
      return [
        { name: 'Max wind', color: '#3DDC97', values: days.map((d) => d.windMax) },
        { name: 'Max gust', color: '#A77BFF', values: days.map((d) => d.gustMax), dashed: true },
      ]
    case 'humidity':
      return [
        { name: 'Humidity', color: '#7CC6FE', values: days.map((d) => d.humidity) },
        { name: 'Cloud cover', color: '#D9D4C5', values: days.map((d) => d.cloudCover), dashed: true },
      ]
    default:
      return [
        { name: 'High', color: '#FF5A1F', values: days.map((d) => t(d.tempMax)) },
        { name: 'Mean', color: '#FFD400', values: days.map((d) => t(d.tempMean)) },
        { name: 'Low', color: '#7CC6FE', values: days.map((d) => t(d.tempMin)) },
      ]
  }
})

const formatter = computed(() => {
  switch (metric.value) {
    case 'rain':
      return (v: number) => f.precip(v)
    case 'sunshine':
      return (v: number) => `${v.toFixed(1)}h`
    case 'wind':
      return (v: number) => f.wind(v)
    case 'humidity':
      return (v: number) => `${Math.round(v)}%`
    default:
      return (v: number) => `${Math.round(v)}°`
  }
})

function delta(key: keyof HistorySummary, s: HistorySummary, p: HistorySummary | null) {
  const now = s[key]
  const before = p?.[key]
  if (now === null || before === null || before === undefined) return null
  return now - before
}

const tiles = computed(() => {
  const r = report.value
  if (!r) return []
  const s = r.summary
  const p = r.previous
  return [
    { label: 'Avg temp', value: f.temp(s.avgTemp), d: delta('avgTemp', s, p), fmt: (x: number) => `${Math.abs(f.tempDelta(x))}°`, bg: 'bg-flame' },
    { label: 'Total rain', value: f.precip(s.totalPrecipitation), d: delta('totalPrecipitation', s, p), fmt: (x: number) => f.precip(Math.abs(x)), bg: 'bg-sky' },
    { label: 'Rainy days', value: `${s.rainyDays}`, d: delta('rainyDays', s, p), fmt: (x: number) => `${Math.abs(x)}`, bg: 'bg-paper' },
    { label: 'Sunshine', value: s.sunshineHours === null ? '—' : `${Math.round(s.sunshineHours)} h`, d: delta('sunshineHours', s, p), fmt: (x: number) => `${Math.abs(Math.round(x))} h`, bg: 'bg-sun' },
    { label: 'Avg max wind', value: f.wind(s.avgWind), d: delta('avgWind', s, p), fmt: (x: number) => f.wind(Math.abs(x)), bg: 'bg-mint' },
  ]
})

const chartSummary = computed(() => `${metric.value} history for ${location.value?.name ?? 'location'} from ${window_.value.start} to ${window_.value.end}.`)
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="b-label inline-block border-3 border-ink bg-ink px-2 py-1 text-sun">What actually happened</p>
        <h1 class="b-title mt-2 w-fit border-3 border-ink bg-paper px-4 pb-1 pt-3 text-6xl shadow-brutal sm:text-7xl">History</h1>
      </div>
      <div class="b-card w-full bg-paper p-3 sm:w-64">
        <label for="hist-loc" class="b-label mb-1 block">Place</label>
        <select id="hist-loc" v-model="locationId" class="b-input">
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
      </div>
    </header>

    <div class="b-card flex flex-wrap items-end gap-4 bg-paper p-4">
      <SegmentedControl
        v-model="range"
        label="Range"
        :options="[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: '3m', label: '3 months' }, { value: '1y', label: '1 year' }, { value: 'custom', label: 'Custom' }]"
      />
      <template v-if="range === 'custom'">
        <div>
          <label for="h-start" class="b-label mb-1 block">From</label>
          <input id="h-start" v-model="customStart" type="date" min="1940-01-01" :max="today" class="b-input py-1.5" />
        </div>
        <div>
          <label for="h-end" class="b-label mb-1 block">To</label>
          <input id="h-end" v-model="customEnd" type="date" min="1940-01-01" :max="today" class="b-input py-1.5" />
        </div>
        <p v-if="customError" class="font-mono text-xs font-bold uppercase text-flame">{{ customError }}</p>
      </template>
    </div>

    <EmptyState v-if="!location" title="No place selected" message="Save a place first." tone="sun" />
    <EmptyState v-else-if="error && !report" title="History unavailable" :message="error" tone="flame">
      <button type="button" class="b-btn b-btn-ink" @click="load">Try again</button>
    </EmptyState>
    <template v-else-if="report">
      <ul class="stagger grid grid-cols-2 gap-4 md:grid-cols-5" :class="loading ? 'opacity-60' : ''">
        <li v-for="(t, i) in tiles" :key="t.label" class="b-card b-card-hover p-4" :class="t.bg" :style="{ '--i': i }">
          <p class="b-label">{{ t.label }}</p>
          <p class="b-title mt-2 text-4xl">{{ t.value }}</p>
          <p v-if="t.d !== null && Math.abs(t.d) > 0.05" class="font-mono text-[10px] font-bold uppercase">
            {{ t.d > 0 ? '▲' : '▼' }} {{ t.fmt(t.d) }} vs previous
          </p>
        </li>
      </ul>

      <section class="b-card bg-paper p-4 sm:p-5" :aria-busy="loading">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="b-section-title">Patterns</h2>
          <SegmentedControl
            v-model="metric"
            label="Metric"
            :options="[{ value: 'temperature', label: 'Temp' }, { value: 'rain', label: 'Rain' }, { value: 'sunshine', label: 'Sun' }, { value: 'wind', label: 'Wind' }, { value: 'humidity', label: 'Humidity' }]"
          />
        </div>
        <BrutalChart :key="`${metric}-${report.start}-${report.end}`" :labels="labels" :series="series" :format="formatter" :summary="chartSummary" :height="260" />
      </section>

      <section class="b-card bg-ink p-5 text-paper">
        <h2 class="b-section-title mb-3 text-sun">Insights</h2>
        <ul class="stagger grid gap-2 md:grid-cols-2">
          <li v-for="(line, i) in report.insights" :key="line" class="border-2 border-paper/40 p-3" :style="{ '--i': i }">■ {{ line }}</li>
        </ul>
        <p class="mt-4 font-mono text-[10px] uppercase text-paper/60">Source: ERA5 reanalysis (older than ~5 days) + Open-Meteo recent analysis.</p>
      </section>
    </template>
    <SkeletonBlock v-else height="24rem" />
  </div>
</template>
