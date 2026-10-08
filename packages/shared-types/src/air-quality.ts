export type AirQualityCategory =
  | 'good'
  | 'moderate'
  | 'unhealthy_sensitive'
  | 'unhealthy'
  | 'very_unhealthy'
  | 'hazardous'

export interface AirQuality {
  aqi: number // US AQI
  category: AirQualityCategory
  pm25: number | null // μg/m³
  pm10: number | null
  no2: number | null
  so2: number | null
  co: number | null
  o3: number | null
  time: string
  /** Max US AQI per upcoming day. */
  forecast: { date: string; aqiMax: number }[]
}

export type AirQualityData = AirQuality
