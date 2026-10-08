<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useLocationStore } from '@/stores/location.store'

const store = useLocationStore()
const { locations, active } = storeToRefs(store)
</script>

<template>
  <nav class="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2" aria-label="Saved places">
    <button
      v-for="l in locations"
      :key="l.id"
      type="button"
      class="shrink-0 border-3 border-ink px-3 py-1.5 font-mono text-xs font-bold uppercase shadow-brutal-sm transition-transform hover:-translate-y-0.5"
      :class="active?.id === l.id ? 'bg-ink text-sun' : 'bg-paper hover:bg-sun'"
      :aria-current="active?.id === l.id"
      @click="store.select(l.id)"
    >
      {{ l.isDefault ? '★ ' : '' }}{{ l.name }}
    </button>
    <RouterLink to="/locations" class="flex shrink-0 items-center gap-1 border-3 border-dashed border-ink bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-sun">
      <Plus :size="14" :stroke-width="3" /> Add place
    </RouterLink>
  </nav>
</template>
