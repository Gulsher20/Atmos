export interface WeatherLocation {
  id: string
  name: string
  country?: string
  region?: string
  latitude: number
  longitude: number
  timezone: string
  createdAt: string
  isDefault?: boolean
}

export interface GeocodingResult {
  id: string
  name: string
  country?: string
  region?: string
  latitude: number
  longitude: number
  timezone: string
  population?: number
}
