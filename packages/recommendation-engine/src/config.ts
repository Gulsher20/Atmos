import type { ActivityType, ScoreFactor } from '@weather/shared-types'

type FactorKey = ScoreFactor['key']

export interface ActivityRule {
  title: string
  icon: string
  verb: string
  /** Comfortable feels-like range in °C. */
  idealTemp: [number, number]
  /** Wind speed (km/h) at which the wind factor reaches 0. */
  windLimit: number
  /** Hours ahead that rain matters for this activity. */
  rainWindowHours: number
  weights: Record<FactorKey, number>
}

export const ACTIVITY_RULES: Record<Exclude<ActivityType, 'indoor_activity'>, ActivityRule> = {
  cycling: {
    title: 'Cycling',
    icon: '🚴',
    verb: 'cycling',
    idealTemp: [12, 26],
    windLimit: 45,
    rainWindowHours: 6,
    weights: { temperature: 0.25, rain: 0.3, wind: 0.2, uv: 0.05, airQuality: 0.15, humidity: 0.05 },
  },
  running: {
    title: 'Running',
    icon: '🏃',
    verb: 'running',
    idealTemp: [6, 20],
    windLimit: 50,
    rainWindowHours: 3,
    weights: { temperature: 0.3, rain: 0.2, wind: 0.1, uv: 0.1, airQuality: 0.2, humidity: 0.1 },
  },
  walking: {
    title: 'Walking',
    icon: '🚶',
    verb: 'a walk',
    idealTemp: [10, 27],
    windLimit: 60,
    rainWindowHours: 3,
    weights: { temperature: 0.3, rain: 0.3, wind: 0.1, uv: 0.1, airQuality: 0.15, humidity: 0.05 },
  },
  hiking: {
    title: 'Hiking',
    icon: '🥾',
    verb: 'hiking',
    idealTemp: [8, 24],
    windLimit: 50,
    rainWindowHours: 10,
    weights: { temperature: 0.25, rain: 0.3, wind: 0.15, uv: 0.1, airQuality: 0.1, humidity: 0.1 },
  },
  picnic: {
    title: 'Picnic',
    icon: '🧺',
    verb: 'a picnic',
    idealTemp: [18, 29],
    windLimit: 35,
    rainWindowHours: 6,
    weights: { temperature: 0.3, rain: 0.35, wind: 0.15, uv: 0.1, airQuality: 0.05, humidity: 0.05 },
  },
  car_wash: {
    title: 'Car wash',
    icon: '🚗',
    verb: 'a car wash',
    idealTemp: [5, 35],
    windLimit: 60,
    rainWindowHours: 48,
    weights: { temperature: 0.2, rain: 0.7, wind: 0.1, uv: 0, airQuality: 0, humidity: 0 },
  },
  outdoor_sports: {
    title: 'Outdoor sports',
    icon: '⚽',
    verb: 'outdoor sports',
    idealTemp: [10, 25],
    windLimit: 45,
    rainWindowHours: 4,
    weights: { temperature: 0.3, rain: 0.25, wind: 0.15, uv: 0.1, airQuality: 0.15, humidity: 0.05 },
  },
  beach: {
    title: 'Beach',
    icon: '🏖️',
    verb: 'the beach',
    idealTemp: [25, 34],
    windLimit: 40,
    rainWindowHours: 8,
    weights: { temperature: 0.45, rain: 0.3, wind: 0.15, uv: 0.05, airQuality: 0.05, humidity: 0 },
  },
  photography: {
    title: 'Photography',
    icon: '📷',
    verb: 'outdoor photography',
    idealTemp: [0, 30],
    windLimit: 50,
    rainWindowHours: 4,
    weights: { temperature: 0.15, rain: 0.45, wind: 0.2, uv: 0, airQuality: 0.2, humidity: 0 },
  },
  gardening: {
    title: 'Gardening',
    icon: '🌱',
    verb: 'gardening',
    idealTemp: [10, 28],
    windLimit: 45,
    rainWindowHours: 4,
    weights: { temperature: 0.35, rain: 0.25, wind: 0.15, uv: 0.15, airQuality: 0.05, humidity: 0.05 },
  },
}

export const SCORE_LEVELS = [
  { min: 90, level: 'excellent', label: 'Excellent' },
  { min: 75, level: 'good', label: 'Good' },
  { min: 50, level: 'possible', label: 'Possible' },
  { min: 25, level: 'not_ideal', label: 'Not ideal' },
  { min: 0, level: 'avoid', label: 'Avoid' },
] as const

export const CLOTHING_THRESHOLDS = {
  hot: 30,
  warm: 22,
  mild: 15,
  cool: 8,
  cold: 0,
  rainProbability: 50,
  rainMm: 1,
  windy: 30,
  uvSunglasses: 3,
  uvSunscreen: 6,
  poorAqi: 150,
}
