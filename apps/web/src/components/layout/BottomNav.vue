<script setup lang="ts">
import { NAV_ITEMS } from './navigation'

const items = NAV_ITEMS.filter((i) => i.mobile)
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-30 border-t-3 border-ink bg-sun pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
    <ul class="grid grid-cols-5">
      <li v-for="item in items" :key="item.to" class="border-r-3 border-ink last:border-r-0">
        <RouterLink
          :to="item.to"
          class="flex flex-col items-center gap-0.5 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-colors"
          exact-active-class="bg-ink text-sun"
        >
          <component :is="item.icon" :size="20" :stroke-width="2.75" />
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
