<script setup lang="ts">
import { computed } from 'vue'
import { Droplets, Eye, Gauge, Navigation, Sunrise, Sunset, Umbrella, Wind, SunMedium, Cloud } from 'lucide-vue-next'
import type { Dashboard } from '@weather/shared-types'
import { degreesToCardinal, getAqiMeta } from '@weather/weather-core'
import { useFormat } from '@/composables/useFormat'

const props = defineProps<{ dashboard: Dashboard }>()
const f = useFormat()

const tiles = computed(() => {
  const c = props.dashboard.current
  const today = props.dashboard.daily[0]
  const aqi = props.dashboard.airQuality
  const tz = props.dashboard.location.timezone
  const uvLabel = c.uvIndex >= 8 ? 'Very high' : c.uvIndex >= 6 ? 'High' : c.uvIndex >= 3 ? 'Moderate' : 'Low'
  return [
    { key: 'wind', label: 'Wind', icon: Wind, value: f.wind(c.windSpeed), note: c.windGust ? `Gusts ${f.wind(c.windGust)}` : 'Steady', rotate: c.windDirection, dir: c.windDirection !== null ? degreesToCardinal(c.windDirection) : null, bg: 'bg-sky' },
    { key: 'humidity', label: 'Humidity', icon: Droplets, value: `${Math.round(c.humidity)}%`, note: c.humidity > 75 ? 'Muggy' : c.humidity < 30 ? 'Dry air' : 'Comfortable', bg: 'bg-paper' },
    { key: 'uv', label: 'UV index', icon: SunMedium, value: `${Math.round(c.uvIndex)}`, note: uvLabel, bg: c.uvIndex >= 6 ? 'bg-flame' : 'bg-sun' },
    { key: 'aqi', label: 'Air quality', icon: Gauge, value: aqi ? `${aqi.aqi}` : '—', note: aqi ? getAqiMeta(aqi.aqi).label : 'Unavailable', bg: aqi && aqi.aqi > 100 ? 'bg-flame' : 'bg-mint' },
    { key: 'rain', label: 'Rain today', icon: Umbrella, value: f.precip(today?.precipitationSum ?? c.precipitation), note: `${today?.precipitationProbability ?? 0}% chance`, bg: 'bg-paper' },
    { key: 'cloud', label: 'Cloud cover', icon: Cloud, value: c.cloudCover === null ? '—' : `${Math.round(c.cloudCover)}%`, note: c.pressure ? `${Math.round(c.pressure)} hPa` : '', bg: 'bg-paper' },
    { key: 'vis', label: 'Visibility', icon: Eye, value: c.visibility === null ? '—' : f.distance(c.visibility), note: c.visibility !== null && c.visibility < 2 ? 'Poor' : c.visibility !== null && c.visibility < 10 ? 'Hazy' : 'Good', bg: 'bg-paper' },
    { key: 'sun', label: 'Sun', icon: today?.sunrise ? Sunrise : Sunset, value: f.clock(today?.sunrise, tz), note: `Sets ${f.clock(today?.sunset, tz)}`, bg: 'bg-plum' },
  ]
})
</script>

<template>
  <section aria-label="Current conditions">
    <ul class="stagger grid grid-cols-2 gap-4 md:grid-cols-4">
      <li v-for="(t, i) in tiles" :key="t.key" class="b-card b-card-hover p-4" :class="t.bg" :style="{ '--i': i }">
        <div class="flex items-center justify-between">
          <span class="b-label">{{ t.label }}</span>
          <component :is="t.icon" :size="20" :stroke-width="2.75" />
        </div>
        <p class="b-title mt-3 flex items-center gap-2 text-4xl">
          {{ t.value }}
          <Navigation v-if="'rotate' in t && t.rotate !== null" :size="22" :stroke-width="3" class="transition-transform duration-700" :style="{ transform: `rotate(${(t.rotate ?? 0) + 180}deg)` }" />
        </p>
        <p class="mt-1 font-mono text-[11px] font-bold uppercase">{{ 'dir' in t && t.dir ? `From ${t.dir} · ` : '' }}{{ t.note }}</p>
      </li>
    </ul>
  </section>
</template>
