export type TrendType =
  | 'warming'
  | 'cooling'
  | 'rain_increasing'
  | 'rain_decreasing'
  | 'wind_increasing'
  | 'wind_decreasing'
  | 'humidity_increasing'
  | 'uv_increasing'
  | 'air_quality_worsening'
  | 'air_quality_improving'

export interface WeatherTrend {
  id: string
  type: TrendType
  severity: 'low' | 'medium' | 'high'
  icon: string
  title: string
  message: string
  startDate: string
  endDate: string
}

export type AlertType =
  | 'heavy_rain'
  | 'rain'
  | 'extreme_heat'
  | 'extreme_cold'
  | 'high_wind'
  | 'thunderstorm'
  | 'high_uv'
  | 'poor_air_quality'
  | 'snow'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface WeatherAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  icon: string
  title: string
  message: string
  date: string
}

export type NotificationPreferenceKey =
  | 'rain'
  | 'heat'
  | 'cold'
  | 'wind'
  | 'uv'
  | 'airQuality'
  | 'changes'
  | 'daily'

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>

export interface PushSubscribeRequest {
  subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  location: { name: string; latitude: number; longitude: number }
  preferences: NotificationPreferences
}
