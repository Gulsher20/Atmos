import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { WeatherLocation } from '@weather/shared-types'
import { readJson, writeJson } from '@/services/storage.service'

const now = () => new Date().toISOString()

const STARTER: WeatherLocation[] = [
  { id: 'islamabad', name: 'Islamabad', country: 'Pakistan', latitude: 33.7215, longitude: 73.0433, timezone: 'Asia/Karachi', createdAt: now(), isDefault: true },
  { id: 'lahore', name: 'Lahore', country: 'Pakistan', latitude: 31.5497, longitude: 74.3436, timezone: 'Asia/Karachi', createdAt: now() },
  { id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', latitude: 52.374, longitude: 4.8897, timezone: 'Europe/Amsterdam', createdAt: now() },
  { id: 'london', name: 'London', country: 'United Kingdom', latitude: 51.5085, longitude: -0.1257, timezone: 'Europe/London', createdAt: now() },
  { id: 'new-york', name: 'New York', country: 'United States', latitude: 40.7143, longitude: -74.006, timezone: 'America/New_York', createdAt: now() },
]

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

export const useLocationStore = defineStore('location', () => {
  const locations = ref<WeatherLocation[]>(readJson('locations', STARTER))
  const activeId = ref<string>(readJson('activeLocation', locations.value.find((l) => l.isDefault)?.id ?? locations.value[0]?.id ?? ''))

  const active = computed<WeatherLocation | null>(
    () => locations.value.find((l) => l.id === activeId.value) ?? locations.value.find((l) => l.isDefault) ?? locations.value[0] ?? null,
  )

  watch(locations, (value) => writeJson('locations', value), { deep: true })
  watch(activeId, (value) => writeJson('activeLocation', value))

  function select(id: string) {
    if (locations.value.some((l) => l.id === id)) activeId.value = id
  }

  function findNear(latitude: number, longitude: number): WeatherLocation | undefined {
    return locations.value.find((l) => Math.abs(l.latitude - latitude) < 0.01 && Math.abs(l.longitude - longitude) < 0.01)
  }

  function add(input: Omit<WeatherLocation, 'id' | 'createdAt'>): WeatherLocation {
    if (!isValidCoordinate(input.latitude, input.longitude)) throw new Error('Coordinates are out of range')
    const existing = findNear(input.latitude, input.longitude)
    if (existing) {
      activeId.value = existing.id
      return existing
    }
    const location: WeatherLocation = { ...input, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, createdAt: now() }
    if (!locations.value.length) location.isDefault = true
    locations.value.push(location)
    activeId.value = location.id
    return location
  }

  function rename(id: string, name: string): boolean {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (!clean || !locations.value.some((l) => l.id === id)) return false
    locations.value = locations.value.map((l) => (l.id === id ? { ...l, name: clean } : l))
    // Persist synchronously so an immediate navigation/reload cannot lose the rename.
    writeJson('locations', locations.value)
    return true
  }

  function remove(id: string) {
    const wasDefault = locations.value.find((l) => l.id === id)?.isDefault
    locations.value = locations.value.filter((l) => l.id !== id)
    const first = locations.value[0]
    if (wasDefault && first) first.isDefault = true
    if (activeId.value === id) activeId.value = locations.value.find((l) => l.isDefault)?.id ?? first?.id ?? ''
  }

  function setDefault(id: string) {
    locations.value.forEach((l) => (l.isDefault = l.id === id))
  }

  function updateTimezone(id: string, timezone: string) {
    const location = locations.value.find((l) => l.id === id)
    if (location && location.timezone !== timezone) location.timezone = timezone
  }

  return { locations, activeId, active, select, add, rename, remove, setDefault, updateTimezone, findNear }
})
