import type { AirQuality, CurrentWeather, GeocodingResult, ProviderCapabilities } from '@weather/shared-types'
import { WmoCodeToCondition, getAqiCategory } from '@weather/weather-core'
import { fetchJson } from '../../lib/http'
import type { ForecastFetch, PastForecastSeries, ProviderHour, WeatherProvider } from '../interfaces/weather-provider'
import {
  AirQualityResponseSchema,
  CurrentResponseSchema,
  DailyHistorySchema,
  GeocodingResponseSchema,
  HourlyIsoSchema,
  HourlyResponseSchema,
} from './open-meteo.types'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'uv_index',
  'visibility',
  'pressure_msl',
  'is_day',
].join(',')

const valueAt = (series: (number | null)[] | undefined, index: number): number | null => series?.[index] ?? null

/** One numerical weather model served through Open-Meteo (no API key required). */
export class OpenMeteoModelProvider implements WeatherProvider {
  readonly capabilities: ProviderCapabilities = {
    currentWeather: false,
    hourlyForecast: true,
    dailyForecast: true,
    historicalWeather: true,
    airQuality: false,
    precipitation: true,
    uv: true,
  }

  constructor(
    readonly id: string,
    readonly name: string,
    private readonly model: string,
  ) {}

  async getHourlyForecast(latitude: number, longitude: number): Promise<ForecastFetch> {
    const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&hourly=${HOURLY_VARS}&models=${this.model}&forecast_days=8&timeformat=unixtime&timezone=GMT`
    const { data, ms } = await fetchJson(this.id, url)
    const { hourly } = HourlyResponseSchema.parse(data)
    const hours: ProviderHour[] = hourly.time.map((time, i) => {
      const code = valueAt(hourly.weather_code, i)
      const visibility = valueAt(hourly.visibility, i)
      const isDay = valueAt(hourly.is_day, i)
      return {
        time,
        temperature: valueAt(hourly.temperature_2m, i),
        feelsLike: valueAt(hourly.apparent_temperature, i),
        humidity: valueAt(hourly.relative_humidity_2m, i),
        precipitation: valueAt(hourly.precipitation, i),
        precipitationProbability: valueAt(hourly.precipitation_probability, i),
        windSpeed: valueAt(hourly.wind_speed_10m, i),
        windGust: valueAt(hourly.wind_gusts_10m, i),
        windDirection: valueAt(hourly.wind_direction_10m, i),
        cloudCover: valueAt(hourly.cloud_cover, i),
        uvIndex: valueAt(hourly.uv_index, i),
        visibility: visibility === null ? null : visibility / 1000,
        pressure: valueAt(hourly.pressure_msl, i),
        isDay: isDay === null ? null : isDay === 1,
        condition: code === null ? null : WmoCodeToCondition(code),
      }
    })
    if (!hours.some((h) => h.temperature !== null)) throw new Error(`${this.name} returned no temperature data`)
    return { hours, ms }
  }

  async getPastForecasts(latitude: number, longitude: number, start: string, end: string): Promise<PastForecastSeries[]> {
    const days = [1, 2, 3]
    const vars = days.flatMap((d) => [
      `temperature_2m_previous_day${d}`,
      `precipitation_previous_day${d}`,
      `wind_speed_10m_previous_day${d}`,
    ])
    const url = `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=${vars.join(',')}&models=${this.model}&start_date=${start}&end_date=${end}&timeformat=unixtime&timezone=GMT`
    const { data } = await fetchJson(this.id, url, 20_000)
    const { hourly } = HourlyIsoSchema.parse(data)
    return days.map((d) => ({
      horizonHours: d * 24,
      times: hourly.time,
      temperature: hourly[`temperature_2m_previous_day${d}`] ?? [],
      precipitation: hourly[`precipitation_previous_day${d}`] ?? [],
      wind: hourly[`wind_speed_10m_previous_day${d}`] ?? [],
    }))
  }
}

export const OPEN_METEO_MODELS: OpenMeteoModelProvider[] = [
  new OpenMeteoModelProvider('ecmwf', 'ECMWF IFS', 'ecmwf_ifs025'),
  new OpenMeteoModelProvider('gfs', 'NOAA GFS', 'gfs_seamless'),
  new OpenMeteoModelProvider('icon', 'DWD ICON', 'icon_seamless'),
  new OpenMeteoModelProvider('jma', 'JMA GSM', 'jma_seamless'),
]

export interface CurrentAndAstronomy {
  current: CurrentWeather
  timezone: string
  utcOffsetSeconds: number
  days: { date: string; sunrise: string | null; sunset: string | null; sunshineHours: number | null }[]
  ms: number
}

/** Open-Meteo "best match" blend, used for current conditions and sunrise/sunset. */
export async function fetchCurrentAndAstronomy(latitude: number, longitude: number): Promise<CurrentAndAstronomy> {
  const current =
    'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility'
  const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=${current}&daily=sunrise,sunset,sunshine_duration&forecast_days=8&timezone=auto&timeformat=unixtime`
  const { data, ms } = await fetchJson('open-meteo', url)
  const parsed = CurrentResponseSchema.parse(data)
  const c = parsed.current
  const num = (key: string, fallback = 0) => c[key] ?? fallback
  const offset = parsed.utc_offset_seconds
  const toIso = (unix: number | null | undefined) => (unix ? new Date(unix * 1000).toISOString() : null)
  const days = (parsed.daily?.time ?? []).map((t, i) => {
    const sunshine = valueAt(parsed.daily?.sunshine_duration, i)
    return {
      date: new Date((t + offset) * 1000).toISOString().slice(0, 10),
      sunrise: toIso(valueAt(parsed.daily?.sunrise, i)),
      sunset: toIso(valueAt(parsed.daily?.sunset, i)),
      sunshineHours: sunshine === null ? null : Math.round((sunshine / 3600) * 10) / 10,
    }
  })
  const visibility = c.visibility ?? null
  return {
    current: {
      time: new Date(c.time * 1000).toISOString(),
      temperature: num('temperature_2m'),
      feelsLike: num('apparent_temperature', num('temperature_2m')),
      humidity: num('relative_humidity_2m'),
      pressure: c.pressure_msl ?? null,
      windSpeed: num('wind_speed_10m'),
      windGust: c.wind_gusts_10m ?? null,
      windDirection: c.wind_direction_10m ?? null,
      precipitation: num('precipitation'),
      cloudCover: c.cloud_cover ?? null,
      visibility: visibility === null ? null : visibility / 1000,
      uvIndex: num('uv_index'),
      isDay: num('is_day', 1) === 1,
      condition: WmoCodeToCondition(num('weather_code', -1)),
    },
    timezone: parsed.timezone,
    utcOffsetSeconds: offset,
    days,
    ms,
  }
}

export async function fetchAirQuality(latitude: number, longitude: number): Promise<{ value: AirQuality; ms: number }> {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&current=us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&hourly=us_aqi&forecast_days=5&timezone=auto`
  const { data, ms } = await fetchJson('open-meteo-air', url)
  const parsed = AirQualityResponseSchema.parse(data)
  const aqi = parsed.current.us_aqi
  if (typeof aqi !== 'number') throw new Error('Air quality index missing')

  const byDate = new Map<string, number>()
  parsed.hourly?.time.forEach((time, i) => {
    const value = valueAt(parsed.hourly?.us_aqi, i)
    if (value === null) return
    const date = time.slice(0, 10)
    byDate.set(date, Math.max(byDate.get(date) ?? 0, value))
  })

  return {
    value: {
      aqi: Math.round(aqi),
      category: getAqiCategory(aqi),
      pm25: parsed.current.pm2_5 ?? null,
      pm10: parsed.current.pm10 ?? null,
      no2: parsed.current.nitrogen_dioxide ?? null,
      so2: parsed.current.sulphur_dioxide ?? null,
      co: parsed.current.carbon_monoxide ?? null,
      o3: parsed.current.ozone ?? null,
      time: parsed.current.time,
      forecast: [...byDate.entries()].map(([date, aqiMax]) => ({ date, aqiMax: Math.round(aqiMax) })),
    },
    ms,
  }
}

export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=en&format=json`
  const { data } = await fetchJson('open-meteo-geocoding', url)
  const parsed = GeocodingResponseSchema.parse(data)
  return (parsed.results ?? []).map((r) => ({
    id: String(r.id),
    name: r.name,
    country: r.country,
    region: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone ?? 'UTC',
    population: r.population,
  }))
}

export async function lookupTimezone(latitude: number, longitude: number): Promise<string> {
  const url = `${FORECAST_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=auto&timeformat=unixtime`
  const { data } = await fetchJson('open-meteo', url)
  return CurrentResponseSchema.parse(data).timezone
}

export const HISTORY_DAILY_VARS = [
  'temperature_2m_max',
  'temperature_2m_min',
  'temperature_2m_mean',
  'precipitation_sum',
  'rain_sum',
  'snowfall_sum',
  'sunshine_duration',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'relative_humidity_2m_mean',
  'cloud_cover_mean',
]

/** Daily (and optional hourly wind) history. Uses the ERA5 archive or the forecast API for recent days. */
export async function fetchDailyHistory(
  source: 'archive' | 'recent',
  latitude: number,
  longitude: number,
  start: string,
  end: string,
  withHourlyWind: boolean,
) {
  const base = source === 'archive' ? 'https://archive-api.open-meteo.com/v1/archive' : FORECAST_URL
  const hourly = withHourlyWind ? '&hourly=wind_speed_10m' : ''
  const url = `${base}?latitude=${latitude}&longitude=${longitude}&start_date=${start}&end_date=${end}&daily=${HISTORY_DAILY_VARS.join(',')}${hourly}&timezone=auto`
  const { data } = await fetchJson(source === 'archive' ? 'open-meteo-archive' : 'open-meteo', url, 20_000)
  return DailyHistorySchema.parse(data)
}

/** ERA5 reanalysis hourly values, used as "actual" weather when back-testing forecasts. */
export async function fetchArchiveHourly(latitude: number, longitude: number, start: string, end: string) {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start}&end_date=${end}&hourly=temperature_2m,precipitation,wind_speed_10m&timeformat=unixtime&timezone=GMT`
  const { data } = await fetchJson('open-meteo-archive', url, 20_000)
  return HourlyIsoSchema.parse(data).hourly
}
