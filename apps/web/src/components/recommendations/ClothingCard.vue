<script setup lang="ts">
import type { Recommendations } from '@weather/shared-types'

defineProps<{ recommendations: Recommendations }>()
</script>

<template>
  <section class="grid grid-cols-1 gap-6" aria-label="Clothing and tips">
    <div class="b-card bg-flame p-5">
      <p class="b-label mb-2">The verdict</p>
      <p class="b-title text-4xl sm:text-5xl">{{ recommendations.headline }}</p>
    </div>

    <div class="b-card bg-paper">
      <h2 class="b-section-title border-b-3 border-ink p-4 sm:p-5">What to wear</h2>
      <div class="p-4 sm:p-5">
        <p class="text-lg font-semibold leading-snug">{{ recommendations.clothing.summary }}</p>
        <ul class="mt-4 flex flex-wrap gap-2">
          <li
            v-for="(item, i) in recommendations.clothing.items"
            :key="item"
            class="animate-pop border-3 border-ink bg-sun px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-brutal-sm"
            :style="{ animationDelay: `${i * 70}ms` }"
          >
            {{ item }}
          </li>
          <li
            v-for="(item, i) in recommendations.clothing.accessories"
            :key="item"
            class="animate-pop border-3 border-ink bg-sky px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-brutal-sm"
            :style="{ animationDelay: `${(i + recommendations.clothing.items.length) * 70}ms` }"
          >
            + {{ item }}
          </li>
        </ul>
        <ul v-if="recommendations.clothing.reasons.length" class="mt-4 space-y-1 text-sm">
          <li v-for="r in recommendations.clothing.reasons" :key="r">→ {{ r }}</li>
        </ul>
      </div>
    </div>

    <div v-if="recommendations.tips.length" class="b-card bg-ink p-5 text-paper">
      <p class="b-label mb-3 text-sun">Tidbits</p>
      <ul class="space-y-2">
        <li v-for="tip in recommendations.tips" :key="tip" class="flex gap-2"><span class="text-sun">■</span>{{ tip }}</li>
      </ul>
    </div>
  </section>
</template>
