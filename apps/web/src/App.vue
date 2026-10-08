<script setup lang="ts">
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { conditionGroup } from '@weather/weather-core'
import WeatherScene from '@/components/scene/WeatherScene.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import BottomNav from '@/components/layout/BottomNav.vue'
import AlertTicker from '@/components/layout/AlertTicker.vue'
import ToastStack from '@/components/layout/ToastStack.vue'
import StatusBar from '@/components/layout/StatusBar.vue'
import { timezoneUnknown, useDashboard } from '@/composables/useDashboard'
import { useMotion } from '@/composables/useMotion'
import { useLocationStore } from '@/stores/location.store'
import { useNotificationStore } from '@/stores/notification.store'
import { useSettingsStore } from '@/stores/settings.store'
import { useUiStore } from '@/stores/ui.store'

const locations = useLocationStore()
const notifications = useNotificationStore()
const settings = useSettingsStore()
const ui = useUiStore()
const { active } = storeToRefs(locations)
const { data } = useDashboard(active)
const { reduced } = useMotion()

watch(
  data,
  (dashboard) => {
    if (!dashboard) return
    const c = dashboard.current
    ui.setScene({ group: conditionGroup(c.condition), isDay: c.isDay, windSpeed: c.windSpeed, cloudCover: c.cloudCover ?? 50, temperature: c.temperature })

    const location = active.value
    if (!location) return
    if (!timezoneUnknown(dashboard)) locations.updateTimezone(location.id, dashboard.location.timezone)
    if (!settings.inAppAlerts) return

    let toasted = false
    for (const alert of dashboard.alerts) {
      const fresh = notifications.push(
        { id: `${location.id}:${alert.id}`, icon: alert.icon, title: alert.title, message: alert.message, severity: alert.severity, location: location.name },
        !toasted,
      )
      toasted ||= fresh
    }
    if (settings.notificationPrefs.changes) {
      for (const trend of dashboard.trends) {
        notifications.push(
          { id: `${location.id}:${trend.id}`, icon: trend.icon, title: trend.title, message: trend.message, severity: trend.severity === 'high' ? 'warning' : 'info', location: location.name },
          false,
        )
      }
    }
  },
  { immediate: true },
)

const ticker = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    ...d.alerts.map((a) => ({ id: a.id, icon: a.icon, text: `${a.title}: ${a.message}`, hot: a.severity !== 'info' })),
    ...d.trends.map((t) => ({ id: t.id, icon: t.icon, text: t.message })),
  ]
})
</script>

<template>
  <div :class="{ 'reduce-motion': reduced }" class="relative min-h-dvh">
    <WeatherScene />
    <div class="relative z-10 flex min-h-dvh flex-col">
      <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 b-btn b-btn-sun">Skip to content</a>
      <StatusBar />
      <AppHeader />
      <AlertTicker :items="ticker" />
      <main id="main" class="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
        <RouterView v-slot="{ Component, route }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </main>
      <footer class="relative z-10 mx-auto mb-24 w-full max-w-7xl px-4 sm:px-6 lg:mb-6">
        <p class="inline-block border-3 border-ink bg-paper px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider shadow-brutal-sm">
          Data: Open-Meteo (ECMWF · GFS · ICON · JMA) · MET Norway · CAMS air quality · ERA5 archive
        </p>
      </footer>
      <BottomNav />
      <ToastStack />
    </div>
  </div>
</template>
