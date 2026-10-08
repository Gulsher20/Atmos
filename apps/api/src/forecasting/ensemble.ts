import type { ConditionGroup, ConditionProbability, DailyForecast, HourlyForecast, WeatherCondition } from '@weather/shared-types'
import { GROUP_CONDITION, conditionGroup } from '@weather/weather-core'
import type { ProviderHour } from '../providers/interfaces/weather-provider'
import type { CurrentAndAstronomy } from '../providers/open-meteo/open-meteo.provider'

export interface ProviderForecast {
  providerId: string
  weight: number
  hours: Map<number, ProviderHour>
}

type NumericKey = Exclude<keyof ProviderHour, 'time' | 'isDay' | 'condition'>

const round1 = (n: number) => Math.round(n * 10) / 10
const GROUP_SEVERITY: Record<ConditionGroup, number> = {
  thunderstorm: 8,
  heavy_rain: 7,
  snow: 6,
  rain: 5,
  drizzle: 4,
  fog: 3,
  cloudy: 2,
  clear: 1,
  unknown: 0,
}

function weightedMean(entries: { value: number | null; weight: number }[]): number | null {
  let sum = 0
  let total = 0
  for (const { value, weight } of entries) {
    if (value === null || !Number.isFinite(value)) continue
    sum += value * weight
    total += weight
  }
  return total > 0 ? sum / total : null
}

function voteGroups(votes: { group: ConditionGroup; weight: number }[]): ConditionProbability[] {
  const totals = new Map<ConditionGroup, number>()
  let all = 0
  for (const v of votes) {
    totals.set(v.group, (totals.get(v.group) ?? 0) + v.weight)
    all += v.weight
  }
  if (all === 0) return [{ group: 'unknown', probability: 100 }]
  return [...totals.entries()]
    .map(([group, w]) => ({ group, probability: Math.round((w / all) * 100) }))
    .sort((a, b) => b.probability - a.probability || GROUP_SEVERITY[b.group] - GROUP_SEVERITY[a.group])
}

function refineCondition(group: ConditionGroup, cloudCover: number | null, members: (WeatherCondition | null)[]): WeatherCondition {
  if (group === 'cloudy') return (cloudCover ?? 50) >= 80 ? 'overcast' : 'partly_cloudy'
  if (group === 'clear') return (cloudCover ?? 0) <= 15 ? 'clear_sky' : 'mainly_clear'
  return members.find((c) => c && conditionGroup(c) === group) ?? GROUP_CONDITION[group]
}

/** Combine hourly forecasts from several providers into a single weighted ensemble. */
export function buildHourlyEnsemble(forecasts: ProviderForecast[], fromTime: number, toTime: number): HourlyForecast[] {
  const result: HourlyForecast[] = []
  for (let time = fromTime; time <= toTime; time += 3600) {
    const members = forecasts
      .map((f) => ({ hour: f.hours.get(time), weight: f.weight }))
      .filter((m): m is { hour: ProviderHour; weight: number } => !!m.hour && m.hour.temperature !== null)
    if (!members.length) continue

    const mean = (key: NumericKey) => weightedMean(members.map((m) => ({ value: m.hour[key], weight: m.weight })))
    const temps = members.map((m) => m.hour.temperature as number)
    const temperature = mean('temperature') ?? 0
    const precipitation = mean('precipitation') ?? 0
    const reportedProbability = mean('precipitationProbability')
    const wetShare = weightedMean(members.map((m) => ({ value: (m.hour.precipitation ?? 0) >= 0.1 ? 100 : 0, weight: m.weight }))) ?? 0
    const precipitationProbability = reportedProbability === null ? wetShare : (reportedProbability + wetShare) / 2

    const votes = members
      .filter((m) => m.hour.condition)
      .map((m) => ({ group: conditionGroup(m.hour.condition as WeatherCondition), weight: m.weight }))
    const top = voteGroups(votes)[0]?.group ?? 'unknown'
    const cloudCover = mean('cloudCover')
    const dayVotes = members.filter((m) => m.hour.isDay !== null)
    const isDay = dayVotes.length ? dayVotes.filter((m) => m.hour.isDay).length >= dayVotes.length / 2 : true

    result.push({
      time: new Date(time * 1000).toISOString(),
      temperature: round1(temperature),
      feelsLike: round1(mean('feelsLike') ?? temperature),
      precipitationProbability: Math.round(precipitationProbability),
      precipitation: round1(precipitation),
      humidity: Math.round(mean('humidity') ?? 0),
      windSpeed: round1(mean('windSpeed') ?? 0),
      windGust: (() => {
        const g = mean('windGust')
        return g === null ? null : round1(g)
      })(),
      uvIndex: round1(mean('uvIndex') ?? 0),
      cloudCover: cloudCover === null ? null : Math.round(cloudCover),
      visibility: (() => {
        const v = mean('visibility')
        return v === null ? null : round1(v)
      })(),
      isDay,
      condition: refineCondition(top, cloudCover, members.map((m) => m.hour.condition)),
      temperatureRange: [round1(Math.min(...temps)), round1(Math.max(...temps))],
      providerCount: members.length,
    })
  }
  return result
}

/** Dominant condition group a single provider predicts for one day. */
function providerDayGroup(hours: ProviderHour[]): ConditionGroup {
  const groups = hours.filter((h) => h.condition).map((h) => conditionGroup(h.condition as WeatherCondition))
  const count = (g: ConditionGroup) => groups.filter((x) => x === g).length
  const rain = hours.reduce((sum, h) => sum + (h.precipitation ?? 0), 0)
  const cloud = weightedMean(hours.map((h) => ({ value: h.cloudCover, weight: 1 }))) ?? 50
  if (count('thunderstorm') >= 1) return 'thunderstorm'
  if (count('snow') >= 2) return 'snow'
  if (rain >= 10) return 'heavy_rain'
  if (rain >= 1) return 'rain'
  if (rain >= 0.2) return 'drizzle'
  if (count('fog') >= 3) return 'fog'
  return cloud < 40 ? 'clear' : 'cloudy'
}

const localDate = (unix: number, offset: number) => new Date((unix + offset) * 1000).toISOString().slice(0, 10)

export function buildDailyEnsemble(
  forecasts: ProviderForecast[],
  hourly: HourlyForecast[],
  astro: CurrentAndAstronomy | null,
  utcOffsetSeconds: number,
  expectedProviders: number,
): DailyForecast[] {
  const byDate = new Map<string, HourlyForecast[]>()
  for (const h of hourly) {
    const date = localDate(Date.parse(h.time) / 1000, utcOffsetSeconds)
    byDate.set(date, [...(byDate.get(date) ?? []), h])
  }

  const days: DailyForecast[] = []
  let dayIndex = 0
  for (const [date, hours] of byDate) {
    if (hours.length < 12 || days.length >= 7) continue

    const providerTempMax: Record<string, number> = {}
    const votes: { group: ConditionGroup; weight: number }[] = []
    for (const f of forecasts) {
      const own = [...f.hours.values()].filter((h) => localDate(h.time, utcOffsetSeconds) === date && h.temperature !== null)
      if (own.length < 12) continue
      providerTempMax[f.providerId] = round1(Math.max(...own.map((h) => h.temperature as number)))
      votes.push({ group: providerDayGroup(own), weight: f.weight })
    }

    const mostLikely = voteGroups(votes)
    const topGroup = mostLikely[0]?.group ?? 'unknown'
    const cloud = weightedMean(hours.map((h) => ({ value: h.cloudCover, weight: 1 })))
    const maxes = Object.values(providerTempMax)
    const spread = maxes.length > 1 ? Math.max(...maxes) - Math.min(...maxes) : 3
    const missing = Math.max(0, expectedProviders - maxes.length)
    const agreement = mostLikely[0]?.probability ?? 50
    const confidence = Math.round(Math.max(5, Math.min(98, 100 - spread * 6 - dayIndex * 4 - (100 - agreement) * 0.3 - missing * 5)))
    const astroDay = astro?.days.find((d) => d.date === date)
    const gusts = hours.map((h) => h.windGust).filter((g): g is number => g !== null)

    days.push({
      date,
      tempMax: round1(Math.max(...hours.map((h) => h.temperature))),
      tempMin: round1(Math.min(...hours.map((h) => h.temperature))),
      feelsLikeMax: round1(Math.max(...hours.map((h) => h.feelsLike))),
      precipitationProbability: Math.max(...hours.map((h) => h.precipitationProbability)),
      precipitationSum: round1(hours.reduce((sum, h) => sum + h.precipitation, 0)),
      humidityMean: Math.round(hours.reduce((sum, h) => sum + h.humidity, 0) / hours.length),
      windSpeedMax: round1(Math.max(...hours.map((h) => h.windSpeed))),
      windGustMax: gusts.length ? round1(Math.max(...gusts)) : null,
      uvIndexMax: round1(Math.max(...hours.map((h) => h.uvIndex))),
      sunrise: astroDay?.sunrise ?? null,
      sunset: astroDay?.sunset ?? null,
      sunshineHours: astroDay?.sunshineHours ?? null,
      condition: refineCondition(topGroup, cloud, hours.map((h) => h.condition)),
      mostLikely,
      confidence,
      confidenceLabel: confidence >= 75 ? 'High' : confidence >= 50 ? 'Moderate' : 'Low',
      providerTempMax,
    })
    dayIndex += 1
  }
  return days
}
