import type { ProviderCapabilities, WeatherCondition } from '@weather/shared-types'

/** One normalized forecast hour. Every field may be missing for some providers. */
export interface ProviderHour {
  time: number // unix seconds, UTC
  temperature: number | null
  feelsLike: number | null
  humidity: number | null
  precipitation: number | null
  precipitationProbability: number | null
  windSpeed: number | null // km/h
  windGust: number | null
  windDirection: number | null
  cloudCover: number | null
  uvIndex: number | null
  visibility: number | null // km
  pressure: number | null
  isDay: boolean | null
  condition: WeatherCondition | null
}

export interface PastForecastSeries {
  horizonHours: number
  times: number[]
  temperature: (number | null)[]
  precipitation: (number | null)[]
  wind: (number | null)[]
}

export interface ForecastFetch {
  hours: ProviderHour[]
  ms: number
}

export interface WeatherProvider {
  readonly id: string
  readonly name: string
  readonly capabilities: ProviderCapabilities
  getHourlyForecast(latitude: number, longitude: number): Promise<ForecastFetch>
  /** Archived forecasts issued `horizon` hours before each target time, if the provider keeps them. */
  getPastForecasts?(latitude: number, longitude: number, start: string, end: string): Promise<PastForecastSeries[]>
}
