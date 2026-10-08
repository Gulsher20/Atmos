import type {
  ActivityRecommendation,
  ActivityType,
  ClothingRecommendation,
  CurrentWeather,
  HourlyForecast,
  Recommendations,
  ScoreFactor,
} from '@weather/shared-types'
import { conditionGroup } from '@weather/weather-core'
import { ACTIVITY_RULES, CLOTHING_THRESHOLDS as C, SCORE_LEVELS, type ActivityRule } from './config'
import { airQualityFactor, humidityFactor, rainFactor, temperatureFactor, uvFactor, windFactor } from './factors'

export interface RecommendationInput {
  current: CurrentWeather
  /** Upcoming hourly forecast, starting now (ideally 48h). */
  hourly: HourlyForecast[]
  aqi: number | null
  activityContext?: Partial<
    Record<
      ActivityType,
      {
        availability: ActivityRecommendation['availability']
        availabilityNote: string
        nearbyCount: number | null
        nearestDistanceKm: number | null
      }
    >
  >
}

function levelFor(score: number) {
  return SCORE_LEVELS.find((entry) => score >= entry.min) ?? SCORE_LEVELS[SCORE_LEVELS.length - 1]!
}

function summaryFor(rule: ActivityRule, score: number): string {
  if (score >= 90) return `${rule.icon} Great day for ${rule.verb}`
  if (score >= 75) return `${rule.icon} Good day for ${rule.verb}`
  if (score >= 50) return `${rule.icon} ${rule.title} is possible`
  if (score >= 25) return `${rule.icon} Not ideal for ${rule.verb}`
  return `${rule.icon} Avoid ${rule.verb} today`
}

function windowStats(hourly: HourlyForecast[], hours: number) {
  const slice = hourly.slice(0, Math.max(1, hours))
  return {
    maxProbability: Math.max(0, ...slice.map((h) => h.precipitationProbability)),
    totalMm: slice.reduce((sum, h) => sum + h.precipitation, 0),
    thunder: slice.some((h) => conditionGroup(h.condition) === 'thunderstorm'),
    maxUv: Math.max(0, ...slice.map((h) => h.uvIndex)),
    maxWind: Math.max(0, ...slice.map((h) => h.windSpeed)),
    maxGust: Math.max(0, ...slice.map((h) => h.windGust ?? 0)),
    maxFeels: Math.max(...slice.map((h) => h.feelsLike)),
    minFeels: Math.min(...slice.map((h) => h.feelsLike)),
    avgHumidity: slice.reduce((sum, h) => sum + h.humidity, 0) / slice.length,
  }
}

function scoreActivity(activity: Exclude<ActivityType, 'indoor_activity'>, input: RecommendationInput): ActivityRecommendation {
  const rule = ACTIVITY_RULES[activity]
  const place = input.activityContext?.[activity]
  const comingHours = input.hourly.length ? input.hourly : []
  const near = windowStats(comingHours.length ? comingHours : [], Math.min(6, comingHours.length || 1))
  const rainWindow = windowStats(comingHours, rule.rainWindowHours)
  const feels = comingHours.length ? (near.maxFeels + near.minFeels) / 2 : input.current.feelsLike

  const factors: ScoreFactor[] = [
    temperatureFactor(feels, rule.idealTemp),
    rainFactor(rainWindow.maxProbability, rainWindow.totalMm, rule.rainWindowHours, rainWindow.thunder),
    windFactor(Math.max(input.current.windSpeed, near.maxWind), near.maxGust || input.current.windGust, rule.windLimit),
    uvFactor(Math.max(input.current.uvIndex, near.maxUv)),
    airQualityFactor(input.aqi),
    humidityFactor(comingHours.length ? near.avgHumidity : input.current.humidity),
  ]

  const totalWeight = factors.reduce((sum, f) => sum + rule.weights[f.key], 0)
  let score = Math.round(factors.reduce((sum, f) => sum + f.score * rule.weights[f.key], 0) / totalWeight)
  // A single dealbreaker caps the score, so one perfect factor can't hide a dangerous one.
  const worst = factors.filter((f) => rule.weights[f.key] >= 0.1).reduce((min, f) => Math.min(min, f.score), 100)
  if (worst < 20) score = Math.min(score, 35)

  if (place?.availability === 'unavailable') score = 0
  const level = levelFor(score)
  const relevant = factors.filter((f) => rule.weights[f.key] > 0)
  const weakest = relevant.filter((f) => f.score < 60).sort((a, b) => a.score - b.score)
  const reasons =
    score >= 50
      ? [...relevant.filter((f) => f.score >= 85).map((f) => f.note), ...weakest.map((f) => `Watch out: ${f.note}`)]
      : weakest.map((f) => f.note)

  return {
    activity,
    title: rule.title,
    icon: rule.icon,
    score,
    level: level.level,
    levelLabel: level.label,
    summary: place?.availability === 'unavailable' ? `${rule.icon} Not available near this place` : summaryFor(rule, score),
    reasons:
      place?.availability === 'unavailable'
        ? [place.availabilityNote]
        : [
            ...(place?.availabilityNote ? [place.availabilityNote] : []),
            ...(reasons.length ? reasons : relevant.map((f) => f.note).slice(0, 3)),
          ],
    factors: relevant,
    availability: place?.availability ?? 'unknown',
    availabilityNote: place?.availabilityNote ?? 'Nearby place data is unavailable; score uses weather only.',
    nearbyCount: place?.nearbyCount ?? null,
    nearestDistanceKm: place?.nearestDistanceKm ?? null,
  }
}

function indoorActivity(outdoor: ActivityRecommendation[]): ActivityRecommendation {
  const available = outdoor.filter((a) => a.availability !== 'unavailable')
  const best = Math.max(0, ...available.map((a) => a.score))
  const score = Math.max(0, Math.min(100, Math.round(100 - best)))
  const level = levelFor(score)
  const negatives = [...new Set(outdoor.flatMap((a) => a.factors.filter((f) => f.score < 40).map((f) => f.note)))].slice(0, 4)
  return {
    activity: 'indoor_activity',
    title: 'Stay indoors',
    icon: '🏠',
    score,
    level: level.level,
    levelLabel: level.label,
    summary: score >= 60 ? '🏠 Better to stay indoors' : '🏠 No need to stay inside',
    reasons: score >= 60 ? negatives : ['Outdoor conditions are acceptable'],
    factors: [],
    availability: 'not_required',
    availabilityNote: 'Available anywhere.',
    nearbyCount: null,
    nearestDistanceKm: null,
  }
}

export function recommendClothing(input: RecommendationInput): ClothingRecommendation {
  const stats = windowStats(input.hourly.length ? input.hourly : [], Math.min(12, input.hourly.length || 1))
  const minFeels = input.hourly.length ? stats.minFeels : input.current.feelsLike
  const maxFeels = input.hourly.length ? stats.maxFeels : input.current.feelsLike
  const items: string[] = []
  const accessories: string[] = []
  const reasons: string[] = []
  let summary: string

  if (maxFeels >= C.hot) {
    summary = 'Hot conditions — light, breathable clothing recommended.'
    items.push('Breathable T-shirt', 'Shorts or linen trousers', 'Breathable sneakers or sandals')
  } else if (maxFeels >= C.warm) {
    summary = 'Warm — light clothing recommended.'
    items.push('T-shirt', 'Light trousers', 'Sneakers')
  } else if (minFeels >= C.mild) {
    summary = 'Mild — a light layer is enough.'
    items.push('Long-sleeve top or T-shirt', 'Light jacket', 'Jeans or trousers')
  } else if (minFeels >= C.cool) {
    summary = 'Cool — dress in layers.'
    items.push('Sweater', 'Jacket', 'Long trousers', 'Closed shoes')
  } else if (minFeels >= C.cold) {
    summary = 'Cold conditions expected.'
    items.push('Warm coat', 'Sweater', 'Long trousers', 'Boots')
    accessories.push('Scarf', 'Gloves')
  } else {
    summary = 'Freezing — heavy winter clothing needed.'
    items.push('Insulated coat', 'Thermal base layer', 'Wool sweater', 'Insulated boots')
    accessories.push('Beanie', 'Gloves', 'Scarf')
  }
  reasons.push(`Feels like ${Math.round(minFeels)}–${Math.round(maxFeels)}°C over the next 12 hours`)

  if (stats.maxProbability >= C.rainProbability || stats.totalMm >= C.rainMm) {
    summary = `Rain is likely. ${summary}`
    items.push('Waterproof jacket', 'Water-resistant shoes')
    accessories.push('Umbrella')
    reasons.push(`Rain chance up to ${Math.round(stats.maxProbability)}%`)
  }
  if (input.hourly.slice(0, 12).some((h) => conditionGroup(h.condition) === 'snow')) {
    items.push('Waterproof boots')
    reasons.push('Snow in the forecast')
  }
  if (Math.max(stats.maxWind, input.current.windSpeed) >= C.windy) {
    accessories.push('Windbreaker')
    reasons.push('Windy conditions')
  }
  const uv = Math.max(stats.maxUv, input.current.uvIndex)
  if (uv >= C.uvSunscreen) {
    accessories.push('Sunglasses', 'Sunscreen SPF 30+', 'Hat')
    reasons.push(`UV index reaches ${Math.round(uv)}`)
  } else if (uv >= C.uvSunglasses) {
    accessories.push('Sunglasses')
  }
  if (input.aqi !== null && input.aqi > C.poorAqi) {
    accessories.push('N95 mask')
    reasons.push(`Air quality is unhealthy (AQI ${Math.round(input.aqi)})`)
  }

  return { summary, items: [...new Set(items)], accessories: [...new Set(accessories)], reasons }
}

export function generateRecommendations(input: RecommendationInput): Recommendations {
  const outdoor = (Object.keys(ACTIVITY_RULES) as Exclude<ActivityType, 'indoor_activity'>[]).map((activity) =>
    scoreActivity(activity, input),
  )
  const indoor = indoorActivity(outdoor)
  const activities = [...outdoor, indoor].sort((a, b) => b.score - a.score)
  const clothing = recommendClothing(input)
  const bestOutdoor = Math.max(0, ...outdoor.filter((a) => a.availability !== 'unavailable').map((a) => a.score))

  const headline =
    indoor.score >= 60
      ? 'Better to stay indoors today.'
      : input.aqi !== null && input.aqi > C.poorAqi
        ? 'Weather is fine, but air quality is unhealthy — keep outdoor exertion short.'
        : bestOutdoor >= 75
        ? 'Good day for outdoor activities.'
        : 'Mixed conditions — plan outdoor time carefully.'

  const stats = windowStats(input.hourly, Math.min(24, input.hourly.length || 1))
  const tips: string[] = []
  if (stats.maxProbability >= 40) tips.push('☂️ Consider carrying an umbrella.')
  if (stats.maxFeels >= 32) tips.push('💧 Drink plenty of water and avoid the midday sun.')
  if (stats.maxUv >= 6) tips.push('🕶️ Wear sunscreen and sunglasses.')
  if (stats.minFeels <= 2) tips.push('🧤 Watch for ice and cover your hands.')
  if (input.aqi !== null && input.aqi > 100) tips.push('😷 Sensitive groups should limit time outdoors.')
  const carWash = outdoor.find((a) => a.activity === 'car_wash')
  if (carWash && carWash.score >= 75) tips.push('🚗 Good day for a car wash — no significant rain expected.')

  return { headline, clothing, activities, tips }
}
