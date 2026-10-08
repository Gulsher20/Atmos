import type { SceneState } from '@/stores/ui.store'
import type { ScenePreview } from '@/stores/settings.store'

export interface SceneConfig {
  word: string
  sky: string
  dark: boolean
  night: boolean
  sun: boolean
  heat: boolean
  fog: boolean
  radar: boolean
  clouds: number
  cloudFill: string
  precip: 'none' | 'rain' | 'snow' | 'storm'
  drops: number
  dropSpeed: number
  flakes: number
  slant: number
  streaks: number
  wind: number
}

/** Map the current weather (or a preview choice) to what the canvas draws. */
export function buildScene(state: SceneState, preview: ScenePreview): SceneConfig {
  const group = preview === 'auto' ? state.group : preview === 'night' ? 'clear' : preview
  const night = preview === 'night' || (preview === 'auto' && !state.isDay)
  const wind = preview === 'auto' ? state.windSpeed : group === 'thunderstorm' ? 35 : 12
  const cloudCover = preview === 'auto' ? state.cloudCover : group === 'cloudy' ? 75 : 25

  const base: SceneConfig = {
    word: 'CLEAR',
    sky: night ? '#16183A' : '#8FD3FF',
    dark: night,
    night,
    sun: !night,
    heat: !night && state.temperature >= 32 && preview === 'auto',
    fog: false,
    radar: false,
    clouds: Math.max(1, Math.round(cloudCover / 18)),
    cloudFill: night ? '#3A3F6B' : '#FFFFFF',
    precip: 'none',
    drops: 0,
    dropSpeed: 1,
    flakes: 0,
    slant: Math.min(0.6, wind / 60),
    streaks: wind >= 18 ? Math.min(12, Math.round(wind / 4)) : 0,
    wind,
  }

  switch (group) {
    case 'cloudy':
      return { ...base, word: 'CLOUDY', sky: night ? '#232846' : '#B4C6D4', sun: !night && cloudCover < 85, cloudFill: night ? '#40466F' : '#F4F0E4', clouds: Math.max(4, base.clouds) }
    case 'fog':
      return { ...base, word: 'FOG', sky: night ? '#2B2E40' : '#CFCDC2', sun: false, fog: true, clouds: 2, cloudFill: '#E8E4D6' }
    case 'drizzle':
      return { ...base, word: 'DRIZZLE', sky: night ? '#1F2638' : '#93A3B3', sun: false, dark: night, precip: 'rain', drops: 70, dropSpeed: 0.75, clouds: 5, cloudFill: night ? '#3C4466' : '#DCE1E7' }
    case 'rain':
      return { ...base, word: 'RAIN', sky: night ? '#1A2132' : '#7A8A9B', sun: false, dark: true, precip: 'rain', drops: 150, clouds: 7, cloudFill: night ? '#3A4262' : '#C5CCD5', radar: true }
    case 'heavy_rain':
      return { ...base, word: 'DOWNPOUR', sky: night ? '#141A28' : '#5E6B7A', sun: false, dark: true, precip: 'rain', drops: 240, dropSpeed: 1.3, clouds: 8, cloudFill: night ? '#353C5A' : '#AEB7C2', radar: true }
    case 'thunderstorm':
      return { ...base, word: 'STORM', sky: '#2B2540', sun: false, dark: true, precip: 'storm', drops: 200, dropSpeed: 1.4, clouds: 8, cloudFill: '#4C4470', radar: true, streaks: Math.max(base.streaks, 6) }
    case 'snow':
      return { ...base, word: 'SNOW', sky: night ? '#283048' : '#DCE8F2', sun: false, dark: night, precip: 'snow', flakes: 120, clouds: 5, cloudFill: night ? '#4A5277' : '#FFFFFF' }
    default:
      return base
  }
}