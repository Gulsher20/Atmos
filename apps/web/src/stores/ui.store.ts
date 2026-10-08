import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface SceneState {
  group: 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavy_rain' | 'snow' | 'thunderstorm' | 'unknown'
  isDay: boolean
  windSpeed: number
  cloudCover: number
  temperature: number
}

/** Shared UI state: what the animated background should show. */
export const useUiStore = defineStore('ui', () => {
  const scene = ref<SceneState>({ group: 'cloudy', isDay: true, windSpeed: 8, cloudCover: 40, temperature: 20 })
  const burstSignal = ref(0)

  function setScene(next: SceneState) {
    scene.value = next
  }

  /** Ask the background to celebrate an interaction (e.g. a save). */
  function burst() {
    burstSignal.value += 1
  }

  return { scene, burstSignal, setScene, burst }
})
