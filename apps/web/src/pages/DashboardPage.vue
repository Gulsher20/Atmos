<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CurrentHero from '@/components/weather/CurrentHero.vue'
import MetricGrid from '@/components/weather/MetricGrid.vue'
import HourlyStrip from '@/components/weather/HourlyStrip.vue'
import DailyList from '@/components/weather/DailyList.vue'
import AirQualityCard from '@/components/weather/AirQualityCard.vue'
import InsightsPanel from '@/components/weather/InsightsPanel.vue'
import SourcesPanel from '@/components/weather/SourcesPanel.vue'
import ActivityGrid from '@/components/recommendations/ActivityGrid.vue'
import ClothingCard from '@/components/recommendations/ClothingCard.vue'
import RainRadar from '@/components/weather/RainRadar.vue'
import LocationSwitcher from '@/components/locations/LocationSwitcher.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useDashboard } from '@/composables/useDashboard'
import { useLocationStore } from '@/stores/location.store'

const route = useRoute()
const router = useRouter()
const locations = useLocationStore()
const { active } = storeToRefs(locations)

watch(
  () => route.params.id,
  (id) => {
    if (typeof id !== 'string') return
    if (locations.locations.some((l) => l.id === id)) locations.select(id)
    else void router.replace('/')
  },
  { immediate: true },
)

const { state, data, loading, error, refresh } = useDashboard(active)

const failedForecasts = computed(() =>
  (data.value?.sources ?? []).filter((s) => s.status === 'failed' && !s.id.startsWith('open-meteo')),
)
const workingForecasts = computed(() =>
  (data.value?.sources ?? []).filter((s) => s.status === 'ok' && !s.id.startsWith('open-meteo')).length,
)
const currentFailed = computed(() => data.value?.sources.some((s) => s.id === 'open-meteo' && s.status === 'failed') ?? false)
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <LocationSwitcher />

    <EmptyState v-if="!active" title="No places yet" message="Add a city or coordinates to get your forecast." tone="sun">
      <RouterLink to="/locations" class="b-btn b-btn-ink">Add a place</RouterLink>
    </EmptyState>

    <template v-else-if="data">
      <p v-if="error && state?.offline" class="b-card bg-flame px-4 py-3 font-mono text-xs font-bold uppercase" role="status">
        {{ error }} Showing the copy saved on this device.
      </p>
      <p v-if="failedForecasts.length" class="b-card bg-sun px-4 py-3 font-mono text-xs font-bold uppercase" role="status">
        {{ failedForecasts.map((s) => s.name).join(', ') }} didn't respond. Forecast blended from {{ workingForecasts }}
        {{ workingForecasts === 1 ? 'source' : 'sources' }}, so confidence is lower than usual.
      </p>
      <p v-if="currentFailed" class="b-card bg-sun px-4 py-3 font-mono text-xs font-bold uppercase" role="status">
        Live current conditions are unavailable, so "now" values are estimated from the hourly forecast.
      </p>
      <CurrentHero :dashboard="data" :location="active" :saved-at="state?.savedAt ?? null" :loading="loading" :offline="!!state?.offline" @refresh="refresh" />
      <MetricGrid :dashboard="data" />
      <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div class="grid gap-6">
          <ActivityGrid :activities="data.recommendations.activities" />
          <RainRadar :latitude="active.latitude" :longitude="active.longitude" :name="active.name" :timezone="data.location.timezone" />
        </div>
        <ClothingCard :recommendations="data.recommendations" />
      </div>
      <HourlyStrip :hourly="data.hourly" :timezone="data.location.timezone" />
      <div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <DailyList :daily="data.daily" :sources="data.sources" :timezone="data.location.timezone" />
        <AirQualityCard :air="data.airQuality" />
      </div>
      <InsightsPanel :trends="data.trends" :alerts="data.alerts" :explanation="data.explanation" />
      <SourcesPanel :sources="data.sources" />
    </template>

    <EmptyState v-else-if="error" title="Forecast unavailable" :message="error" tone="flame">
      <button type="button" class="b-btn b-btn-ink" @click="refresh">Try again</button>
    </EmptyState>

    <div v-else class="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading forecast">
      <SkeletonBlock height="18rem" />
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SkeletonBlock v-for="i in 4" :key="i" height="8rem" />
      </div>
      <SkeletonBlock height="22rem" />
    </div>
  </div>
</template>
