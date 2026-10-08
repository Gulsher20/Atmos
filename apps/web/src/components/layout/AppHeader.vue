<script setup lang="ts">
import { Bell, Settings } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { useNotificationStore } from '@/stores/notification.store'
import { useSettingsStore } from '@/stores/settings.store'
import { NAV_ITEMS } from './navigation'

const notifications = useNotificationStore()
const settings = useSettingsStore()
const { unread } = storeToRefs(notifications)
</script>

<template>
  <header class="relative z-20 border-b-3 border-ink bg-paper">
    <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
      <RouterLink to="/" class="group flex items-end gap-3" aria-label="ATMOS home">
        <span class="b-title text-5xl transition-transform group-hover:-rotate-2 sm:text-6xl">
          ATMOS<sup class="align-super text-xl">™</sup>
        </span>
        <span class="hidden pb-1.5 font-mono text-[11px] font-bold uppercase leading-tight tracking-wider md:block">
          Weather.<br />Brutally honest.
        </span>
      </RouterLink>

      <nav class="hidden items-center gap-1 lg:flex" aria-label="Primary">
        <RouterLink
          v-for="item in NAV_ITEMS.slice(0, 5)"
          :key="item.to"
          :to="item.to"
          class="border-3 border-transparent px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors hover:border-ink hover:bg-sun"
          exact-active-class="!border-ink bg-ink text-sun hover:!bg-ink"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="b-icon-box h-11 w-14 bg-sun font-mono text-sm font-bold shadow-brutal-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
          :aria-label="`Switch to ${settings.units.temperature === 'celsius' ? 'Fahrenheit' : 'Celsius'}`"
          @click="settings.toggleTemperature()"
        >
          {{ settings.units.temperature === 'celsius' ? '°C' : '°F' }}
        </button>
        <RouterLink
          to="/alerts"
          class="b-icon-box relative h-11 w-11 bg-flame shadow-brutal-sm transition-transform hover:-translate-y-0.5"
          :aria-label="`Alerts${unread ? `, ${unread} unread` : ''}`"
        >
          <Bell :size="20" :stroke-width="2.75" :class="unread ? 'animate-wiggle' : ''" />
          <span v-if="unread" class="absolute -right-2 -top-2 min-w-[22px] border-2 border-ink bg-sun px-1 text-center font-mono text-[10px] font-bold">
            {{ unread > 9 ? '9+' : unread }}
          </span>
        </RouterLink>
        <RouterLink to="/settings" class="b-icon-box h-11 w-11 bg-sky shadow-brutal-sm transition-transform hover:-translate-y-0.5 hover:rotate-12" aria-label="Settings">
          <Settings :size="20" :stroke-width="2.75" />
        </RouterLink>
      </div>
    </div>
  </header>
</template>
