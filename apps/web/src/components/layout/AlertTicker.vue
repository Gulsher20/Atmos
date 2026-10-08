<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ items: { id: string; icon: string; text: string; hot?: boolean }[] }>()
const loop = computed(() => [...props.items, ...props.items])
</script>

<template>
  <div v-if="items.length" class="relative z-10 overflow-hidden border-b-3 border-ink bg-ink text-paper" role="marquee" aria-label="Weather alerts and trends">
    <div class="flex w-max animate-marquee hover:[animation-play-state:paused]">
      <span v-for="(item, i) in loop" :key="`${item.id}-${i}`" class="flex items-center gap-2 whitespace-nowrap px-6 py-2 font-mono text-xs font-bold uppercase tracking-wider">
        <span aria-hidden="true">{{ item.icon }}</span>
        <span :class="item.hot ? 'text-flame' : 'text-sun'">{{ item.text }}</span>
        <span class="text-paper/40" aria-hidden="true">///</span>
      </span>
    </div>
  </div>
</template>
