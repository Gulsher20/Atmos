<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import type { DailyForecast, ProviderSource } from '@weather/shared-types'
import { getConditionMeta } from '@weather/weather-core'
import WeatherIcon from '@/components/ui/WeatherIcon.vue'
import ConditionOdds from './ConditionOdds.vue'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ daily: DailyForecast[]; sources: ProviderSource[]; timezone: string }>()
const f = useFormat()
const open = ref<string | null>(null)

const span = computed(() => {
  const values = props.daily
    .flatMap((d) => [d.tempMin, d.tempMax, ...Object.values(d.providerTempMax ?? {})])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: 0, max: 1 }
})
const clamp = (v: number) => Math.min(100, Math.max(0, v))
const pct = (v: number) => clamp(((v - span.value.min) / Math.max(1, span.value.max - span.value.min)) * 100)
const rangeStyle = (d: DailyForecast, i: number) => {
  const left = Math.min(pct(d.tempMin), 96)
  return { left: `${left}%`, width: `${Math.min(100 - left, Math.max(4, pct(d.tempMax) - left))}%`, animationDelay: `${i * 60}ms` }
}
const name = (id: string) => props.sources.find((s) => s.id === id)?.name ?? id
</script>

<template>
  <section class="b-card bg-paper" aria-labelledby="daily-title">
    <h2 id="daily-title" class="b-section-title border-b-3 border-ink p-4 sm:p-5">7-day outlook</h2>
    <p v-if="!daily.length" class="p-5 font-mono text-sm">
      No daily forecast is available right now. Every forecast source failed or returned no data, so try refreshing in a minute.
    </p>
    <ul v-else>
      <li v-for="(d, i) in daily" :key="d.date" class="border-b-3 border-ink last:border-b-0">
        <button
          type="button"
          class="grid w-full grid-cols-[92px_44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sun sm:grid-cols-[130px_48px_70px_1fr_auto] sm:px-5"
          :class="open === d.date ? 'bg-sun' : ''"
          :aria-expanded="open === d.date"
          @click="open = open === d.date ? null : d.date"
        >
          <span class="min-w-0">
            <span class="b-title block truncate text-lg sm:text-2xl">{{ f.dayLabel(d.date, i) }}</span>
            <span class="font-mono text-[10px] font-bold uppercase">{{ f.shortDate(d.date) }}</span>
          </span>
          <span class="b-icon-box h-11 w-11 bg-white"><WeatherIcon :condition="d.condition" :size="24" /></span>
          <span class="hidden font-mono text-xs font-bold sm:block">☂ {{ d.precipitationProbability }}%</span>
          <span class="flex items-center gap-2">
            <span class="w-9 text-right font-mono text-sm font-bold">{{ f.temp(d.tempMin) }}</span>
            <span class="relative h-4 min-w-0 flex-1 overflow-hidden border-2 border-ink bg-white">
              <span
                class="absolute inset-y-0 origin-left animate-grow border-x-2 border-ink bg-gradient-to-r from-sky via-sun to-flame"
                :style="rangeStyle(d, i)"
              />
            </span>
            <span class="w-9 font-mono text-sm font-bold">{{ f.temp(d.tempMax) }}</span>
          </span>
          <ChevronDown :size="20" :stroke-width="3" class="transition-transform" :class="open === d.date ? 'rotate-180' : ''" />
        </button>

        <Transition name="expand">
          <div v-if="open === d.date" class="grid gap-5 border-t-3 border-ink bg-white p-4 sm:p-5 md:grid-cols-2">
            <div>
              <p class="b-label mb-2">Most likely: {{ getConditionMeta(d.condition).label }}</p>
              <ConditionOdds :odds="d.mostLikely" />
              <dl class="mt-4 grid grid-cols-2 gap-2 font-mono text-xs">
                <div><dt class="opacity-60">Rain</dt><dd class="font-bold">{{ f.precip(d.precipitationSum) }} · {{ d.precipitationProbability }}%</dd></div>
                <div><dt class="opacity-60">Wind max</dt><dd class="font-bold">{{ f.wind(d.windSpeedMax) }}{{ d.windGustMax ? ` (gust ${f.wind(d.windGustMax)})` : '' }}</dd></div>
                <div><dt class="opacity-60">UV max</dt><dd class="font-bold">{{ Math.round(d.uvIndexMax) }}</dd></div>
                <div><dt class="opacity-60">Humidity</dt><dd class="font-bold">{{ Math.round(d.humidityMean) }}%</dd></div>
                <div><dt class="opacity-60">Sunshine</dt><dd class="font-bold">{{ d.sunshineHours === null ? '—' : `${d.sunshineHours.toFixed(1)} h` }}</dd></div>
                <div><dt class="opacity-60">Sun</dt><dd class="font-bold">{{ f.clock(d.sunrise, timezone) }} – {{ f.clock(d.sunset, timezone) }}</dd></div>
              </dl>
            </div>
            <div>
              <p class="b-label mb-2">Each source's high · {{ d.confidenceLabel }} confidence ({{ d.confidence }}%)</p>
              <ul class="space-y-1.5">
                <li v-for="(value, id) in d.providerTempMax" :key="id" class="flex items-center gap-2 font-mono text-xs">
                  <span class="w-24 shrink-0 truncate font-bold">{{ name(String(id)) }}</span>
                  <span class="relative h-3 min-w-0 flex-1 overflow-hidden border-2 border-ink bg-paper">
                    <span class="absolute inset-y-0 left-0 origin-left animate-grow bg-flame" :style="{ width: `${Math.max(3, pct(value))}%` }" />
                  </span>
                  <span class="w-10 text-right font-bold">{{ f.temp(value) }}</span>
                </li>
              </ul>
              <p class="mt-3 text-sm">Shorter bars spread = sources agree. A wide spread lowers confidence.</p>
            </div>
          </div>
        </Transition>
      </li>
    </ul>
  </section>
</template>
