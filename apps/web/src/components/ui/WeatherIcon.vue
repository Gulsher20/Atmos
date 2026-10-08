<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  HelpCircle,
  Moon,
  Snowflake,
  Sun,
} from 'lucide-vue-next'
import type { WeatherCondition } from '@weather/shared-types'

const props = withDefaults(defineProps<{ condition: WeatherCondition; isDay?: boolean; size?: number; strokeWidth?: number }>(), {
  isDay: true,
  size: 24,
  strokeWidth: 2.5,
})

const icon = computed<Component>(() => {
  const c = props.condition
  if (c === 'clear_sky') return props.isDay ? Sun : Moon
  if (c === 'mainly_clear' || c === 'partly_cloudy') return props.isDay ? CloudSun : CloudMoon
  if (c === 'overcast') return Cloud
  if (c.includes('fog')) return CloudFog
  if (c.includes('hail')) return CloudHail
  if (c.startsWith('thunderstorm')) return CloudLightning
  if (c.includes('snow')) return c.includes('heavy') ? Snowflake : CloudSnow
  if (c.includes('drizzle')) return CloudDrizzle
  if (c.includes('heavy') || c.includes('violent')) return CloudRainWind
  if (c.includes('rain')) return CloudRain
  return HelpCircle
})
</script>

<template>
  <component :is="icon" :size="size" :stroke-width="strokeWidth" aria-hidden="true" />
</template>
