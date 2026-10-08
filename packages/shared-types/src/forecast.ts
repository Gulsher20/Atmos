import type { ConditionGroup, WeatherCondition } from './weather'

export interface HourlyForecast {
  time: string // ISO 8601 UTC
  temperature: number
  feelsLike: number
  precipitationProbability: number // %
  precipitation: number // mm
  humidity: number
  windSpeed: number
  windGust: number | null
  uvIndex: number
  cloudCover: number | null
  visibility: number | null
  isDay: boolean
  condition: WeatherCondition
  /** Lowest / highest temperature predicted by any provider for this hour. */
  temperatureRange: [number, number] | null
  providerCount: number
}

export interface ConditionProbability {
  group: ConditionGroup
  probability: number // 0-100, weighted share of providers
}

export interface DailyForecast {
  date: string // YYYY-MM-DD in location timezone
  tempMax: number
  tempMin: number
  feelsLikeMax: number
  precipitationProbability: number
  precipitationSum: number
  humidityMean: number
  windSpeedMax: number
  windGustMax: number | null
  uvIndexMax: number
  sunrise: string | null
  sunset: string | null
  sunshineHours: number | null
  condition: WeatherCondition
  mostLikely: ConditionProbability[]
  confidence: number // 0-100
  confidenceLabel: 'High' | 'Moderate' | 'Low'
  /** Daily max temperature per provider id, for spread display. */
  providerTempMax: Record<string, number>
}
