import { createHash } from 'node:crypto'
import webpush from 'web-push'
import type { Dashboard, NotificationPreferenceKey, NotificationPreferences, PushSubscribeRequest, WeatherAlert } from '@weather/shared-types'
import { config } from '../config'
import { db, getKv, setKv } from '../database/db'

const COOLDOWN_MS = 24 * 60 * 60_000

function loadVapidKeys(): { publicKey: string; privateKey: string } {
  if (config.vapid.publicKey && config.vapid.privateKey) return { publicKey: config.vapid.publicKey, privateKey: config.vapid.privateKey }
  const stored = getKv('vapid_keys')
  if (stored) return JSON.parse(stored) as { publicKey: string; privateKey: string }
  // Development convenience: generate once and persist. Set VAPID_* env vars in production.
  const keys = webpush.generateVAPIDKeys()
  setKv('vapid_keys', JSON.stringify(keys))
  return keys
}

const vapid = loadVapidKeys()
webpush.setVapidDetails(config.vapid.subject, vapid.publicKey, vapid.privateKey)

export const vapidPublicKey = vapid.publicKey

interface SubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
  location_name: string
  latitude: number
  longitude: number
  preferences: string
}

export function saveSubscription(request: PushSubscribeRequest): void {
  db.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, location_name, latitude, longitude, preferences, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, location_name = excluded.location_name,
       latitude = excluded.latitude, longitude = excluded.longitude, preferences = excluded.preferences`,
  ).run(
    request.subscription.endpoint,
    request.subscription.keys.p256dh,
    request.subscription.keys.auth,
    request.location.name,
    request.location.latitude,
    request.location.longitude,
    JSON.stringify(request.preferences),
    Date.now(),
  )
}

export function deleteSubscription(endpoint: string): void {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint)
}

function getSubscription(endpoint: string): SubscriptionRow | undefined {
  return db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?').get(endpoint) as SubscriptionRow | undefined
}

interface PushPayload {
  title: string
  body: string
  tag: string
  url: string
}

async function send(row: SubscriptionRow, payload: PushPayload): Promise<boolean> {
  try {
    await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, JSON.stringify(payload), { TTL: 3600 })
    return true
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) deleteSubscription(row.endpoint)
    return false
  }
}

const ALERT_PREFERENCE: Record<WeatherAlert['type'], NotificationPreferenceKey> = {
  rain: 'rain',
  heavy_rain: 'rain',
  thunderstorm: 'rain',
  extreme_heat: 'heat',
  extreme_cold: 'cold',
  snow: 'cold',
  high_wind: 'wind',
  high_uv: 'uv',
  poor_air_quality: 'airQuality',
}

function fingerprint(endpoint: string, type: string, date: string, latitude: number, longitude: number): string {
  return createHash('sha256').update(`${endpoint}|${latitude.toFixed(2)},${longitude.toFixed(2)}|${type}|${date}`).digest('hex')
}

function alreadySent(fp: string): boolean {
  const row = db.prepare('SELECT sent_at FROM notification_log WHERE fingerprint = ?').get(fp) as { sent_at: number } | undefined
  return !!row && Date.now() - row.sent_at < COOLDOWN_MS * 7
}

function markSent(fp: string): void {
  db.prepare('INSERT INTO notification_log (fingerprint, sent_at) VALUES (?, ?) ON CONFLICT (fingerprint) DO UPDATE SET sent_at = excluded.sent_at').run(fp, Date.now())
}

/** Candidate notifications for one subscription, before de-duplication. */
function candidates(dashboard: Dashboard, prefs: NotificationPreferences, locationName: string): { type: string; date: string; payload: PushPayload }[] {
  const list: { type: string; date: string; payload: PushPayload }[] = []
  for (const alert of dashboard.alerts) {
    if (!prefs[ALERT_PREFERENCE[alert.type]]) continue
    list.push({ type: alert.type, date: alert.date, payload: { title: `${alert.icon} ${alert.title} · ${locationName}`, body: alert.message, tag: alert.id, url: '/alerts' } })
  }
  if (prefs.changes) {
    for (const trend of dashboard.trends.filter((t) => t.severity !== 'low')) {
      list.push({ type: `trend-${trend.type}`, date: trend.startDate, payload: { title: `${trend.icon} ${trend.title} · ${locationName}`, body: trend.message, tag: trend.id, url: '/' } })
    }
  }
  const today = dashboard.daily[0]
  const localHour = new Date(Date.now() + dashboard.location.utcOffsetSeconds * 1000).getUTCHours()
  if (prefs.daily && today && localHour >= 6 && localHour <= 9) {
    list.push({
      type: 'daily',
      date: today.date,
      payload: {
        title: `☀️ Today in ${locationName}`,
        body: `${Math.round(today.tempMax)}° / ${Math.round(today.tempMin)}° · Rain ${today.precipitationProbability}% · ${dashboard.recommendations.headline}`,
        tag: `daily-${today.date}`,
        url: '/',
      },
    })
  }
  return list
}

/** Send new, non-duplicate notifications to every subscriber. Returns number sent. */
export async function runNotificationJob(getDashboard: (lat: number, lon: number) => Promise<Dashboard>): Promise<number> {
  const rows = db.prepare('SELECT * FROM push_subscriptions').all() as unknown as SubscriptionRow[]
  let sent = 0
  for (const row of rows) {
    try {
      const prefs = JSON.parse(row.preferences) as NotificationPreferences
      const dashboard = await getDashboard(row.latitude, row.longitude)
      // At most three pushes per run per subscriber, to avoid spamming.
      const fresh = candidates(dashboard, prefs, row.location_name)
        .map((c) => ({ ...c, fp: fingerprint(row.endpoint, c.type, c.date, row.latitude, row.longitude) }))
        .filter((c) => !alreadySent(c.fp))
        .slice(0, 3)
      for (const c of fresh) {
        if (await send(row, c.payload)) {
          markSent(c.fp)
          sent += 1
        }
      }
    } catch {
      // One failing subscriber must not stop the others.
    }
  }
  db.prepare('DELETE FROM notification_log WHERE sent_at < ?').run(Date.now() - 30 * 86_400_000)
  return sent
}

export async function sendTestNotification(endpoint: string): Promise<boolean> {
  const row = getSubscription(endpoint)
  if (!row) return false
  return send(row, {
    title: '🔔 Notifications are on',
    body: `You will get weather alerts for ${row.location_name}.`,
    tag: 'test',
    url: '/alerts',
  })
}
