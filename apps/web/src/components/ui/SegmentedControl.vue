<script setup lang="ts" generic="T extends string | number">
defineProps<{ options: { value: T; label: string }[]; label: string }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="inline-flex flex-wrap border-3 border-ink bg-white shadow-brutal-sm" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="border-r-3 border-ink px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors last:border-r-0"
      :class="model === option.value ? 'bg-ink text-sun' : 'hover:bg-sun'"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
