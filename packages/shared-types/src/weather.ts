// Normalized, provider-agnostic weather model.

export type WeatherSeverity = 'normal' | 'moderate' | 'severe' | 'extreme'

export type WeatherCondition =
  | 'clear_sky'
  | 'mainly_clear'
  | 'partly_cloudy'
  | 'overcast'
  | 'fog'
  | 'depositing_rime_fog'
  | 'light_drizzle'
  | 'moderate_drizzle'
  | 'dense_drizzle'
  | 'light_freezing_drizzle'
  | 'dense_freezing_drizzle'
  | 'slight_rain'
  | 'moderate_rain'
  | 'heavy_rain'
  | 'light_freezing_rain'
  | 'heavy_freezing_rain'
  | 'slight_snow'
  | 'moderate_snow'
  | 'heavy_snow'
  | 'snow_grains'
  | 'slight_rain_showers'
  | 'moderate_rain_showers'
  | 'violent_rain_showers'
  | 'slight_snow_showers'
  | 'heavy_snow_showers'
  | 'thunderstorm'
  | 'thunderstorm_slight_hail'
  | 'thunderstorm_heavy_hail'
  | 'unknown'

/** Coarse grouping used for backgrounds, voting and rules. */
export type ConditionGroup = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavy_rain' | 'snow' | 'thunderstorm' | 'unknown'

export interface CurrentWeather {
  time: string // ISO 8601 UTC
  temperature: number // °C
  feelsLike: number // °C
  humidity: number // %
  pressure: number | null // hPa
  windSpeed: number // km/h
  windGust: number | null // km/h
  windDirection: number | null // degrees
  precipitation: number // mm (last hour)
  cloudCover: number | null // %
  visibility: number | null // km
  uvIndex: number
  isDay: boolean
  condition: WeatherCondition
}
