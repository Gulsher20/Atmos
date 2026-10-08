import type { AirQuality, CurrentWeather, DailyForecast, HourlyForecast, WeatherAlert, WeatherTrend } from '@weather/shared-types'
import { conditionGroup } from '@weather/weather-core'

export const ALERT_THRESHOLDS = {
  heavyRainDailyMm: 20,
  heavyRainHourlyMm: 7.6,
  rainProbability: 70,
  extremeHeatC: 38,
  extremeColdC: -10,
  highWindGustKmh: 60,
  highWindKmh: 45,
  highUv: 8,
  poorAqi: 151,
  snowCm: 1,
}

const TREND_THRESHOLDS = { temperatureDelta: 4, windKmh: 40, humidityDelta: 15, uv: 8, aqiDelta: 30 }

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })

function localHourLabel(iso: string, offsetSeconds: number): string {
  const d = new Date(Date.parse(iso) + offsetSeconds * 1000)
  const h = d.getUTCHours()
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`
}

function relativeDay(date: string, today: string): string {
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `on ${weekday(date)}`
}

export function detectTrends(daily: DailyForecast[], air: AirQuality | null): WeatherTrend[] {
  const trends: WeatherTrend[] = []
  const first = daily[0]
  if (!first) return trends
  const horizon = daily[Math.min(3, daily.length - 1)]!
  const end = daily[daily.length - 1]!

  const tempDelta = Math.round(horizon.tempMax - first.tempMax)
  if (Math.abs(tempDelta) >= TREND_THRESHOLDS.temperatureDelta) {
    const warming = tempDelta > 0
    trends.push({
      id: warming ? 'warming' : 'cooling',
      type: warming ? 'warming' : 'cooling',
      severity: Math.abs(tempDelta) >= 8 ? 'high' : Math.abs(tempDelta) >= 6 ? 'medium' : 'low',
      icon: warming ? '🌡️' : '🥶',
      title: warming ? 'Getting warmer' : 'Getting cooler',
      message: `Temperatures are expected to ${warming ? 'increase' : 'drop'} by ${Math.abs(tempDelta)}°C over the next 3 days.`,
      startDate: first.date,
      endDate: horizon.date,
    })
  }

  const firstHalf = daily.slice(0, 3)
  const secondHalf = daily.slice(3)
  const avg = (list: DailyForecast[], pick: (d: DailyForecast) => number) => (list.length ? list.reduce((s, d) => s + pick(d), 0) / list.length : 0)
  if (secondHalf.length) {
    const rainNow = avg(firstHalf, (d) => d.precipitationProbability)
    const rainLater = avg(secondHalf, (d) => d.precipitationProbability)
    if (rainLater - rainNow >= 25) {
      trends.push({
        id: 'rain_increasing',
        type: 'rain_increasing',
        severity: rainLater >= 70 ? 'high' : 'medium',
        icon: '🌧️',
        title: 'Wetter days ahead',
        message: `Rain chances rise to about ${Math.round(rainLater)}% later this week.`,
        startDate: secondHalf[0]!.date,
        endDate: end.date,
      })
    } else if (rainNow - rainLater >= 25) {
      trends.push({
        id: 'rain_decreasing',
        type: 'rain_decreasing',
        severity: 'low',
        icon: '🌤️',
        title: 'Drying out',
        message: `Rain chances fall to about ${Math.round(rainLater)}% later this week.`,
        startDate: secondHalf[0]!.date,
        endDate: end.date,
      })
    }

    const humidityDelta = avg(secondHalf, (d) => d.humidityMean) - avg(firstHalf, (d) => d.humidityMean)
    if (humidityDelta >= TREND_THRESHOLDS.humidityDelta) {
      trends.push({
        id: 'humidity_increasing',
        type: 'humidity_increasing',
        severity: 'low',
        icon: '💦',
        title: 'Getting more humid',
        message: `Humidity climbs by about ${Math.round(humidityDelta)} points later this week.`,
        startDate: secondHalf[0]!.date,
        endDate: end.date,
      })
    }
  }

  const windiest = [...daily].sort((a, b) => b.windSpeedMax - a.windSpeedMax)[0]
  if (windiest && windiest.windSpeedMax >= TREND_THRESHOLDS.windKmh) {
    trends.push({
      id: 'wind_increasing',
      type: 'wind_increasing',
      severity: windiest.windSpeedMax >= 60 ? 'high' : 'medium',
      icon: '💨',
      title: `Strong winds ${relativeDay(windiest.date, first.date)}`,
      message: `Winds may reach ${Math.round(windiest.windSpeedMax)} km/h ${relativeDay(windiest.date, first.date)}.`,
      startDate: windiest.date,
      endDate: windiest.date,
    })
  } else if (daily.length > 3 && first.windSpeedMax >= 30 && avg(daily.slice(1, 4), (d) => d.windSpeedMax) < first.windSpeedMax - 12) {
    trends.push({
      id: 'wind_decreasing',
      type: 'wind_decreasing',
      severity: 'low',
      icon: '🍃',
      title: 'Winds easing',
      message: 'Winds calm down over the next few days.',
      startDate: daily[1]!.date,
      endDate: daily[3]!.date,
    })
  }

  const uvPeak = [...daily].sort((a, b) => b.uvIndexMax - a.uvIndexMax)[0]
  if (uvPeak && uvPeak.uvIndexMax >= TREND_THRESHOLDS.uv) {
    trends.push({
      id: 'uv_increasing',
      type: 'uv_increasing',
      severity: uvPeak.uvIndexMax >= 10 ? 'high' : 'medium',
      icon: '☀️',
      title: 'Very high UV',
      message: `UV index peaks at ${Math.round(uvPeak.uvIndexMax)} ${relativeDay(uvPeak.date, first.date)}.`,
      startDate: uvPeak.date,
      endDate: uvPeak.date,
    })
  }

  if (air && air.forecast.length >= 2) {
    const last = air.forecast[air.forecast.length - 1]!
    const delta = last.aqiMax - air.aqi
    if (Math.abs(delta) >= TREND_THRESHOLDS.aqiDelta) {
      const worse = delta > 0
      trends.push({
        id: worse ? 'air_quality_worsening' : 'air_quality_improving',
        type: worse ? 'air_quality_worsening' : 'air_quality_improving',
        severity: worse && last.aqiMax > 150 ? 'high' : 'medium',
        icon: worse ? '⚠️' : '🍃',
        title: worse ? 'Air quality is worsening' : 'Air quality is improving',
        message: `AQI is forecast to ${worse ? 'rise' : 'fall'} to about ${last.aqiMax} by ${weekday(last.date)}.`,
        startDate: air.forecast[0]!.date,
        endDate: last.date,
      })
    }
  }

  return trends
}

export function detectAlerts(
  current: CurrentWeather,
  hourly: HourlyForecast[],
  daily: DailyForecast[],
  air: AirQuality | null,
  utcOffsetSeconds: number,
): WeatherAlert[] {
  const t = ALERT_THRESHOLDS
  const alerts: WeatherAlert[] = []
  const today = daily[0]?.date ?? current.time.slice(0, 10)

  const firstRain = hourly.find((h) => h.precipitationProbability >= t.rainProbability && h.precipitation >= 0.2)
  if (firstRain) {
    const date = new Date(Date.parse(firstRain.time) + utcOffsetSeconds * 1000).toISOString().slice(0, 10)
    alerts.push({
      id: `rain-${date}`,
      type: 'rain',
      severity: 'info',
      icon: '🌧️',
      title: 'Rain expected',
      message: `Rain expected ${relativeDay(date, today)} at ${localHourLabel(firstRain.time, utcOffsetSeconds)} (${firstRain.precipitationProbability}% chance).`,
      date,
    })
  }

  for (const day of daily.slice(0, 3)) {
    const when = relativeDay(day.date, today)
    const heavyHour = hourly.some(
      (h) => new Date(Date.parse(h.time) + utcOffsetSeconds * 1000).toISOString().startsWith(day.date) && h.precipitation >= t.heavyRainHourlyMm,
    )
    if (day.precipitationSum >= t.heavyRainDailyMm || heavyHour) {
      alerts.push({ id: `heavy-rain-${day.date}`, type: 'heavy_rain', severity: 'warning', icon: '⛈️', title: 'Heavy rain', message: `Around ${Math.round(day.precipitationSum)} mm of rain expected ${when}.`, date: day.date })
    }
    if (day.mostLikely.some((m) => m.group === 'thunderstorm' && m.probability >= 40)) {
      alerts.push({ id: `storm-${day.date}`, type: 'thunderstorm', severity: 'warning', icon: '⚡', title: 'Thunderstorms possible', message: `Thunderstorms are possible ${when}.`, date: day.date })
    }
    if (day.mostLikely.some((m) => m.group === 'snow' && m.probability >= 40)) {
      alerts.push({ id: `snow-${day.date}`, type: 'snow', severity: 'warning', icon: '❄️', title: 'Snow expected', message: `Snow is likely ${when}. Allow extra travel time.`, date: day.date })
    }
    if (day.tempMax >= t.extremeHeatC) {
      alerts.push({ id: `heat-${day.date}`, type: 'extreme_heat', severity: 'critical', icon: '🔥', title: 'Extreme heat', message: `Highs near ${Math.round(day.tempMax)}°C ${when}. Stay hydrated and avoid midday sun.`, date: day.date })
    }
    if (day.tempMin <= t.extremeColdC) {
      alerts.push({ id: `cold-${day.date}`, type: 'extreme_cold', severity: 'critical', icon: '🧊', title: 'Extreme cold', message: `Lows near ${Math.round(day.tempMin)}°C ${when}.`, date: day.date })
    }
    if ((day.windGustMax ?? 0) >= t.highWindGustKmh || day.windSpeedMax >= t.highWindKmh) {
      alerts.push({ id: `wind-${day.date}`, type: 'high_wind', severity: 'warning', icon: '💨', title: 'Strong winds', message: `Strong winds expected ${when} (gusts up to ${Math.round(day.windGustMax ?? day.windSpeedMax)} km/h).`, date: day.date })
    }
    if (day.uvIndexMax >= t.highUv) {
      alerts.push({ id: `uv-${day.date}`, type: 'high_uv', severity: 'info', icon: '🕶️', title: 'High UV', message: `UV index reaches ${Math.round(day.uvIndexMax)} ${when}. Use sunscreen.`, date: day.date })
    }
  }

  if (air && air.aqi >= t.poorAqi) {
    alerts.push({ id: `aqi-${today}`, type: 'poor_air_quality', severity: air.aqi >= 201 ? 'critical' : 'warning', icon: '😷', title: 'Air quality is unhealthy', message: `US AQI is ${air.aqi}. Limit prolonged outdoor activity.`, date: today })
  }

  return alerts
}

/** Deterministic explanation of how tomorrow compares with today. */
export function explainForecast(daily: DailyForecast[]): string[] {
  const today = daily[0]
  const tomorrow = daily[1]
  if (!today || !tomorrow) return []
  const delta = Math.round(tomorrow.tempMax - today.tempMax)
  const lines: string[] = []
  lines.push(delta >= 2 ? 'Tomorrow looks warmer than today.' : delta <= -2 ? 'Tomorrow looks cooler than today.' : 'Tomorrow looks similar to today.')
  lines.push(`Temperature: ${delta >= 0 ? '+' : ''}${delta}°C`)
  const rain = tomorrow.precipitationProbability
  lines.push(`Rain: ${rain >= 60 ? 'High' : rain >= 30 ? 'Moderate' : 'Low'} probability (${rain}%)`)
  const wind = tomorrow.windSpeedMax
  lines.push(`Wind: ${wind >= 40 ? 'Strong' : wind >= 20 ? 'Moderate' : 'Light'} (${Math.round(wind)} km/h)`)
  const group = conditionGroup(tomorrow.condition)
  const outdoorOk = rain < 40 && wind < 35 && tomorrow.tempMax >= 10 && tomorrow.tempMax <= 32 && group !== 'thunderstorm'
  lines.push(`Overall: ${outdoorOk ? 'Good outdoor conditions.' : 'Plan outdoor time with care.'}`)
  return lines
}
