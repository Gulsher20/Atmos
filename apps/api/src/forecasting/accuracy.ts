import type { AccuracyMetric, AccuracyReport, AccuracyRow, CurrentWeather, HourlyForecast, ProviderRanking } from '@weather/shared-types'
import { config } from '../config'
import { db } from '../database/db'
import { cached, locationKey } from '../lib/cache'
import type { ProviderHour } from '../providers/interfaces/weather-provider'
import { fetchArchiveHourly } from '../providers/open-meteo/open-meteo.provider'
import { FORECAST_PROVIDERS, providerName } from '../providers/registry'

export const HORIZONS = [1, 3, 6, 12, 24, 48, 72, 168]
export const BACKTEST_HORIZONS = [24, 48, 72]
const METRICS: AccuracyMetric[] = ['temperature', 'precipitation', 'wind']

/** Points of accuracy score lost per unit of mean absolute error. */
export const SCORE_SCALE: Record<AccuracyMetric, number> = { temperature: 6, precipitation: 30, wind: 4 }

const round2 = (n: number) => Math.round(n * 100) / 100

export function scoreFromMae(metric: AccuracyMetric, mae: number): number {
  return Math.max(0, Math.min(100, Math.round((100 - mae * SCORE_SCALE[metric]) * 10) / 10))
}

function errorStats(pairs: [number, number][]) {
  const n = pairs.length
  let abs = 0
  let sq = 0
  let bias = 0
  for (const [predicted, actual] of pairs) {
    const e = predicted - actual
    abs += Math.abs(e)
    sq += e * e
    bias += e
  }
  return { mae: round2(abs / n), rmse: round2(Math.sqrt(sq / n)), bias: round2(bias / n), samples: n }
}

const upsertMetric = db.prepare(`
  INSERT INTO provider_metrics (provider_id, loc_key, metric, horizon_hours, source, mae, rmse, bias, score, samples, period_start, period_end, computed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (provider_id, loc_key, metric, horizon_hours, source) DO UPDATE SET
    mae = excluded.mae, rmse = excluded.rmse, bias = excluded.bias, score = excluded.score, samples = excluded.samples,
    period_start = excluded.period_start, period_end = excluded.period_end, computed_at = excluded.computed_at
`)

function persistRows(locKey: string, rows: AccuracyRow[], start: string, end: string) {
  const now = Date.now()
  for (const r of rows) {
    upsertMetric.run(r.providerId, locKey, r.metric, r.horizonHours, r.source, r.mae, r.rmse, r.bias, r.score, r.samples, start, end, now)
  }
}

// ---------- Recording ----------

const insertPrediction = db.prepare(`
  INSERT OR IGNORE INTO forecast_predictions
    (provider_id, loc_key, issued_at, target_time, horizon_hours, temperature, precipitation, wind_speed, humidity, condition)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

/** Store one forecast snapshot per provider for each tracked horizon. */
export function recordPredictions(
  locKey: string,
  forecasts: { providerId: string; hours: Map<number, ProviderHour> }[],
  ensemble: HourlyForecast[],
): void {
  const issuedAt = Math.floor(Date.now() / 3_600_000) * 3600
  const ensembleByTime = new Map(ensemble.map((h) => [Math.floor(Date.parse(h.time) / 1000), h]))
  db.exec('BEGIN')
  try {
    for (const horizon of HORIZONS) {
      const target = issuedAt + horizon * 3600
      for (const f of forecasts) {
        const h = f.hours.get(target)
        if (!h || h.temperature === null) continue
        insertPrediction.run(f.providerId, locKey, issuedAt, target, horizon, h.temperature, h.precipitation, h.windSpeed, h.humidity, h.condition)
      }
      const e = ensembleByTime.get(target)
      if (e) insertPrediction.run('ensemble', locKey, issuedAt, target, horizon, e.temperature, e.precipitation, e.windSpeed, e.humidity, e.condition)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

const insertObservation = db.prepare(`
  INSERT OR IGNORE INTO weather_observations (loc_key, time, temperature, precipitation, wind_speed, humidity, condition, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

/** Store the observed (analysed) weather for the nearest whole hour. */
export function recordObservation(locKey: string, current: CurrentWeather): void {
  const time = Math.round(Date.parse(current.time) / 3_600_000) * 3600
  insertObservation.run(locKey, time, current.temperature, current.precipitation, current.windSpeed, current.humidity, current.condition, 'open-meteo-current')
}

export function trackLocation(locKey: string, latitude: number, longitude: number, name: string | null): void {
  db.prepare(
    `INSERT INTO tracked_locations (loc_key, name, latitude, longitude, last_requested_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (loc_key) DO UPDATE SET last_requested_at = excluded.last_requested_at, name = COALESCE(excluded.name, tracked_locations.name)`,
  ).run(locKey, name, latitude, longitude, Date.now())
}

export function activeLocations(days = 7): { loc_key: string; latitude: number; longitude: number }[] {
  return db
    .prepare('SELECT loc_key, latitude, longitude FROM tracked_locations WHERE last_requested_at > ?')
    .all(Date.now() - days * 86_400_000) as { loc_key: string; latitude: number; longitude: number }[]
}

// ---------- Live evaluation (stored predictions vs stored observations) ----------

interface JoinedRow {
  provider_id: string
  horizon_hours: number
  pt: number | null
  ot: number | null
  pp: number | null
  op: number | null
  pw: number | null
  ow: number | null
}

export function evaluateLive(locKey: string): AccuracyRow[] {
  const joined = db
    .prepare(
      `SELECT p.provider_id, p.horizon_hours, p.temperature pt, o.temperature ot, p.precipitation pp, o.precipitation op,
              p.wind_speed pw, o.wind_speed ow
       FROM forecast_predictions p
       JOIN weather_observations o ON o.loc_key = p.loc_key AND o.time = p.target_time
       WHERE p.loc_key = ?`,
    )
    .all(locKey) as unknown as JoinedRow[]

  const groups = new Map<string, Record<AccuracyMetric, [number, number][]>>()
  for (const r of joined) {
    const key = `${r.provider_id}|${r.horizon_hours}`
    const g = groups.get(key) ?? { temperature: [], precipitation: [], wind: [] }
    if (r.pt !== null && r.ot !== null) g.temperature.push([r.pt, r.ot])
    if (r.pp !== null && r.op !== null) g.precipitation.push([r.pp, r.op])
    if (r.pw !== null && r.ow !== null) g.wind.push([r.pw, r.ow])
    groups.set(key, g)
  }

  const rows: AccuracyRow[] = []
  for (const [key, g] of groups) {
    const [providerId = '', horizon = '0'] = key.split('|')
    for (const metric of METRICS) {
      if (!g[metric].length) continue
      const s = errorStats(g[metric])
      rows.push({ providerId, providerName: providerName(providerId), metric, horizonHours: Number(horizon), ...s, score: scoreFromMae(metric, s.mae), source: 'live' })
    }
  }
  if (rows.length) persistRows(locKey, rows, 'live', new Date().toISOString())
  return rows
}

// ---------- Back-test (archived model runs vs ERA5 reanalysis) ----------

interface BacktestResult {
  start: string
  end: string
  rows: AccuracyRow[]
  times: number[]
  actual: Record<AccuracyMetric, (number | null)[]>
  predicted: Record<string, Record<number, Record<AccuracyMetric, (number | null)[]>>>
  failed: string[]
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

async function computeBacktest(latitude: number, longitude: number): Promise<BacktestResult> {
  // ERA5 lags real time by about five days, so the window ends six days ago.
  const end = new Date(Date.now() - 6 * 86_400_000)
  const start = new Date(end.getTime() - 13 * 86_400_000)
  const startStr = isoDate(start)
  const endStr = isoDate(end)

  const truth = await fetchArchiveHourly(latitude, longitude, startStr, endStr)
  const times = truth.time
  const actual: BacktestResult['actual'] = {
    temperature: truth.temperature_2m ?? [],
    precipitation: truth.precipitation ?? [],
    wind: truth.wind_speed_10m ?? [],
  }
  const index = new Map(times.map((t, i) => [t, i]))

  const rows: AccuracyRow[] = []
  const predicted: BacktestResult['predicted'] = {}
  const failed: string[] = []
  const models = FORECAST_PROVIDERS.filter((p) => p.getPastForecasts)
  const results = await Promise.allSettled(models.map((p) => p.getPastForecasts!(latitude, longitude, startStr, endStr)))

  results.forEach((result, i) => {
    const provider = models[i]!
    if (result.status === 'rejected') {
      failed.push(provider.name)
      return
    }
    predicted[provider.id] = {}
    for (const series of result.value) {
      const aligned: Record<AccuracyMetric, (number | null)[]> = {
        temperature: times.map(() => null),
        precipitation: times.map(() => null),
        wind: times.map(() => null),
      }
      series.times.forEach((t, j) => {
        const k = index.get(t)
        if (k === undefined) return
        aligned.temperature[k] = series.temperature[j] ?? null
        aligned.precipitation[k] = series.precipitation[j] ?? null
        aligned.wind[k] = series.wind[j] ?? null
      })
      predicted[provider.id]![series.horizonHours] = aligned
      for (const metric of METRICS) {
        const pairs: [number, number][] = []
        aligned[metric].forEach((p, k) => {
          const a = actual[metric][k]
          if (p !== null && p !== undefined && a !== null && a !== undefined) pairs.push([p, a])
        })
        if (pairs.length < 24) continue
        const s = errorStats(pairs)
        rows.push({ providerId: provider.id, providerName: provider.name, metric, horizonHours: series.horizonHours, ...s, score: scoreFromMae(metric, s.mae), source: 'backtest' })
      }
    }
  })

  persistRows(locationKey(latitude, longitude), rows, startStr, endStr)
  return { start: startStr, end: endStr, rows, times, actual, predicted, failed }
}

export function runBacktest(latitude: number, longitude: number) {
  return cached(`backtest:${locationKey(latitude, longitude)}`, config.cache.backtestMs, () => computeBacktest(latitude, longitude))
}

// ---------- Weights and ranking ----------

/**
 * Ensemble weights by inverse-variance weighting (w ∝ 1 / MAE²) of 24h temperature error,
 * sample-weighted across back-test and live data. Equal weights until data exists.
 */
export function providerWeights(locKey: string): Map<string, number> {
  const rows = db
    .prepare(
      `SELECT provider_id, SUM(mae * samples) / SUM(samples) AS mae
       FROM provider_metrics WHERE loc_key = ? AND horizon_hours = 24 AND metric = 'temperature' GROUP BY provider_id`,
    )
    .all(locKey) as { provider_id: string; mae: number }[]
  const errors = new Map(rows.map((r) => [r.provider_id, Math.max(r.mae, 0.3)]))
  const known = [...errors.values()]
  const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1
  const raw = FORECAST_PROVIDERS.map((p) => [p.id, 1 / (errors.get(p.id) ?? fallback) ** 2] as const)
  const total = raw.reduce((sum, [, w]) => sum + w, 0)
  return new Map(raw.map(([id, w]) => [id, w / total]))
}

export async function accuracyReport(latitude: number, longitude: number, metric: AccuracyMetric, horizon: number): Promise<AccuracyReport> {
  const locKey = locationKey(latitude, longitude)
  const notes: string[] = []
  let backtest: BacktestResult | null = null
  try {
    backtest = (await runBacktest(latitude, longitude)).value
    if (backtest.failed.length) notes.push(`Archived runs unavailable for: ${backtest.failed.join(', ')}.`)
  } catch {
    notes.push('The historical back-test is temporarily unavailable.')
  }
  const live = evaluateLive(locKey)
  const liveSamples = live.filter((r) => r.metric === 'temperature').reduce((sum, r) => sum + r.samples, 0)
  if (!liveSamples) notes.push('We need more prediction history before calculating live accuracy. Live scores appear once forecast target times have passed.')
  notes.push('Back-test: each model’s archived forecasts issued 1–3 days ahead, compared with ERA5 reanalysis for the same hours.')
  notes.push('MET Norway does not publish archived forecasts, so it is ranked from live data only.')

  const rows = [...(backtest?.rows ?? []), ...live]
  const weights = providerWeights(locKey)
  const ids = [...FORECAST_PROVIDERS.map((p) => p.id), 'ensemble']
  const ranking: ProviderRanking[] = ids
    .map((id) => {
      const relevant = rows.filter((r) => r.providerId === id && r.horizonHours === horizon)
      const samples = relevant.reduce((s, r) => s + r.samples, 0)
      const score = samples ? relevant.reduce((s, r) => s + r.score * r.samples, 0) / samples : 0
      return { providerId: id, providerName: providerName(id), score: Math.round(score * 10) / 10, weight: Math.round((weights.get(id) ?? 0) * 1000) / 1000 }
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)

  let comparison: AccuracyReport['comparison'] = null
  if (backtest && BACKTEST_HORIZONS.includes(horizon)) {
    const take = 168
    const from = Math.max(0, backtest.times.length - take)
    const predicted: Record<string, (number | null)[]> = {}
    for (const [id, byHorizon] of Object.entries(backtest.predicted)) {
      const series = byHorizon[horizon]?.[metric]
      if (series) predicted[id] = series.slice(from)
    }
    comparison = {
      metric,
      horizonHours: horizon,
      times: backtest.times.slice(from).map((t) => new Date(t * 1000).toISOString()),
      actual: backtest.actual[metric].slice(from),
      predicted,
    }
  }

  return {
    periodStart: backtest?.start ?? '',
    periodEnd: backtest?.end ?? '',
    rows,
    ranking,
    comparison,
    liveSamples,
    notes,
  }
}
