<script setup lang="ts">
import type { ProviderSource } from '@weather/shared-types'

defineProps<{ sources: ProviderSource[] }>()
</script>

<template>
  <section class="b-card bg-paper" aria-labelledby="sources-title">
    <div class="flex flex-wrap items-end justify-between gap-2 border-b-3 border-ink p-4 sm:p-5">
      <h2 id="sources-title" class="b-section-title">Sources</h2>
      <RouterLink to="/accuracy" class="b-btn b-btn-sun py-1.5">Who's most accurate? →</RouterLink>
    </div>
    <ul class="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5">
      <li v-for="s in sources" :key="s.id" class="border-3 border-ink p-3" :class="s.status === 'ok' ? 'bg-white' : 'bg-flame'">
        <p class="b-title text-xl">{{ s.name }}</p>
        <p class="font-mono text-[10px] font-bold uppercase">{{ s.status === 'ok' ? `${s.responseMs} ms` : 'Unavailable' }}</p>
        <div class="mt-2 h-3 border-2 border-ink bg-paper">
          <div class="h-full origin-left animate-grow bg-ink" :style="{ width: `${Math.round(s.weight * 100)}%` }" />
        </div>
        <p class="mt-1 font-mono text-[10px] font-bold uppercase">Weight {{ Math.round(s.weight * 100) }}%</p>
      </li>
    </ul>
    <p class="border-t-3 border-ink px-4 py-3 text-sm sm:px-5">
      Weights come from each source's measured error at this location — lower error, bigger say in the blended forecast.
    </p>
  </section>
</template>
