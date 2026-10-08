<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { BellOff, BellRing, Send, Trash2 } from 'lucide-vue-next'
import type { NotificationPreferenceKey } from '@weather/shared-types'
import { usePush } from '@/composables/usePush'
import { useFormat } from '@/composables/useFormat'
import { useNotificationStore } from '@/stores/notification.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useLocationStore } from '@/stores/location.store'

const notifications = useNotificationStore()
const settings = useSettingsStore()
const locations = useLocationStore()
const { items } = storeToRefs(notifications)
const push = usePush()
const f = useFormat()

onMounted(() => {
  void push.refresh()
  notifications.markAllRead()
})

const PREFS: { key: NotificationPreferenceKey; label: string; hint: string }[] = [
  { key: 'rain', label: 'Rain & storms', hint: 'Heavy rain, thunderstorms, snow' },
  { key: 'heat', label: 'Heat', hint: 'Extreme highs' },
  { key: 'cold', label: 'Cold', hint: 'Freezing lows' },
  { key: 'wind', label: 'Wind', hint: 'Strong gusts' },
  { key: 'uv', label: 'UV', hint: 'Very high UV index' },
  { key: 'airQuality', label: 'Air quality', hint: 'Unhealthy AQI' },
  { key: 'changes', label: 'Week changes', hint: 'Getting warmer, wetter, windier…' },
  { key: 'daily', label: 'Daily brief', hint: 'Morning summary' },
]

async function run(action: () => Promise<void>, ok: string) {
  try {
    await action()
    notifications.toast({ icon: '✅', title: 'Done', message: ok, tone: 'mint' })
  } catch (e) {
    notifications.toast({ icon: '⚠️', title: 'Not quite', message: e instanceof Error ? e.message : 'Something went wrong', tone: 'flame' })
  }
}

watch(
  () => [settings.notificationPrefs, locations.active?.id],
  () => {
    if (push.enabled.value) void push.updatePreferences().catch(() => undefined)
  },
  { deep: true },
)

const severityBg = { info: 'bg-sky', warning: 'bg-sun', critical: 'bg-flame' } as const
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <header>
      <p class="b-label inline-block border-3 border-ink bg-ink px-2 py-1 text-sun">Stay ahead</p>
      <h1 class="b-title mt-2 w-fit border-3 border-ink bg-paper px-4 pb-1 pt-3 text-6xl shadow-brutal sm:text-7xl">Alerts</h1>
    </header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="b-card bg-flame p-5" aria-labelledby="push-title">
        <h2 id="push-title" class="b-section-title mb-2">Push notifications</h2>
        <p class="mb-4">Get warned on this device even when ATMOS is closed — for <strong>{{ locations.active?.name ?? 'your default place' }}</strong>. Permission is only requested when you press enable.</p>
        <p v-if="!push.supported" class="b-card bg-paper p-3 font-mono text-xs font-bold uppercase">This browser doesn't support web push. Install the app or try Chrome, Edge or Firefox.</p>
        <p v-else-if="push.permission.value === 'denied'" class="b-card bg-paper p-3 font-mono text-xs font-bold uppercase">Notifications are blocked. Re-enable them in your browser's site settings.</p>
        <div v-else class="flex flex-wrap gap-3">
          <button v-if="!push.enabled.value" type="button" class="b-btn b-btn-ink" :disabled="push.busy.value" @click="run(push.enable, 'Push notifications are on.')">
            <BellRing :size="16" :stroke-width="3" /> Enable push
          </button>
          <template v-else>
            <button type="button" class="b-btn b-btn-sun" :disabled="push.busy.value" @click="run(push.sendTest, 'Test notification sent.')">
              <Send :size="16" :stroke-width="3" /> Send test
            </button>
            <button type="button" class="b-btn" :disabled="push.busy.value" @click="run(push.disable, 'Push notifications are off.')">
              <BellOff :size="16" :stroke-width="3" /> Disable
            </button>
          </template>
        </div>
        <label class="mt-5 flex cursor-pointer items-center gap-3 font-mono text-xs font-bold uppercase">
          <input v-model="settings.inAppAlerts" type="checkbox" class="h-5 w-5 accent-ink" /> Show in-app alerts & toasts
        </label>
      </section>

      <section class="b-card bg-paper p-5" aria-labelledby="prefs-title">
        <h2 id="prefs-title" class="b-section-title mb-4">Notify me about</h2>
        <ul class="grid gap-2 sm:grid-cols-2">
          <li v-for="p in PREFS" :key="p.key">
            <label class="flex cursor-pointer items-start gap-3 border-3 border-ink p-3 transition-colors" :class="settings.notificationPrefs[p.key] ? 'bg-sun' : 'bg-white hover:bg-sun/40'">
              <input v-model="settings.notificationPrefs[p.key]" type="checkbox" class="mt-0.5 h-5 w-5 accent-ink" />
              <span>
                <span class="b-title block text-xl">{{ p.label }}</span>
                <span class="text-sm">{{ p.hint }}</span>
              </span>
            </label>
          </li>
        </ul>
        <p class="mt-3 text-sm">Repeat alerts are suppressed with a cooldown so you only hear about real changes.</p>
      </section>
    </div>

    <section class="b-card bg-paper" aria-labelledby="inbox-title">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b-3 border-ink p-4 sm:p-5">
        <h2 id="inbox-title" class="b-section-title">Inbox · {{ items.length }}</h2>
        <button v-if="items.length" type="button" class="b-btn" @click="notifications.clear()"><Trash2 :size="14" :stroke-width="3" /> Clear all</button>
      </div>
      <ul class="stagger divide-y-3 divide-ink">
        <li v-for="(n, i) in items" :key="n.id" class="flex items-start gap-3 p-4" :class="severityBg[n.severity]" :style="{ '--i': Math.min(i, 10) }">
          <span class="b-icon-box h-11 w-11 bg-paper text-xl" aria-hidden="true">{{ n.icon }}</span>
          <div class="min-w-0 flex-1">
            <p class="b-title text-2xl">{{ n.title }}</p>
            <p class="leading-snug">{{ n.message }}</p>
            <p class="mt-1 font-mono text-[10px] font-bold uppercase">{{ n.location }} · {{ f.ago(Date.parse(n.createdAt)) }}</p>
          </div>
          <button type="button" class="b-icon-box h-8 w-8 bg-paper" aria-label="Delete notification" @click="notifications.remove(n.id)"><Trash2 :size="14" :stroke-width="3" /></button>
        </li>
        <li v-if="!items.length" class="p-6 text-center">
          <p class="b-title text-3xl">Quiet skies</p>
          <p>Alerts and weekly changes for your places will land here.</p>
        </li>
      </ul>
    </section>
  </div>
</template>
