import type { ScoreFactor } from '@weather/shared-types'

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

export function temperatureFactor(feelsLike: number, [low, high]: [number, number]): ScoreFactor {
  const distance = feelsLike < low ? low - feelsLike : feelsLike > high ? feelsLike - high : 0
  const score = clamp(100 - distance * 7)
  const t = Math.round(feelsLike)
  const hot = feelsLike > high
  const note =
    distance === 0
      ? `Comfortable temperature (${t}°C)`
      : distance <= 4
        ? `${hot ? 'A bit warm' : 'A bit cool'} (feels like ${t}°C)`
        : `${hot ? 'Too hot' : 'Too cold'} (feels like ${t}°C)`
  return { key: 'temperature', label: 'Temperature', score, note }
}

export function rainFactor(maxProbability: number, totalMm: number, hours: number, thunder: boolean): ScoreFactor {
  let score = clamp(100 - maxProbability * 0.9 - totalMm * 8)
  if (thunder) score = Math.min(score, 10)
  const window = hours >= 24 ? `the next ${hours} hours` : `the next ${hours}h`
  let note: string
  if (thunder) note = `Thunderstorms possible in ${window}`
  else if (maxProbability < 20 && totalMm < 0.5) note = `No significant rain expected for ${window}`
  else if (maxProbability < 35) note = `Low rain probability (${Math.round(maxProbability)}%)`
  else if (maxProbability < 60) note = `Some rain possible (${Math.round(maxProbability)}%) in ${window}`
  else note = `High rain chance (${Math.round(maxProbability)}%) in ${window}`
  return { key: 'rain', label: 'Rain', score, note }
}

export function windFactor(wind: number, gust: number | null, limit: number): ScoreFactor {
  const effective = Math.max(wind, (gust ?? 0) * 0.7)
  const score = effective <= limit * 0.35 ? 100 : clamp(100 - ((effective - limit * 0.35) / (limit * 0.65)) * 100)
  const w = Math.round(wind)
  const note = effective <= 12 ? `Light wind (${w} km/h)` : effective <= 28 ? `Moderate wind (${w} km/h)` : `Strong wind (${w} km/h${gust ? `, gusts ${Math.round(gust)}` : ''})`
  return { key: 'wind', label: 'Wind', score, note }
}

export function uvFactor(uv: number): ScoreFactor {
  const score = uv <= 3 ? 100 : clamp(100 - (uv - 3) * 10)
  const u = Math.round(uv)
  const note = uv <= 2 ? `Low UV (${u})` : uv <= 5 ? `Moderate UV (${u})` : uv <= 7 ? `High UV (${u}) — use sunscreen` : `Very high UV (${u}) — limit midday sun`
  return { key: 'uv', label: 'UV', score, note }
}

export function airQualityFactor(aqi: number | null): ScoreFactor {
  if (aqi === null) return { key: 'airQuality', label: 'Air quality', score: 75, note: 'Air quality data unavailable' }
  const score = aqi <= 50 ? 100 : aqi <= 100 ? 80 : aqi <= 150 ? 50 : aqi <= 200 ? 25 : 5
  const a = Math.round(aqi)
  const note = aqi <= 50 ? `Good air quality (AQI ${a})` : aqi <= 100 ? `Moderate air quality (AQI ${a})` : `Unhealthy air (AQI ${a})`
  return { key: 'airQuality', label: 'Air quality', score, note }
}

export function humidityFactor(humidity: number): ScoreFactor {
  const distance = humidity < 30 ? 30 - humidity : humidity > 65 ? humidity - 65 : 0
  const score = clamp(100 - distance * 2.2)
  const h = Math.round(humidity)
  const note = distance === 0 ? `Comfortable humidity (${h}%)` : humidity > 65 ? `Humid air (${h}%)` : `Dry air (${h}%)`
  return { key: 'humidity', label: 'Humidity', score, note }
}
