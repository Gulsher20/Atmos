<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ActivityRecommendation } from '@weather/shared-types'
import ScoreBar from '@/components/ui/ScoreBar.vue'

const props = defineProps<{ activities: ActivityRecommendation[] }>()
const open = ref<string | null>(null)
const sorted = computed(() =>
  props.activities
    .filter((a) => a.availability !== 'unavailable')
    .sort((a, b) => Number(a.availability === 'unknown') - Number(b.availability === 'unknown') || b.score - a.score),
)
const unavailable = computed(() => props.activities.filter((a) => a.availability === 'unavailable'))
const placesUnknown = computed(() => props.activities.some((a) => a.availability === 'unknown'))
const levelBg: Record<string, string> = { excellent: 'bg-mint', good: 'bg-sun', possible: 'bg-white', not_ideal: 'bg-smoke', avoid: 'bg-flame' }
</script>

<template>
  <section class="b-card bg-paper" aria-labelledby="activities-title">
    <h2 id="activities-title" class="b-section-title border-b-3 border-ink p-4 sm:p-5">What to do</h2>
    <p v-if="placesUnknown" class="border-b-3 border-ink bg-flame px-4 py-2 font-mono text-[11px] font-bold uppercase sm:px-5" role="status">
      Couldn't check nearby places right now (OpenStreetMap is busy). Beach, hiking, car wash and similar scores are weather-only until it responds.
    </p>
    <p v-if="!activities.length" class="p-5 font-mono text-sm">No activity suggestions yet. They need a working forecast for this place.</p>
    <ul v-else class="stagger grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      <li v-for="(a, i) in sorted" :key="a.activity" :style="{ '--i': i }">
        <button
          type="button"
          class="w-full border-3 border-ink p-3 text-left shadow-brutal-sm transition-[transform,box-shadow] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal"
          :class="levelBg[a.level]"
          :aria-expanded="open === a.activity"
          @click="open = open === a.activity ? null : a.activity"
        >
          <div class="flex items-center gap-3">
            <span class="b-icon-box h-12 w-12 bg-paper text-2xl" aria-hidden="true">{{ a.icon }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <p class="b-title truncate text-2xl">{{ a.title }}</p>
                <p class="b-title text-3xl">{{ a.score }}</p>
              </div>
              <p class="font-mono text-[10px] font-bold uppercase">
                {{ a.levelLabel }}
                <span v-if="a.availability === 'available'"> · Nearby ✓</span>
                <span v-else-if="a.availability === 'unknown'"> · Place data unknown</span>
              </p>
            </div>
          </div>
          <div class="mt-2"><ScoreBar :score="a.score" :label="`${a.title} score`" /></div>
          <p class="mt-2 text-sm leading-snug">{{ a.summary }}</p>
          <Transition name="expand">
            <div v-if="open === a.activity" class="mt-3 border-t-2 border-dashed border-ink pt-3">
              <p class="b-label mb-1">Why</p>
              <p class="mb-2 border-2 border-ink bg-white p-2 text-sm">{{ a.availabilityNote }}</p>
              <ul class="mb-3 space-y-0.5 text-sm">
                <li v-for="r in a.reasons" :key="r">• {{ r }}</li>
              </ul>
              <ul class="space-y-1.5">
                <li v-for="factor in a.factors" :key="factor.key" class="grid grid-cols-[80px_1fr_30px] items-center gap-2 font-mono text-[10px] font-bold uppercase">
                  <span>{{ factor.label }}</span>
                  <ScoreBar :score="factor.score" :label="factor.label" thin />
                  <span class="text-right">{{ factor.score }}</span>
                </li>
              </ul>
            </div>
          </Transition>
        </button>
      </li>
    </ul>
    <div v-if="unavailable.length" class="border-t-3 border-ink bg-smoke p-4 sm:p-5">
      <p class="b-label mb-2">Not available near this place · live OpenStreetMap check</p>
      <ul class="flex flex-wrap gap-2">
        <li
          v-for="a in unavailable"
          :key="a.activity"
          class="group relative border-2 border-ink bg-paper px-3 py-1.5 font-mono text-[11px] font-bold uppercase"
          :title="a.availabilityNote"
        >
          {{ a.icon }} {{ a.title }} — not nearby
        </li>
      </ul>
    </div>
    <p class="border-t-2 border-ink bg-white px-4 py-2 font-mono text-[9px] font-bold uppercase sm:px-5">
      Weather scores: ATMOS ensemble · Nearby places: © OpenStreetMap contributors via Overpass
    </p>
  </section>
</template>
