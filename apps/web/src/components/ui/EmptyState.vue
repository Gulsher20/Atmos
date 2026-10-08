<script setup lang="ts">
defineProps<{ title: string; message?: string; tone?: 'sun' | 'flame' | 'paper' }>()
</script>

<template>
  <div class="b-card p-6 text-center" :class="tone === 'flame' ? 'bg-flame' : tone === 'sun' ? 'bg-sun' : 'bg-paper'">
    <p class="b-title text-3xl">{{ title }}</p>
    <p v-if="message" class="mx-auto mt-2 max-w-md text-base">{{ message }}</p>
    <div v-if="$slots.default" class="mt-4 flex flex-wrap justify-center gap-3"><slot /></div>
  </div>
</template>
