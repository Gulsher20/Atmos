import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ConditionGroup, NotificationPreferences, UnitPreferences } from '@weather/shared-types'
import { readJson, writeJson } from '@/services/storage.service'

export type MotionPreference = 'system' | 'full' | 'reduced'
export type ScenePreview = 'auto' | Exclude<ConditionGroup, 'unknown'> | 'night'

const DEFAULT_UNITS: UnitPreferences = { temperature: 'celsius', windSpeed: 'kmh', precipitation: 'mm', distance: 'km' }
const DEFAULT_PREFS: NotificationPreferences = { rain: true, heat: true, cold: true, wind: true, uv: false, airQuality: true, changes: true, daily: false }

export const useSettingsStore = defineStore('settings', () => {
  const units = ref<UnitPreferences>({ ...DEFAULT_UNITS, ...readJson<Partial<UnitPreferences>>('units', {}) })
  const motion = ref<MotionPreference>(readJson('motion', 'system'))
  const scenePreview = ref<ScenePreview>('auto')
  const notificationPrefs = ref<NotificationPreferences>({ ...DEFAULT_PREFS, ...readJson<Partial<NotificationPreferences>>('notificationPrefs', {}) })
  const inAppAlerts = ref<boolean>(readJson('inAppAlerts', true))

  watch(units, (v) => writeJson('units', v), { deep: true })
  watch(motion, (v) => writeJson('motion', v))
  watch(notificationPrefs, (v) => writeJson('notificationPrefs', v), { deep: true })
  watch(inAppAlerts, (v) => writeJson('inAppAlerts', v))

  function toggleTemperature() {
    units.value.temperature = units.value.temperature === 'celsius' ? 'fahrenheit' : 'celsius'
  }

  return { units, motion, scenePreview, notificationPrefs, inAppAlerts, toggleTemperature }
})
