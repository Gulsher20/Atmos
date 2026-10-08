import { config } from '../config'

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly providerId: string,
    readonly status?: number,
  ) {
    super(message)
  }
}

interface ProviderCallStats {
  requests: number
  errors: number
  totalMs: number
  lastSuccessAt: number | null
  lastErrorAt: number | null
  rateLimitedUntil: number | null
}

const stats = new Map<string, ProviderCallStats>()

function statsFor(providerId: string): ProviderCallStats {
  let entry = stats.get(providerId)
  if (!entry) {
    entry = { requests: 0, errors: 0, totalMs: 0, lastSuccessAt: null, lastErrorAt: null, rateLimitedUntil: null }
    stats.set(providerId, entry)
  }
  return entry
}

export function getProviderStats(providerId: string): ProviderCallStats {
  return { ...statsFor(providerId) }
}

const isTransient = (error: unknown) => error instanceof UpstreamError && error.status !== 429 && (error.status === undefined || error.status >= 500)

/**
 * Fetch JSON from an upstream provider with timeout, error mapping and call statistics.
 * Network errors, timeouts and 5xx responses are retried once after a short jittered pause.
 */
export async function fetchJson(providerId: string, url: string, timeoutMs = 12_000): Promise<{ data: unknown; ms: number }> {
  try {
    return await fetchOnce(providerId, url, timeoutMs)
  } catch (error) {
    if (!isTransient(error)) throw error
    await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 600))
    return fetchOnce(providerId, url, timeoutMs)
  }
}

async function fetchOnce(providerId: string, url: string, timeoutMs: number): Promise<{ data: unknown; ms: number }> {
  const entry = statsFor(providerId)
  if (entry.rateLimitedUntil && entry.rateLimitedUntil > Date.now()) {
    throw new UpstreamError('Provider rate limit cooling down', providerId, 429)
  }

  const started = performance.now()
  entry.requests += 1
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': config.userAgent, Accept: 'application/json' },
    })
    const ms = Math.round(performance.now() - started)
    entry.totalMs += ms
    if (response.status === 429) {
      entry.rateLimitedUntil = Date.now() + 60_000
      throw new UpstreamError('Rate limited by provider', providerId, 429)
    }
    if (!response.ok) throw new UpstreamError(`Provider responded with ${response.status}`, providerId, response.status)
    const data: unknown = await response.json()
    entry.lastSuccessAt = Date.now()
    return { data, ms }
  } catch (error) {
    entry.errors += 1
    entry.lastErrorAt = Date.now()
    if (error instanceof UpstreamError) throw error
    const message = error instanceof Error && error.name === 'TimeoutError' ? 'Provider timed out' : 'Provider unreachable'
    throw new UpstreamError(message, providerId)
  }
}
