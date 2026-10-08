import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from '../config'

const path = resolve(process.cwd(), config.databasePath)
mkdirSync(dirname(path), { recursive: true })

export const db = new DatabaseSync(path)

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS tracked_locations (
    loc_key TEXT PRIMARY KEY,
    name TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    last_requested_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS forecast_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id TEXT NOT NULL,
    loc_key TEXT NOT NULL,
    issued_at INTEGER NOT NULL,
    target_time INTEGER NOT NULL,
    horizon_hours INTEGER NOT NULL,
    temperature REAL,
    precipitation REAL,
    wind_speed REAL,
    humidity REAL,
    condition TEXT,
    UNIQUE (provider_id, loc_key, issued_at, target_time)
  );
  CREATE INDEX IF NOT EXISTS idx_predictions_target ON forecast_predictions (loc_key, target_time);
  CREATE INDEX IF NOT EXISTS idx_predictions_provider ON forecast_predictions (provider_id, horizon_hours);

  CREATE TABLE IF NOT EXISTS weather_observations (
    loc_key TEXT NOT NULL,
    time INTEGER NOT NULL,
    temperature REAL,
    precipitation REAL,
    wind_speed REAL,
    humidity REAL,
    condition TEXT,
    source TEXT NOT NULL,
    PRIMARY KEY (loc_key, time)
  );

  CREATE TABLE IF NOT EXISTS provider_metrics (
    provider_id TEXT NOT NULL,
    loc_key TEXT NOT NULL,
    metric TEXT NOT NULL,
    horizon_hours INTEGER NOT NULL,
    source TEXT NOT NULL,
    mae REAL NOT NULL,
    rmse REAL NOT NULL,
    bias REAL NOT NULL,
    score REAL NOT NULL,
    samples INTEGER NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    computed_at INTEGER NOT NULL,
    PRIMARY KEY (provider_id, loc_key, metric, horizon_hours, source)
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    location_name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    preferences TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    fingerprint TEXT PRIMARY KEY,
    sent_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

export function getKv(key: string): string | null {
  const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setKv(key: string, value: string): void {
  db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}
