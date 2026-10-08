import type { AirQuality, Dashboard, ProviderSource } from '@weather/shared-types'
import { generateRecommendations } from '@weather/recommendation-engine'
import { config } from '../config'
import { cached, locationKey } from '../lib/cache'
import { providerWeights, recordObservation, recordPredictions, trackLocation } from '../forecasting/accuracy'
import { buildDailyEnsemble, buildHourlyEnsemble, type ProviderForecast } from '../forecasting/ensemble'
import { detectAlerts, detectTrends, explainForecast } from '../forecasting/insights'
import { fetchAirQuality, fetchCurrentAndAstronomy } from '../providers/open-meteo/open-meteo.provider'
import { FORECAST_PROVIDERS } from '../providers/registry'
import { getActivityContext, unknownActivityContext } from './activity-context.service'

export class AllProvidersFailedError extends Error {}

const DEGRADED_TTL_MS = 60_000
/** Last known timezone per location, so a failed astronomy call doesn't shift days to UTC. */
const knownZones = new Map<string, { timezone: string; utcOffsetSeconds: number }>()

const isDegraded = (d: Dashboard) =>
  d.sources.some((s) => s.status === 'failed' && s.id !== 'open-meteo-air') ||
  d.recommendations.activities.some((a) => a.availability === 'unknown')

async function buildDashboard(latitude: number, longitude: number, onSideEffectError: (error: unknown) => void): Promise<Dashboard> {
  const locKey = locationKey(latitude, longitude)
  const weights = providerWeights(locKey)

  const [astroResult, airResult, activityResult, ...forecastResults] = await Promise.allSettled([
    fetchCurrentAndAstronomy(latitude, longitude),
    cached(`air:${locKey}`, config.cache.airQualityMs, () => fetchAirQuality(latitude, longitude)),
    getActivityContext(latitude, longitude),
    ...FORECAST_PROVIDERS.map((p) => p.getHourlyForecast(latitude, longitude)),
  ])

  const sources: ProviderSource[] = []
  const forecasts: ProviderForecast[] = []
  forecastResults.forEach((result, i) => {
    const provider = FORECAST_PROVIDERS[i]!
    if (result.status === 'fulfilled') {
      forecasts.push({ providerId: provider.id, weight: weights.get(provider.id) ?? 0, hours: new Map(result.value.hours.map((h) => [h.time, h])) })
      sources.push({ id: provider.id, name: provider.name, status: 'ok', responseMs: result.value.ms, weight: weights.get(provider.id) ?? 0 })
    } else {
      sources.push({ id: provider.id, name: provider.name, status: 'failed', responseMs: null, weight: 0, error: 'Unavailable right now' })
    }
  })
  if (!forecasts.length) throw new AllProvidersFailedError('All weather providers failed')

  // Re-normalize weights across the providers that actually answered.
  const totalWeight = forecasts.reduce((sum, f) => sum + f.weight, 0) || 1
  for (const f of forecasts) f.weight /= totalWeight
  for (const s of sources) if (s.status === 'ok') s.weight = Math.round((s.weight / totalWeight) * 1000) / 1000

  const astro = astroResult.status === 'fulfilled' ? astroResult.value : null
  sources.push({ id: 'open-meteo', name: 'Open-Meteo current', status: astro ? 'ok' : 'failed', responseMs: astro?.ms ?? null, weight: 0 })
  const airQuality: AirQuality | null = airResult.status === 'fulfilled' ? airResult.value.value.value : null
  sources.push({
    id: 'open-meteo-air',
    name: 'Open-Meteo Air Quality',
    status: airQuality ? 'ok' : 'failed',
    responseMs: airResult.status === 'fulfilled' ? airResult.value.value.ms : null,
    weight: 0,
  })

  if (astro) knownZones.set(locKey, { timezone: astro.timezone, utcOffsetSeconds: astro.utcOffsetSeconds })
  const zone = knownZones.get(locKey) ?? { timezone: 'UTC', utcOffsetSeconds: 0 }
  const offset = zone.utcOffsetSeconds
  const nowHour = Math.floor(Date.now() / 3_600_000) * 3600
  const localMidnight = Math.floor((nowHour + offset) / 86_400) * 86_400 - offset
  const allHours = buildHourlyEnsemble(forecasts, localMidnight, localMidnight + 8 * 86_400)
  const hourly = allHours.filter((h) => Date.parse(h.time) / 1000 >= nowHour).slice(0, 48)
  const daily = buildDailyEnsemble(forecasts, allHours, astro, offset, FORECAST_PROVIDERS.length)

  const first = hourly[0]
  const current = astro?.current ?? {
    time: new Date(nowHour * 1000).toISOString(),
    temperature: first?.temperature ?? 0,
    feelsLike: first?.feelsLike ?? 0,
    humidity: first?.humidity ?? 0,
    pressure: null,
    windSpeed: first?.windSpeed ?? 0,
    windGust: first?.windGust ?? null,
    windDirection: null,
    precipitation: first?.precipitation ?? 0,
    cloudCover: first?.cloudCover ?? null,
    visibility: first?.visibility ?? null,
    uvIndex: first?.uvIndex ?? 0,
    isDay: first?.isDay ?? true,
    condition: first?.condition ?? 'unknown',
  }

  try {
    trackLocation(locKey, latitude, longitude, null)
    recordPredictions(locKey, forecasts, hourly)
    if (astro) recordObservation(locKey, astro.current)
  } catch (error) {
    onSideEffectError(error)
  }

  return {
    location: { latitude, longitude, timezone: zone.timezone, utcOffsetSeconds: offset },
    current,
    hourly,
    daily,
    airQuality,
    trends: detectTrends(daily, airQuality),
    alerts: detectAlerts(current, hourly, daily, airQuality, offset),
    recommendations: generateRecommendations({
      current,
      hourly,
      aqi: airQuality?.aqi ?? null,
      activityContext: activityResult.status === 'fulfilled' ? activityResult.value : unknownActivityContext(),
    }),
    explanation: explainForecast(daily),
    sources,
    meta: { fetchedAt: new Date().toISOString(), source: 'ensemble', cached: false, stale: false },
  }
}

export async function getDashboard(
  latitude: number,
  longitude: number,
  options: { force?: boolean; onSideEffectError?: (error: unknown) => void } = {},
): Promise<Dashboard> {
  const result = await cached(
    `dashboard:${locationKey(latitude, longitude)}`,
    (value) => (isDegraded(value) ? DEGRADED_TTL_MS : config.cache.dashboardMs),
    () => buildDashboard(latitude, longitude, options.onSideEffectError ?? (() => undefined)),
    options.force,
  )
  return {
    ...result.value,
    meta: { fetchedAt: new Date(result.fetchedAt).toISOString(), source: 'ensemble', cached: result.cached, stale: result.stale },
  }
}
