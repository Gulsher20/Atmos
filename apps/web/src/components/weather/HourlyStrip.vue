<script setup lang="ts">
import { computed, ref } from 'vue'
import type { HourlyForecast } from '@weather/shared-types'
import WeatherIcon from '@/components/ui/WeatherIcon.vue'
import BrutalChart from '@/components/ui/BrutalChart.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ hourly: HourlyForecast[]; timezone: string }>()
const f = useFormat()
const view = ref<'cards' | 'chart'>('cards')
const scroller = ref<HTMLElement | null>(null)

let dragging = false
let startX = 0
let startScroll = 0
function down(e: PointerEvent) {
  if (e.pointerType !== 'mouse' || !scroller.value) return
  dragging = true
  startX = e.clientX
  startScroll = scroller.value.scrollLeft
}
function move(e: PointerEvent) {
  if (dragging && scroller.value) scroller.value.scrollLeft = startScroll - (e.clientX - startX)
}
function up() {
  dragging = false
}

const next24 = computed(() => props.hourly.slice(0, 24))
const chartLabels = computed(() => next24.value.map((h) => f.hour(h.time, props.timezone)))
const chartSeries = computed(() => [
  { name: 'Temperature', color: '#FF5A1F', values: next24.value.map((h) => f.tempValue(h.temperature)) },
  { name: 'Feels like', color: '#A77BFF', values: next24.value.map((h) => f.tempValue(h.feelsLike)), dashed: true },
])
</script>

<template>
  <section class="b-card bg-paper p-4 sm:p-5" aria-labelledby="hourly-title">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 id="hourly-title" class="b-section-title">Next 48 hours</h2>
      <SegmentedControl v-model="view" label="Hourly view" :options="[{ value: 'cards', label: 'Cards' }, { value: 'chart', label: 'Chart' }]" />
    </div>

    <p v-if="!hourly.length" class="border-3 border-dashed border-ink p-4 font-mono text-sm">
      No hourly forecast is available right now. The forecast sources didn't return hourly data for this place.
    </p>
    <div
      v-else-if="view === 'cards'"
      ref="scroller"
      class="no-scrollbar -mx-1 flex cursor-grab snap-x gap-3 overflow-x-auto px-1 pb-3 active:cursor-grabbing"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointerleave="up"
    >
      <article
        v-for="(h, i) in hourly"
        :key="h.time"
        class="flex w-[88px] shrink-0 snap-start flex-col items-center gap-1.5 border-3 border-ink p-2.5 shadow-brutal-sm transition-transform hover:-translate-y-1"
        :class="i === 0 ? 'bg-ink text-sun' : h.precipitationProbability >= 60 ? 'bg-sky' : h.isDay ? 'bg-white' : 'bg-smoke'"
      >
        <span class="b-label">{{ i === 0 ? 'Now' : f.hour(h.time, timezone) }}</span>
        <WeatherIcon :condition="h.condition" :is-day="h.isDay" :size="30" />
        <span class="b-title text-2xl">{{ f.temp(h.temperature) }}</span>
        <span class="font-mono text-[10px] font-bold">☂ {{ h.precipitationProbability }}%</span>
        <span class="font-mono text-[10px] font-bold">{{ f.wind(h.windSpeed) }}</span>
        <span v-if="h.temperatureRange" class="font-mono text-[9px] opacity-70" :title="`${h.providerCount} models disagree by this much`">
          ±{{ Math.max(1, f.tempDelta((h.temperatureRange[1] - h.temperatureRange[0]) / 2)) }}°
        </span>
      </article>
    </div>

    <BrutalChart
      v-else
      :labels="chartLabels"
      :series="chartSeries"
      :format="(v) => `${Math.round(v)}°`"
      :summary="`Temperature over the next 24 hours ranges from ${Math.min(...chartSeries[0]!.values)} to ${Math.max(...chartSeries[0]!.values)} degrees.`"
    />
  </section>
</template>
