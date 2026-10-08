import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { ZodError } from 'zod'
import { config } from './config'
import { startScheduler } from './jobs/scheduler'
import { UpstreamError } from './lib/http'
import { registerRoutes } from './routes'

const app = Fastify({
  logger: {
    level: config.logLevel,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.subscription'],
  },
})

async function bootstrap() {
  await app.register(cors, { origin: config.corsOrigins, methods: ['GET', 'POST', 'DELETE'] })
  await app.register(helmet)
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof UpstreamError || error instanceof ZodError) {
      request.log.warn({ err: error.message, url: request.url }, 'Upstream provider problem')
      return reply.status(502).send({
        success: false,
        error: { code: 'WEATHER_PROVIDER_UNAVAILABLE', message: 'Weather data is temporarily unavailable. We are trying another source.' },
      })
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status === 429) {
      return reply.status(429).send({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' } })
    }
    request.log.error({ err: error }, 'Unhandled error')
    return reply.status(status >= 400 && status < 500 ? status : 500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
    })
  })

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } })
  })

  await registerRoutes(app)
  await app.listen({ port: config.port, host: config.host })

  const stopJobs = config.jobsEnabled ? startScheduler(app.log) : () => undefined
  const shutdown = async () => {
    stopJobs()
    await app.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((error: unknown) => {
  app.log.error(error)
  process.exit(1)
})
