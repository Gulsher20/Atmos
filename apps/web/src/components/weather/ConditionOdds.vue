<script setup lang="ts">
import type { ConditionProbability } from '@weather/shared-types'
import { GROUP_LABEL } from '@weather/weather-core'

defineProps<{ odds: ConditionProbability[] }>()
const COLORS: Record<string, string> = {
  clear: '#FFD400', cloudy: '#D9D4C5', fog: '#F4F0E4', drizzle: '#7CC6FE', rain: '#7CC6FE', heavy_rain: '#3B82F6', snow: '#FFFFFF', thunderstorm: '#A77BFF', unknown: '#D9D4C5',
}
</script>

<template>
  <div>
    <div class="flex h-6 w-full overflow-hidden border-3 border-ink" role="img" :aria-label="odds.map((o) => `${GROUP_LABEL[o.group]} ${o.probability}%`).join(', ')">
      <div
        v-for="o in odds"
        :key="o.group"
        class="h-full origin-left animate-grow border-r-2 border-ink last:border-r-0"
        :style="{ width: `${o.probability}%`, background: COLORS[o.group] }"
      />
    </div>
    <ul class="mt-2 flex flex-wrap gap-2">
      <li v-for="o in odds" :key="o.group" class="b-chip bg-white">
        <span class="inline-block h-2.5 w-2.5 border-2 border-ink" :style="{ background: COLORS[o.group] }" />
        {{ GROUP_LABEL[o.group] }} {{ o.probability }}%
      </li>
    </ul>
  </div>
</template>
