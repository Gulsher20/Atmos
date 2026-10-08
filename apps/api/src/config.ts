import { z } from 'zod'

const EnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGIN: z.string().default(''),
  DATABASE_PATH: z.string().default('data/weather.db'),
  APP_USER_AGENT: z.string().default('weather-intelligence-local/0.1 (github.com/gulsher-weather)'),
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:weather-intelligence@localhost.dev'),
  JOBS_ENABLED: z
    .string()
    .default('true')
    .transform((value) => value !== 'false'),
})

const env = EnvSchema.parse(process.env)

export const config = {
  port: env.API_PORT,
  host: env.API_HOST,
  isProduction: env.NODE_ENV === 'production',
  logLevel: env.LOG_LEVEL,
  corsOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4173',
    ...env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
  ],
  databasePath: env.DATABASE_PATH,
  userAgent: env.APP_USER_AGENT,
  vapid: { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT },
  jobsEnabled: env.JOBS_ENABLED,
  cache: {
    dashboardMs: 10 * 60_000,
    airQualityMs: 30 * 60_000,
    geocodeMs: 24 * 60 * 60_000,
    historyMs: 6 * 60 * 60_000,
    backtestMs: 12 * 60 * 60_000,
  },
}
