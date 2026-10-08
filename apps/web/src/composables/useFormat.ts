import { storeToRefs } from 'pinia'
import { celsiusToFahrenheit, formatDistance, formatPrecipitation, formatWindSpeed } from '@weather/weather-core'
import { useSettingsStore } from '@/stores/settings.store'

function safeFormat(options: Intl.DateTimeFormatOptions, timeZone: string | undefined, date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(date)
  }
}

export function useFormat() {
  const { units } = storeToRefs(useSettingsStore())

  const tempValue = (c: number) => Math.round(units.value.temperature === 'fahrenheit' ? celsiusToFahrenheit(c) : c)
  const temp = (c: number | null | undefined) => (c === null || c === undefined ? '—' : `${tempValue(c)}°`)
  const tempUnit = () => (units.value.temperature === 'fahrenheit' ? '°F' : '°C')
  const tempDelta = (c: number) => Math.round(units.value.temperature === 'fahrenheit' ? c * 1.8 : c)
  const wind = (kmh: number | null | undefined) => (kmh === null || kmh === undefined ? '—' : formatWindSpeed(kmh, units.value.windSpeed))
  const precip = (mm: number | null | undefined) => (mm === null || mm === undefined ? '—' : formatPrecipitation(mm, units.value.precipitation))
  const distance = (km: number | null | undefined) => (km === null || km === undefined ? '—' : formatDistance(km, units.value.distance))

  const hour = (iso: string, timeZone?: string) => safeFormat({ hour: 'numeric' }, timeZone, new Date(iso))
  const clock = (iso: string | null | undefined, timeZone?: string) => (iso ? safeFormat({ hour: 'numeric', minute: '2-digit' }, timeZone, new Date(iso)) : '—')
  const weekday = (date: string, style: 'short' | 'long' = 'short') => safeFormat({ weekday: style }, 'UTC', new Date(`${date}T12:00:00Z`))
  const shortDate = (date: string) => safeFormat({ month: 'short', day: 'numeric' }, 'UTC', new Date(`${date}T12:00:00Z`))
  const dayLabel = (date: string, index: number) => (index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : weekday(date, 'long'))

  const ago = (ms: number | null, now: number = Date.now()) => {
    if (!ms) return 'never'
    const minutes = Math.round((now - ms) / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`
  }

  return { temp, tempValue, tempUnit, tempDelta, wind, precip, distance, hour, clock, weekday, shortDate, dayLabel, ago }
}
