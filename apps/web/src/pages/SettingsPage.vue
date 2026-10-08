<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { Download } from 'lucide-vue-next'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useInstall } from '@/composables/usePwa'
import { useSettingsStore } from '@/stores/settings.store'
import { useNotificationStore } from '@/stores/notification.store'
import { clearAll } from '@/services/storage.service'

const settings = useSettingsStore()
const notifications = useNotificationStore()
const { canInstall, installed, install } = useInstall()

onBeforeUnmount(() => (settings.scenePreview = 'auto'))

const scenes = [
  { value: 'auto', label: 'Live' },
  { value: 'clear', label: 'Sun' },
  { value: 'cloudy', label: 'Clouds' },
  { value: 'drizzle', label: 'Drizzle' },
  { value: 'rain', label: 'Rain' },
  { value: 'heavy_rain', label: 'Downpour' },
  { value: 'thunderstorm', label: 'Storm' },
  { value: 'snow', label: 'Snow' },
  { value: 'fog', label: 'Fog' },
  { value: 'night', label: 'Night' },
] as const

function reset() {
  if (!window.confirm('Clear saved places, settings and cached forecasts on this device?')) return
  clearAll()
  notifications.toast({ icon: '🧹', title: 'Cleared', message: 'Reloading with a fresh start.', tone: 'ink' })
  setTimeout(() => window.location.reload(), 600)
}
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <header>
      <p class="b-label inline-block border-3 border-ink bg-ink px-2 py-1 text-sun">Make it yours</p>
      <h1 class="b-title mt-2 w-fit border-3 border-ink bg-paper px-4 pb-1 pt-3 text-6xl shadow-brutal sm:text-7xl">Settings</h1>
    </header>

    <section class="b-card grid gap-5 bg-paper p-5" aria-labelledby="units-title">
      <h2 id="units-title" class="b-section-title">Units</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <p class="b-label mb-2">Temperature</p>
          <SegmentedControl v-model="settings.units.temperature" label="Temperature unit" :options="[{ value: 'celsius', label: '°C' }, { value: 'fahrenheit', label: '°F' }]" />
        </div>
        <div>
          <p class="b-label mb-2">Wind speed</p>
          <SegmentedControl v-model="settings.units.windSpeed" label="Wind unit" :options="[{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }]" />
        </div>
        <div>
          <p class="b-label mb-2">Precipitation</p>
          <SegmentedControl v-model="settings.units.precipitation" label="Precipitation unit" :options="[{ value: 'mm', label: 'mm' }, { value: 'inch', label: 'inch' }]" />
        </div>
        <div>
          <p class="b-label mb-2">Distance</p>
          <SegmentedControl v-model="settings.units.distance" label="Distance unit" :options="[{ value: 'km', label: 'km' }, { value: 'miles', label: 'miles' }]" />
        </div>
      </div>
    </section>

    <section class="b-card grid gap-4 bg-sun p-5" aria-labelledby="motion-title">
      <h2 id="motion-title" class="b-section-title">Background & motion</h2>
      <div>
        <p class="b-label mb-2">Animation</p>
        <SegmentedControl v-model="settings.motion" label="Motion" :options="[{ value: 'system', label: 'Follow system' }, { value: 'full', label: 'Full motion' }, { value: 'reduced', label: 'Reduced' }]" />
      </div>
      <div>
        <p class="b-label mb-2">Preview a sky (resets when you leave this page)</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in scenes"
            :key="s.value"
            type="button"
            class="b-btn py-1.5"
            :class="settings.scenePreview === s.value ? 'b-btn-ink' : ''"
            @click="settings.scenePreview = s.value"
          >
            {{ s.label }}
          </button>
        </div>
        <p class="mt-2 text-sm">Tip: click empty space in the background — storms strike lightning where you click.</p>
      </div>
    </section>

    <section class="b-card grid gap-3 bg-sky p-5" aria-labelledby="app-title">
      <h2 id="app-title" class="b-section-title">App</h2>
      <p v-if="installed">ATMOS is installed on this device. 🎉</p>
      <button v-else-if="canInstall" type="button" class="b-btn b-btn-ink w-fit" @click="install"><Download :size="16" :stroke-width="3" /> Install ATMOS</button>
      <p v-else class="text-sm">To install, use your browser's "Install app" or "Add to Home Screen" option.</p>
      <p class="text-sm">Forecasts you've viewed are kept on this device so the app still works offline.</p>
      <button type="button" class="b-btn b-btn-flame w-fit" @click="reset">Clear local data</button>
    </section>
  </div>
</template>
