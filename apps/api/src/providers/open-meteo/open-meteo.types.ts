import { z } from 'zod'

const nullableNumbers = z.array(z.number().nullable())

export const HourlyResponseSchema = z.object({
  utc_offset_seconds: z.number(),
  timezone: z.string(),
  hourly: z.object({ time: z.array(z.number()) }).catchall(nullableNumbers),
})

export const CurrentResponseSchema = z.object({
  utc_offset_seconds: z.number(),
  timezone: z.string(),
  current: z.object({ time: z.number() }).catchall(z.number().nullable()),
  daily: z
    .object({ time: z.array(z.number()) })
    .catchall(nullableNumbers)
    .optional(),
})

export const DailyHistorySchema = z.object({
  utc_offset_seconds: z.number(),
  timezone: z.string(),
  daily: z.object({ time: z.array(z.string()) }).catchall(nullableNumbers),
  hourly: z
    .object({ time: z.array(z.string()) })
    .catchall(nullableNumbers)
    .optional(),
})

export const HourlyIsoSchema = z.object({
  hourly: z.object({ time: z.array(z.number()) }).catchall(nullableNumbers),
})

export const AirQualityResponseSchema = z.object({
  current: z.object({ time: z.string() }).catchall(z.number().nullable()),
  hourly: z
    .object({ time: z.array(z.string()) })
    .catchall(nullableNumbers)
    .optional(),
})

export const GeocodingResponseSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
        population: z.number().optional(),
      }),
    )
    .optional(),
})
