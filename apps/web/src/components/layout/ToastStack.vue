<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useNotificationStore } from '@/stores/notification.store'

const store = useNotificationStore()
const { toasts } = storeToRefs(store)
const tone = { sun: 'bg-sun', flame: 'bg-flame', ink: 'bg-ink text-paper', mint: 'bg-mint' } as const
</script>

<template>
  <div class="pointer-events-none fixed right-4 top-24 z-50 flex w-[min(92vw,360px)] flex-col gap-3" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="b-card pointer-events-auto flex items-start gap-3 p-3" :class="tone[t.tone]">
        <span class="b-icon-box h-10 w-10 bg-paper text-xl" aria-hidden="true">{{ t.icon }}</span>
        <div class="min-w-0 flex-1">
          <p class="b-title text-xl">{{ t.title }}</p>
          <p class="text-sm leading-snug">{{ t.message }}</p>
        </div>
        <button type="button" class="b-icon-box h-7 w-7 bg-paper text-ink" aria-label="Dismiss" @click="store.dismissToast(t.id)">
          <X :size="14" :stroke-width="3" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
