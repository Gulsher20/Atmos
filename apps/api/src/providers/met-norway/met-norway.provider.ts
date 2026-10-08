import { z } from 'zod'
import type { ProviderCapabilities, WeatherCondition } from '@weather/shared-types'
import { fetchJson } from '../../lib/http'
import type { ForecastFetch, ProviderHour, WeatherProvider } from '../interfaces/weather-provider'

const MetResponseSchema = z.object({
  properties: z.object({
    timeseries: z.array(
      z.object({
        time: z.string(),
        data: z.object({
          instant: z.object({
            details: z.object({
              air_temperature: z.number().optional(),
              relative_humidity: z.number().optional(),
              wind_speed: z.number().optional(),
              wind_from_direction: z.number().optional(),
              cloud_area_fraction: z.number().optional(),
              air_pressure_at_sea_level: z.number().optional(),
            }),
          }),
          next_1_hours: z
            .object({
              summary: z.object({ symbol_code: z.string() }),
              details: z.object({ precipitation_amount: z.number().optional() }).optional(),
            })
            .optional(),
          next_6_hours: z
            .object({
              summary: z.object({ symbol_code: z.string() }),
              details: z.object({ precipitation_amount: z.number().optional() }).optional(),
            })
            .optional(),
        }),
      }),
    ),
  }),
})

/** Maps MET Norway symbol codes (e.g. "lightrainshowers_day") to our normalized conditions. */
export function metSymbolToCondition(symbol: string): WeatherCondition {
  const base = symbol.replace(/_(day|night|polartwilight)$/, '')
  if (base.includes('thunder')) return 'thunderstorm'
  if (base.includes('sleet')) return 'light_freezing_rain'
  if (base.includes('snow')) return base.startsWith('heavy') ? 'heavy_snow' : base.startsWith('light') ? 'slight_snow' : 'moderate_snow'
  if (base.includes('rainshowers')) return base.startsWith('heavy') ? 'violent_rain_showers' : base.startsWith('light') ? 'slight_rain_showers' : 'moderate_rain_showers'
  if (base.includes('rain')) return base.startsWith('heavy') ? 'heavy_rain' : base.startsWith('light') ? 'slight_rain' : 'moderate_rain'
  if (base === 'fog') return 'fog'
  if (base === 'clearsky') return 'clear_sky'
  if (base === 'fair') return 'mainly_clear'
  if (base === 'partlycloudy') return 'partly_cloudy'
  if (base === 'cloudy') return 'overcast'
  return 'unknown'
}

/** MET Norway Locationforecast 2.0 — free, requires an identifying User-Agent and attribution. */
export class MetNorwayProvider implements WeatherProvider {
  readonly id = 'metno'
  readonly name = 'MET Norway'
  readonly capabilities: ProviderCapabilities = {
    currentWeather: false,
    hourlyForecast: true,
    dailyForecast: true,
    historicalWeather: false,
    airQuality: false,
    precipitation: true,
    uv: false,
  }

  async getHourlyForecast(latitude: number, longitude: number): Promise<ForecastFetch> {
    // MET asks clients to use at most 4 decimals in coordinates.
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${latitude.toFixed(4)}&lon=${longitude.toFixed(4)}`
    const { data, ms } = await fetchJson(this.id, url)
    const parsed = MetResponseSchema.parse(data)
    const hours: ProviderHour[] = []
    for (const entry of parsed.properties.timeseries) {
      // Only hourly steps; after ~2.5 days MET switches to 6-hour steps.
      const next = entry.data.next_1_hours
      if (!next) continue
      const d = entry.data.instant.details
      hours.push({
        time: Math.floor(Date.parse(entry.time) / 1000),
        temperature: d.air_temperature ?? null,
        feelsLike: null,
        humidity: d.relative_humidity ?? null,
        precipitation: next.details?.precipitation_amount ?? null,
        precipitationProbability: null,
        windSpeed: d.wind_speed === undefined ? null : Math.round(d.wind_speed * 3.6 * 10) / 10,
        windGust: null,
        windDirection: d.wind_from_direction ?? null,
        cloudCover: d.cloud_area_fraction ?? null,
        uvIndex: null,
        visibility: null,
        pressure: d.air_pressure_at_sea_level ?? null,
        isDay: null,
        condition: metSymbolToCondition(next.summary.symbol_code),
      })
    }
    if (!hours.length) throw new Error('MET Norway returned no hourly data')
    return { hours, ms }
  }
}
