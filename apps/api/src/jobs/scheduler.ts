import type { FastifyBaseLogger } from 'fastify'
import { activeLocations, evaluateLive, runBacktest } from '../forecasting/accuracy'
import { runNotificationJob } from '../notifications/push.service'
import { getDashboard } from '../services/dashboard.service'

const HOUR = 60 * 60_000

/** Hourly: refresh forecasts + observations for active locations (stores snapshots), then evaluate. */
async function collectForecastsAndObservations(log: FastifyBaseLogger) {
  const locations = activeLocations()
  for (const loc of locations) {
    try {
      await getDashboard(loc.latitude, loc.longitude, { force: true })
      evaluateLive(loc.loc_key)
    } catch (error) {
      log.warn({ err: error, location: loc.loc_key }, 'Forecast collection failed')
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  log.info({ locations: locations.length }, 'Forecast collection complete')
}

/** Twice a day: refresh historical back-tests, which drive ensemble weights. */
async function refreshBacktests(log: FastifyBaseLogger) {
  for (const loc of activeLocations()) {
    try {
      await runBacktest(loc.latitude, loc.longitude)
    } catch (error) {
      log.warn({ err: error, location: loc.loc_key }, 'Back-test failed')
    }
  }
}

async function sendNotifications(log: FastifyBaseLogger) {
  const sent = await runNotificationJob((lat, lon) => getDashboard(lat, lon))
  if (sent) log.info({ sent }, 'Push notifications sent')
}

export function startScheduler(log: FastifyBaseLogger): () => void {
  const guard = (name: string, job: (log: FastifyBaseLogger) => Promise<void>) => async () => {
    try {
      await job(log)
    } catch (error) {
      log.error({ err: error, job: name }, 'Scheduled job failed')
    }
  }
  const timers = [
    setInterval(guard('collect', collectForecastsAndObservations), HOUR),
    setInterval(guard('backtest', refreshBacktests), 12 * HOUR),
    setInterval(guard('notifications', sendNotifications), 30 * 60_000),
  ]
  const warmup = setTimeout(guard('notifications', sendNotifications), 60_000)
  return () => {
    timers.forEach(clearInterval)
    clearTimeout(warmup)
  }
}
