<script setup lang="ts">
import { computed } from 'vue'
import type { AirQuality } from '@weather/shared-types'
import { getAqiMeta } from '@weather/weather-core'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ air: AirQuality | null }>()
const f = useFormat()
const meta = computed(() => (props.air ? getAqiMeta(props.air.aqi) : null))
const angle = computed(() => (props.air ? Math.min(300, props.air.aqi) / 300 : 0) * 180 - 90)
const pollutants = computed(() => {
  const a = props.air
  if (!a) return []
  return [
    { key: 'PM2.5', value: a.pm25, unit: 'µg/m³' },
    { key: 'PM10', value: a.pm10, unit: 'µg/m³' },
    { key: 'O₃', value: a.o3, unit: 'µg/m³' },
    { key: 'NO₂', value: a.no2, unit: 'µg/m³' },
    { key: 'SO₂', value: a.so2, unit: 'µg/m³' },
    { key: 'CO', value: a.co, unit: 'µg/m³' },
  ]
})
const bandColor = (aqi: number) => (aqi <= 50 ? '#3DDC97' : aqi <= 100 ? '#FFD400' : aqi <= 150 ? '#FF9F1C' : aqi <= 200 ? '#FF5A1F' : '#A77BFF')
</script>

<template>
  <section class="b-card bg-paper" aria-labelledby="aqi-title">
    <h2 id="aqi-title" class="b-section-title border-b-3 border-ink p-4 sm:p-5">Air quality</h2>
    <div v-if="air && meta" class="grid gap-5 p-4 sm:p-5">
      <div class="flex items-center gap-5">
        <svg viewBox="0 0 120 70" class="w-36 shrink-0" role="img" :aria-label="`US AQI ${air.aqi}, ${meta.label}`">
          <path d="M10 62 A50 50 0 0 1 30 22" stroke="#3DDC97" stroke-width="14" fill="none" />
          <path d="M30 22 A50 50 0 0 1 60 12" stroke="#FFD400" stroke-width="14" fill="none" />
          <path d="M60 12 A50 50 0 0 1 90 22" stroke="#FF9F1C" stroke-width="14" fill="none" />
          <path d="M90 22 A50 50 0 0 1 110 62" stroke="#FF5A1F" stroke-width="14" fill="none" />
          <path d="M10 62 A50 50 0 0 1 110 62" stroke="#0E0E0E" stroke-width="3" fill="none" />
          <g :style="{ transform: `rotate(${angle}deg)`, transformOrigin: '60px 62px', transition: 'transform 1s cubic-bezier(.3,1.4,.5,1)' }">
            <rect x="57" y="18" width="6" height="46" fill="#0E0E0E" />
          </g>
          <circle cx="60" cy="62" r="7" fill="#0E0E0E" />
        </svg>
        <div>
          <p class="b-title text-6xl">{{ air.aqi }}</p>
          <p class="b-chip mt-1" :style="{ background: bandColor(air.aqi) }">{{ meta.label }}</p>
        </div>
      </div>
      <p class="text-base leading-snug">{{ meta.healthAdvice }}</p>
      <ul class="grid grid-cols-3 gap-2">
        <li v-for="p in pollutants" :key="p.key" class="border-2 border-ink bg-white p-2">
          <span class="b-label block">{{ p.key }}</span>
          <span class="font-mono text-sm font-bold">{{ p.value === null ? '—' : Math.round(p.value) }}</span>
          <span class="font-mono text-[9px]"> {{ p.unit }}</span>
        </li>
      </ul>
      <div v-if="air.forecast.length">
        <p class="b-label mb-2">Daily max AQI forecast</p>
        <div class="flex items-end gap-2">
          <div v-for="d in air.forecast" :key="d.date" class="flex flex-1 flex-col items-center gap-1">
            <span class="font-mono text-[10px] font-bold">{{ d.aqiMax }}</span>
            <span class="w-full origin-bottom animate-pop border-2 border-ink" :style="{ height: `${Math.max(8, Math.min(90, d.aqiMax / 3))}px`, background: bandColor(d.aqiMax) }" />
            <span class="font-mono text-[10px] font-bold uppercase">{{ f.weekday(d.date) }}</span>
          </div>
        </div>
      </div>
    </div>
    <p v-else class="p-5">Air quality data isn't available for this location right now.</p>
  </section>
</template>
