import type { HistoryDay, HistoryReport, HistorySummary } from '@weather/shared-types'
import { config } from '../config'
import { cached, locationKey } from '../lib/cache'
import { fetchDailyHistory } from '../providers/open-meteo/open-meteo.provider'

const DAY = 86_400_000
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const round1 = (n: number) => Math.round(n * 10) / 10

type DailyHistory = Awaited<ReturnType<typeof fetchDailyHistory>>

function toDays(raw: DailyHistory): HistoryDay[] {
  const d = raw.daily
  const at = (key: string, i: number) => d[key]?.[i] ?? null
  return d.time.map((date, i) => {
    const sunshine = at('sunshine_duration', i)
    return {
      date,
      tempMax: at('temperature_2m_max', i),
      tempMin: at('temperature_2m_min', i),
      tempMean: at('temperature_2m_mean', i),
      precipitation: at('precipitation_sum', i),
      rain: at('rain_sum', i),
      snowfall: at('snowfall_sum', i),
      sunshineHours: sunshine === null ? null : round1(sunshine / 3600),
      windMax: at('wind_speed_10m_max', i),
      gustMax: at('wind_gusts_10m_max', i),
      humidity: at('relative_humidity_2m_mean', i),
      cloudCover: at('cloud_cover_mean', i),
    }
  })
}

/** Fetch [start, end]: ERA5 archive for older days, forecast API for the most recent ~week. */
async function fetchRange(lat: number, lon: number, start: string, end: string, withHourly: boolean) {
  const archiveLimit = isoDate(Date.now() - 6 * DAY)
  const parts: Promise<DailyHistory>[] = []
  if (start <= archiveLimit) parts.push(fetchDailyHistory('archive', lat, lon, start, end < archiveLimit ? end : archiveLimit, withHourly))
  if (end > archiveLimit) {
    const recentStart = start > archiveLimit ? start : isoDate(Date.parse(archiveLimit) + DAY)
    parts.push(fetchDailyHistory('recent', lat, lon, recentStart, end, withHourly))
  }
  const results = await Promise.all(parts)
  const days = results.flatMap(toDays)
  const hourly = results.flatMap((r) => (r.hourly ? r.hourly.time.map((t, i) => ({ time: t, wind: r.hourly?.wind_speed_10m?.[i] ?? null })) : []))
  return { days, hourly }
}

function mean(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null)
  return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null
}

function summarize(days: HistoryDay[]): HistorySummary {
  const precip = days.map((d) => d.precipitation).filter((x): x is number => x !== null)
  const sun = days.map((d) => d.sunshineHours).filter((x): x is number => x !== null)
  return {
    avgTemp: mean(days.map((d) => d.tempMean)),
    totalPrecipitation: precip.length ? round1(precip.reduce((a, b) => a + b, 0)) : null,
    avgWind: mean(days.map((d) => d.windMax)),
    sunshineHours: sun.length ? round1(sun.reduce((a, b) => a + b, 0)) : null,
    rainyDays: precip.filter((p) => p >= 1).length,
  }
}

function slopePerDay(values: number[]): number {
  const n = values.length
  if (n < 3) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean)
    den += (x - xMean) ** 2
  })
  return den ? num / den : 0
}

function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}

function buildInsights(days: HistoryDay[], summary: HistorySummary, previous: HistorySummary | null, hourly: { time: string; wind: number | null }[]): string[] {
  const insights: string[] = []
  const span = days.length
  if (summary.avgTemp !== null) insights.push(`Average temperature over these ${span} days: ${summary.avgTemp}°C.`)
  if (summary.totalPrecipitation !== null) insights.push(`Total rainfall: ${summary.totalPrecipitation} mm across ${summary.rainyDays} rainy day${summary.rainyDays === 1 ? '' : 's'}.`)

  if (previous) {
    if (summary.avgTemp !== null && previous.avgTemp !== null) {
      const d = round1(summary.avgTemp - previous.avgTemp)
      insights.push(`Compared with the previous ${span} days: ${d >= 0 ? '+' : ''}${d}°C ${d >= 0 ? 'warmer' : 'cooler'}.`)
    }
    const rain = percentChange(summary.totalPrecipitation, previous.totalPrecipitation)
    if (rain !== null) insights.push(`Rainfall was ${Math.abs(rain)}% ${rain >= 0 ? 'higher' : 'lower'} than the previous period.`)
    const wind = percentChange(summary.avgWind, previous.avgWind)
    if (wind !== null) insights.push(`Wind was ${Math.abs(wind)}% ${wind >= 0 ? 'stronger' : 'weaker'} than the previous period.`)
  }

  const recent = days.slice(-10).map((d) => d.tempMean).filter((x): x is number => x !== null)
  const change = slopePerDay(recent) * (recent.length - 1)
  if (recent.length >= 5) {
    if (change >= 2) insights.push(`Temperatures have been increasing over the last ${recent.length} days.`)
    else if (change <= -2) insights.push(`Temperatures have been decreasing over the last ${recent.length} days.`)
    else insights.push(`Temperatures have been fairly stable over the last ${recent.length} days.`)
  }

  const wettest = [...days].sort((a, b) => (b.precipitation ?? 0) - (a.precipitation ?? 0))[0]
  if (wettest?.precipitation) insights.push(`Wettest day: ${wettest.date} with ${round1(wettest.precipitation)} mm.`)
  const sunniest = [...days].sort((a, b) => (b.sunshineHours ?? 0) - (a.sunshineHours ?? 0))[0]
  if (sunniest?.sunshineHours) insights.push(`Sunniest day: ${sunniest.date} with ${sunniest.sunshineHours} hours of sunshine.`)

  if (hourly.length >= 72) {
    const byHour = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }))
    for (const h of hourly) {
      if (h.wind === null) continue
      const slot = byHour[Number(h.time.slice(11, 13))]!
      slot.sum += h.wind
      slot.n += 1
    }
    const avg = byHour.map((s) => (s.n ? s.sum / s.n : 0))
    let best = 0
    for (let i = 0; i < 24; i += 1) {
      const window = avg[i]! + avg[(i + 1) % 24]! + avg[(i + 2) % 24]!
      const top = avg[best]! + avg[(best + 1) % 24]! + avg[(best + 2) % 24]!
      if (window > top) best = i
    }
    const pad = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
    insights.push(`Wind speeds were highest between ${pad(best)} and ${pad(best + 3)}.`)
  }

  return insights
}

export async function getHistory(latitude: number, longitude: number, start: string, end: string): Promise<HistoryReport> {
  const key = `history:${locationKey(latitude, longitude)}:${start}:${end}`
  const result = await cached(key, config.cache.historyMs, async () => {
    const span = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1
    const prevStart = isoDate(Date.parse(start) - span * DAY)
    const { days: all, hourly } = await fetchRange(latitude, longitude, prevStart, end, span <= 92)
    const days = all.filter((d) => d.date >= start)
    const prevDays = all.filter((d) => d.date < start)
    const summary = summarize(days)
    const previous = prevDays.length ? summarize(prevDays) : null
    const ownHourly = hourly.filter((h) => h.time.slice(0, 10) >= start)
    return { start, end, days, summary, previous, insights: buildInsights(days, summary, previous, ownHourly) }
  })
  return result.value
}
