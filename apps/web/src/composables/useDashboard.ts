import { computed, reactive, watch, type Ref } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import type { Dashboard, WeatherLocation } from '@weather/shared-types'
import { weatherApi } from '@/services/api/weather.api'
import { readJson, writeJson } from '@/services/storage.service'

export interface DashboardState {
  data: Dashboard | null
  loading: boolean
  error: string | null
  savedAt: number | null
  /** True when the shown data came from the device cache because the network failed. */
  offline: boolean
}

const FRESH_MS = 5 * 60_000
const REFRESH_MS = 10 * 60_000
const CACHE_VERSION = 'dash-v2'
const states = reactive<Record<string, DashboardState>>({})

const keyFor = (l: Pick<WeatherLocation, 'latitude' | 'longitude'>) => `${l.latitude.toFixed(2)},${l.longitude.toFixed(2)}`

function stateFor(key: string): DashboardState {
  if (!states[key]) {
    const stored = readJson<{ data: Dashboard; savedAt: number } | null>(`${CACHE_VERSION}:${key}`, null)
    states[key] = { data: stored?.data ?? null, loading: false, error: null, savedAt: stored?.savedAt ?? null, offline: false }
  }
  return states[key]!
}

/** True when the backend could not resolve the place's timezone and fell back to UTC. */
export const timezoneUnknown = (d: Dashboard) => d.sources.some((s) => s.id === 'open-meteo' && s.status === 'failed') && d.location.timezone === 'UTC'

export async function loadDashboard(location: Pick<WeatherLocation, 'latitude' | 'longitude'> & { timezone?: string }, force = false): Promise<DashboardState> {
  const key = keyFor(location)
  const state = stateFor(key)
  const placesUnknown = state.data?.recommendations.activities.some((a) => a.availability === 'unknown') ?? false
  if (state.loading) return state
  if (!force && state.data && !state.offline && !placesUnknown && state.savedAt && Date.now() - state.savedAt < FRESH_MS) return state

  state.loading = true
  try {
    const data = await weatherApi.dashboard(location.latitude, location.longitude)
    if (location.timezone && timezoneUnknown(data)) data.location.timezone = location.timezone
    state.data = data
    state.savedAt = Date.now()
    state.error = null
    state.offline = false
    writeJson(`${CACHE_VERSION}:${key}`, { data, savedAt: state.savedAt })
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Weather data is temporarily unavailable.'
    state.offline = !!state.data
  } finally {
    state.loading = false
  }
  return state
}

/** Reactive dashboard for a location, shared across components (one request per location). */
export function useDashboard(location: Ref<WeatherLocation | null | undefined>) {
  const state = computed<DashboardState | null>(() => (location.value ? stateFor(keyFor(location.value)) : null))

  watch(
    () => location.value && keyFor(location.value),
    () => {
      if (location.value) void loadDashboard(location.value)
    },
    { immediate: true },
  )

  useIntervalFn(() => {
    if (location.value && document.visibilityState === 'visible') void loadDashboard(location.value, true)
  }, REFRESH_MS)

  return {
    state,
    data: computed(() => state.value?.data ?? null),
    loading: computed(() => state.value?.loading ?? false),
    error: computed(() => state.value?.error ?? null),
    refresh: () => (location.value ? loadDashboard(location.value, true) : Promise.resolve(null)),
  }
}
