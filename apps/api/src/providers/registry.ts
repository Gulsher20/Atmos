import type { ProviderCapabilities } from '@weather/shared-types'
import type { WeatherProvider } from './interfaces/weather-provider'
import { MetNorwayProvider } from './met-norway/met-norway.provider'
import { OPEN_METEO_MODELS } from './open-meteo/open-meteo.provider'

/** All forecast providers taking part in the ensemble. Add new adapters here. */
export const FORECAST_PROVIDERS: WeatherProvider[] = [...OPEN_METEO_MODELS, new MetNorwayProvider()]

const service = (overrides: Partial<ProviderCapabilities>): ProviderCapabilities => ({
  currentWeather: false,
  hourlyForecast: false,
  dailyForecast: false,
  historicalWeather: false,
  airQuality: false,
  precipitation: false,
  uv: false,
  ...overrides,
})

/** Supporting services that are not ensemble members. */
export const SUPPORT_SERVICES: { id: string; name: string; capabilities: ProviderCapabilities }[] = [
  { id: 'open-meteo', name: 'Open-Meteo (current + astronomy)', capabilities: service({ currentWeather: true, uv: true, precipitation: true }) },
  { id: 'open-meteo-air', name: 'Open-Meteo Air Quality', capabilities: service({ airQuality: true }) },
  { id: 'open-meteo-archive', name: 'Open-Meteo Archive (ERA5)', capabilities: service({ historicalWeather: true, precipitation: true }) },
  { id: 'open-meteo-geocoding', name: 'Open-Meteo Geocoding', capabilities: service({}) },
  { id: 'nominatim', name: 'OpenStreetMap Nominatim', capabilities: service({}) },
]

export function providerName(id: string): string {
  if (id === 'ensemble') return 'Ensemble'
  return FORECAST_PROVIDERS.find((p) => p.id === id)?.name ?? SUPPORT_SERVICES.find((s) => s.id === id)?.name ?? id
}
