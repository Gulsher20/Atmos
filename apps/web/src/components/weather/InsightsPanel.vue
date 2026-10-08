<script setup lang="ts">
import type { WeatherAlert, WeatherTrend } from '@weather/shared-types'

defineProps<{ trends: WeatherTrend[]; alerts: WeatherAlert[]; explanation: string[] }>()
const severityBg = { info: 'bg-sky', warning: 'bg-sun', critical: 'bg-flame' } as const
const trendBg = { low: 'bg-white', medium: 'bg-sun', high: 'bg-flame' } as const
</script>

<template>
  <section class="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Insights">
    <div class="b-card bg-paper">
      <h2 class="b-section-title border-b-3 border-ink p-4 sm:p-5">This week's story</h2>
      <ul class="stagger divide-y-3 divide-ink">
        <li v-for="(t, i) in trends" :key="t.id" class="flex items-start gap-3 p-4" :class="trendBg[t.severity]" :style="{ '--i': i }">
          <span class="b-icon-box h-11 w-11 bg-paper text-xl" aria-hidden="true">{{ t.icon }}</span>
          <div>
            <p class="b-title text-2xl">{{ t.title }}</p>
            <p class="leading-snug">{{ t.message }}</p>
          </div>
        </li>
        <li v-if="!trends.length" class="p-4">No big shifts expected — a steady week ahead.</li>
      </ul>
      <div v-if="explanation.length" class="border-t-3 border-ink bg-ink p-4 text-paper">
        <p class="b-label mb-2 text-sun">Why this forecast</p>
        <ul class="space-y-1 text-sm">
          <li v-for="line in explanation" :key="line">→ {{ line }}</li>
        </ul>
      </div>
    </div>

    <div class="b-card bg-paper">
      <h2 class="b-section-title border-b-3 border-ink p-4 sm:p-5">
        Alerts <span class="b-chip bg-flame text-sm">{{ alerts.length }}</span>
      </h2>
      <ul class="stagger divide-y-3 divide-ink">
        <li v-for="(a, i) in alerts" :key="a.id" class="flex items-start gap-3 p-4" :class="severityBg[a.severity]" :style="{ '--i': i }">
          <span class="b-icon-box h-11 w-11 bg-paper text-xl" aria-hidden="true">{{ a.icon }}</span>
          <div>
            <p class="b-title text-2xl">{{ a.title }} <span class="b-chip ml-1 bg-paper align-middle text-[9px]">{{ a.severity }}</span></p>
            <p class="leading-snug">{{ a.message }}</p>
          </div>
        </li>
        <li v-if="!alerts.length" class="bg-mint p-4 font-bold">All clear. Nothing alarming in the forecast.</li>
      </ul>
    </div>
  </section>
</template>
