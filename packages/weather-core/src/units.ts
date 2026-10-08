import type { UnitPreferences } from '@weather/shared-types'

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32
}

export function kmhToMph(kmh: number): number {
  return kmh * 0.621371
}

export function mmToInches(mm: number): number {
  return mm * 0.0393701
}

export function formatTemperature(celsius: number, unit: UnitPreferences['temperature'] = 'celsius'): string {
  const value = unit === 'fahrenheit' ? celsiusToFahrenheit(celsius) : celsius
  return `${Math.round(value)}°${unit === 'fahrenheit' ? 'F' : 'C'}`
}

export function formatWindSpeed(kmh: number, unit: UnitPreferences['windSpeed'] = 'kmh'): string {
  return unit === 'mph' ? `${Math.round(kmhToMph(kmh))} mph` : `${Math.round(kmh)} km/h`
}

export function formatPrecipitation(mm: number, unit: UnitPreferences['precipitation'] = 'mm'): string {
  return unit === 'inch' ? `${(Math.round(mmToInches(mm) * 100) / 100).toFixed(2)} in` : `${Math.round(mm * 10) / 10} mm`
}

export function formatDistance(km: number, unit: UnitPreferences['distance'] = 'km'): string {
  return unit === 'miles' ? `${Math.round(km * 0.621371 * 10) / 10} mi` : `${Math.round(km * 10) / 10} km`
}

export function degreesToCardinal(deg: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(deg / 22.5) % 16
  return directions[index] ?? 'N'
}
