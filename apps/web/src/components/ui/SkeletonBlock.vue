<script setup lang="ts">
defineProps<{ height?: string }>()
</script>

<template>
  <div class="b-card overflow-hidden" :style="{ height: height ?? '9rem' }" aria-hidden="true">
    <div class="skeleton h-full w-full" />
  </div>
</template>

<style scoped>
.skeleton {
  background: repeating-linear-gradient(-45deg, #f4f0e4 0 14px, #e9e3d1 14px 28px);
  background-size: 200% 200%;
  animation: slide 1.4s linear infinite;
}
@keyframes slide {
  to {
    background-position: 80px 0;
  }
}
</style>
