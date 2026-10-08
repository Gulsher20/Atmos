<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ score: number; label?: string; thin?: boolean }>(), { thin: false })

const color = computed(() => (props.score >= 75 ? '#3DDC97' : props.score >= 50 ? '#FFD400' : props.score >= 25 ? '#FF5A1F' : '#0E0E0E'))
</script>

<template>
  <div
    class="relative w-full border-2 border-ink bg-white"
    :class="thin ? 'h-2.5' : 'h-4'"
    role="meter"
    :aria-valuenow="Math.round(score)"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label ?? 'Score'"
  >
    <div class="h-full origin-left animate-grow border-r-2 border-ink" :style="{ width: `${Math.max(2, Math.min(100, score))}%`, background: color }" />
  </div>
</template>
