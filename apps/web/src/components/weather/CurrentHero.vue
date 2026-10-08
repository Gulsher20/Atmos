<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { RefreshCw } from 'lucide-vue-next'
import type { Dashboard, WeatherLocation } from '@weather/shared-types'
import { getConditionMeta } from '@weather/weather-core'
import WeatherIcon from '@/components/ui/WeatherIcon.vue'
import { useCountUp } from '@/composables/useCountUp'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ dashboard: Dashboard; location: WeatherLocation; savedAt: number | null; loading: boolean; offline: boolean }>()
const emit = defineEmits<{ refresh: [] }>()

const f = useFormat()
const now = useNow({ interval: 30_000 })
const current = computed(() => props.dashboard.current)
const today = computed(() => props.dashboard.daily[0])
const meta = computed(() => getConditionMeta(current.value.condition))
const tz = computed(() => props.dashboard.location.timezone)
const tempTarget = computed(() => f.tempValue(current.value.temperature))
const temp = useCountUp(tempTarget)
const localTime = computed(() => f.clock(now.value.toISOString(), tz.value))
const updated = computed(() => f.ago(props.savedAt, now.value.getTime()))

const confidenceTone = computed(() => {
  const label = today.value?.confidenceLabel
  return label === 'High' ? 'bg-mint' : label === 'Moderate' ? 'bg-sun' : 'bg-flame'
})
</script>

<template>
  <section class="b-card overflow-hidden bg-sun" aria-labelledby="hero-title">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b-3 border-ink bg-ink px-4 py-2 text-paper">
      <span class="b-label">{{ location.region ? `${location.region}, ` : '' }}{{ location.country ?? `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}` }}</span>
      <span class="b-label text-sun">Local time {{ localTime }}</span>
    </div>

    <div class="grid gap-6 p-5 sm:p-7 grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div class="min-w-0">
        <h1 id="hero-title" class="b-title break-words text-6xl sm:text-7xl lg:text-8xl">{{ location.name }}</h1>
        <div class="mt-4 flex items-end gap-4">
          <span class="b-title text-[7rem] leading-[0.8] sm:text-[9rem]" aria-live="polite">{{ temp }}°</span>
          <div class="pb-2">
            <p class="b-title text-3xl">{{ meta.label }}</p>
            <p class="font-mono text-xs font-bold uppercase">Feels like {{ f.temp(current.feelsLike) }}{{ f.tempUnit().slice(1) }}</p>
            <p v-if="today" class="font-mono text-xs font-bold uppercase">H {{ f.temp(today.tempMax) }} · L {{ f.temp(today.tempMin) }}</p>
          </div>
        </div>
      </div>

      <div class="flex flex-col items-start justify-between gap-4 md:items-end">
        <div class="b-icon-box h-28 w-28 rotate-3 bg-paper shadow-brutal transition-transform duration-300 hover:-rotate-6 hover:scale-105 sm:h-36 sm:w-36">
          <WeatherIcon :condition="current.condition" :is-day="current.isDay" :size="76" :stroke-width="2.25" />
        </div>
        <div class="flex flex-wrap gap-2 md:justify-end">
          <span v-if="today" class="b-chip" :class="confidenceTone">{{ today.confidenceLabel }} confidence · {{ today.confidence }}%</span>
          <span class="b-chip bg-paper">{{ dashboard.sources.filter((s) => s.status === 'ok').length }}/{{ dashboard.sources.length }} sources</span>
          <span v-if="offline" class="b-chip bg-flame">Offline copy</span>
          <span v-else-if="dashboard.meta.stale" class="b-chip bg-flame">Stale data</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-mono text-[11px] font-bold uppercase">Updated {{ updated }}</span>
          <button type="button" class="b-btn bg-paper px-3" :disabled="loading" aria-label="Refresh forecast" @click="emit('refresh')">
            <RefreshCw :size="16" :stroke-width="3" :class="loading ? 'animate-spin' : ''" /> Refresh
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
