export interface ProviderCapabilities {
  currentWeather: boolean
  hourlyForecast: boolean
  dailyForecast: boolean
  historicalWeather: boolean
  airQuality: boolean
  precipitation: boolean
  uv: boolean
}

/** Result of one provider call inside a dashboard aggregation. */
export interface ProviderSource {
  id: string
  name: string
  status: 'ok' | 'failed'
  responseMs: number | null
  weight: number // 0-1, share in the ensemble
  error?: string
}

export interface ProviderStatusInfo {
  id: string
  name: string
  capabilities: ProviderCapabilities
  status: 'online' | 'degraded' | 'offline' | 'unknown'
  lastSuccessAt: string | null
  lastErrorAt: string | null
  avgResponseMs: number | null
  errorRate: number | null // 0-1
  requests: number
  rateLimited: boolean
}

export type AccuracyMetric = 'temperature' | 'precipitation' | 'wind'

export interface AccuracyRow {
  providerId: string
  providerName: string
  metric: AccuracyMetric
  horizonHours: number
  mae: number
  rmse: number
  bias: number
  score: number // 0-100
  samples: number
  source: 'backtest' | 'live'
}

export interface ProviderRanking {
  providerId: string
  providerName: string
  score: number
  weight: number
}

export interface AccuracyReport {
  periodStart: string
  periodEnd: string
  rows: AccuracyRow[]
  ranking: ProviderRanking[]
  /** Hourly predicted vs actual series for the selected metric/horizon. */
  comparison: {
    metric: AccuracyMetric
    horizonHours: number
    times: string[]
    actual: (number | null)[]
    predicted: Record<string, (number | null)[]>
  } | null
  liveSamples: number
  notes: string[]
}
