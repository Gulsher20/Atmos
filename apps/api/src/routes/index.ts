import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import type { ProviderStatusInfo } from '@weather/shared-types'
import { config } from '../config'
import { accuracyReport } from '../forecasting/accuracy'
import { cached } from '../lib/cache'
import { fetchJson, getProviderStats } from '../lib/http'
import { deleteSubscription, saveSubscription, sendTestNotification, vapidPublicKey } from '../notifications/push.service'
import { lookupTimezone } from '../providers/open-meteo/open-meteo.provider'
import { searchPlaces } from '../services/geocode.service'
import { FORECAST_PROVIDERS, SUPPORT_SERVICES } from '../providers/registry'
import { AllProvidersFailedError, getDashboard } from '../services/dashboard.service'
import { getHistory } from '../services/history.service'

const Coordinates = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
})

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const PrefsSchema = z.object({
  rain: z.boolean(),
  heat: z.boolean(),
  cold: z.boolean(),
  wind: z.boolean(),
  uv: z.boolean(),
  airQuality: z.boolean(),
  changes: z.boolean(),
  daily: z.boolean(),
})

const SubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  }),
  location: z.object({ name: z.string().min(1).max(120), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }),
  preferences: PrefsSchema,
})

const ReverseSchema = z.object({
  address: z
    .object({
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      hamlet: z.string().optional(),
      county: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  name: z.string().optional(),
})

function fail(reply: FastifyReply, status: number, code: string, message: string) {
  reply.status(status)
  return { success: false as const, error: { code, message } }
}

const ok = <T>(data: T) => ({ success: true as const, data })

export async function registerRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  app.get('/api/geocode', async (request, reply) => {
    const parsed = z.object({ q: z.string().trim().min(2).max(100) }).safeParse(request.query)
    if (!parsed.success) return fail(reply, 400, 'INVALID_QUERY', 'Type at least two characters to search.')
    const query = parsed.data.q.toLowerCase()
    const result = await cached(`geocode:${query}`, config.cache.geocodeMs, () => searchPlaces(query))
    reply.header('Cache-Control', 'public, max-age=3600')
    return ok(result.value)
  })

  app.get('/api/reverse', async (request, reply) => {
    const parsed = Coordinates.safeParse(request.query)
    if (!parsed.success) return fail(reply, 400, 'INVALID_COORDINATES', 'Latitude must be between -90 and 90, and longitude between -180 and 180.')
    const { lat, lon } = parsed.data
    const key = `reverse:${lat.toFixed(3)},${lon.toFixed(3)}`
    const result = await cached(key, config.cache.geocodeMs, async () => {
      const [timezone, place] = await Promise.allSettled([
        lookupTimezone(lat, lon),
        fetchJson('nominatim', `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10&accept-language=en`),
      ])
      const address = place.status === 'fulfilled' ? ReverseSchema.safeParse(place.value.data) : null
      const a = address?.success ? address.data.address : undefined
      const name = a?.city ?? a?.town ?? a?.village ?? a?.hamlet ?? a?.county ?? (address?.success ? address.data.name : undefined)
      return {
        name: name ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
        region: a?.state,
        country: a?.country,
        latitude: lat,
        longitude: lon,
        timezone: timezone.status === 'fulfilled' ? timezone.value : 'UTC',
      }
    })
    return ok(result.value)
  })

  const dashboardHandler = async (request: { query: unknown; log: FastifyInstance['log'] }, reply: FastifyReply) => {
    const parsed = Coordinates.safeParse(request.query)
    if (!parsed.success) return fail(reply, 400, 'INVALID_COORDINATES', 'Latitude must be between -90 and 90, and longitude between -180 and 180.')
    try {
      const data = await getDashboard(parsed.data.lat, parsed.data.lon, {
        onSideEffectError: (error) => request.log.warn({ err: error }, 'Failed to store forecast snapshot'),
      })
      reply.header('Cache-Control', 'private, max-age=300')
      return ok(data)
    } catch (error) {
      if (error instanceof AllProvidersFailedError) {
        return fail(reply, 503, 'WEATHER_PROVIDER_UNAVAILABLE', 'Weather data is currently unavailable from every source. Please try again shortly.')
      }
      throw error
    }
  }
  app.get('/api/weather', dashboardHandler)
  app.get('/api/dashboard', dashboardHandler)

  app.get('/api/history', async (request, reply) => {
    const parsed = Coordinates.extend({ start: IsoDate, end: IsoDate }).safeParse(request.query)
    if (!parsed.success) return fail(reply, 400, 'INVALID_RANGE', 'Provide coordinates and a start/end date (YYYY-MM-DD).')
    const { lat, lon, start, end } = parsed.data
    const today = new Date().toISOString().slice(0, 10)
    const span = (Date.parse(end) - Date.parse(start)) / 86_400_000
    if (start > end || end > today || span > 366 || start < '1940-01-01') {
      return fail(reply, 400, 'INVALID_RANGE', 'Choose a range of up to one year, ending no later than today.')
    }
    reply.header('Cache-Control', 'public, max-age=3600')
    return ok(await getHistory(lat, lon, start, end))
  })

  app.get('/api/accuracy', async (request, reply) => {
    const parsed = Coordinates.extend({
      metric: z.enum(['temperature', 'precipitation', 'wind']).default('temperature'),
      horizon: z.coerce.number().int().refine((h) => [1, 3, 6, 12, 24, 48, 72, 168].includes(h)).default(24),
    }).safeParse(request.query)
    if (!parsed.success) return fail(reply, 400, 'INVALID_QUERY', 'Invalid accuracy filters.')
    const { lat, lon, metric, horizon } = parsed.data
    return ok(await accuracyReport(lat, lon, metric, horizon))
  })

  app.get('/api/providers', async () => {
    const all = [
      ...FORECAST_PROVIDERS.map((p) => ({ id: p.id, name: p.name, capabilities: p.capabilities })),
      ...SUPPORT_SERVICES,
    ]
    const data: ProviderStatusInfo[] = all.map((p) => {
      const s = getProviderStats(p.id)
      const errorRate = s.requests ? s.errors / s.requests : null
      const successes = s.requests - s.errors
      return {
        ...p,
        status: !s.requests ? 'unknown' : errorRate !== null && errorRate > 0.5 ? 'offline' : errorRate !== null && errorRate > 0.1 ? 'degraded' : 'online',
        lastSuccessAt: s.lastSuccessAt ? new Date(s.lastSuccessAt).toISOString() : null,
        lastErrorAt: s.lastErrorAt ? new Date(s.lastErrorAt).toISOString() : null,
        avgResponseMs: successes > 0 ? Math.round(s.totalMs / Math.max(1, s.requests)) : null,
        errorRate: errorRate === null ? null : Math.round(errorRate * 1000) / 1000,
        requests: s.requests,
        rateLimited: !!s.rateLimitedUntil && s.rateLimitedUntil > Date.now(),
      }
    })
    return ok(data)
  })

  app.get('/api/push/key', async () => ok({ publicKey: vapidPublicKey }))

  app.post('/api/push/subscribe', async (request, reply) => {
    const parsed = SubscribeSchema.safeParse(request.body)
    if (!parsed.success) return fail(reply, 400, 'INVALID_SUBSCRIPTION', 'The push subscription is invalid.')
    saveSubscription(parsed.data)
    return ok({ subscribed: true })
  })

  app.delete('/api/push/subscribe', async (request, reply) => {
    const parsed = z.object({ endpoint: z.string().url() }).safeParse(request.body)
    if (!parsed.success) return fail(reply, 400, 'INVALID_SUBSCRIPTION', 'Missing subscription endpoint.')
    deleteSubscription(parsed.data.endpoint)
    return ok({ subscribed: false })
  })

  app.post('/api/push/test', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const parsed = z.object({ endpoint: z.string().url() }).safeParse(request.body)
    if (!parsed.success) return fail(reply, 400, 'INVALID_SUBSCRIPTION', 'Missing subscription endpoint.')
    const sent = await sendTestNotification(parsed.data.endpoint)
    if (!sent) return fail(reply, 404, 'SUBSCRIPTION_NOT_FOUND', 'Enable notifications first, then try again.')
    return ok({ sent })
  })
}
