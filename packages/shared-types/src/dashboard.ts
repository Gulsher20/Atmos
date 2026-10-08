import type { AirQuality } from './air-quality'
import type { DailyForecast, HourlyForecast } from './forecast'
import type { WeatherAlert, WeatherTrend } from './insights'
import type { ProviderSource } from './provider'
import type { Recommendations } from './recommendation'
import type { CurrentWeather } from './weather'

export interface DataMeta {
  fetchedAt: string
  source: string
  cached: boolean
  stale: boolean
}

export interface Dashboard {
  location: { latitude: number; longitude: number; timezone: string; utcOffsetSeconds: number }
  current: CurrentWeather
  hourly: HourlyForecast[]
  daily: DailyForecast[]
  airQuality: AirQuality | null
  trends: WeatherTrend[]
  alerts: WeatherAlert[]
  recommendations: Recommendations
  explanation: string[]
  sources: ProviderSource[]
  meta: DataMeta
}

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiFailure {
  success: false
  error: { code: string; message: string }
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure
