export type ActivityType =
  | 'cycling'
  | 'running'
  | 'walking'
  | 'hiking'
  | 'picnic'
  | 'car_wash'
  | 'outdoor_sports'
  | 'beach'
  | 'photography'
  | 'gardening'
  | 'indoor_activity'

export type ScoreLevel = 'excellent' | 'good' | 'possible' | 'not_ideal' | 'avoid'

export interface ScoreFactor {
  key: 'temperature' | 'rain' | 'wind' | 'uv' | 'airQuality' | 'humidity'
  label: string
  score: number // 0-100
  note: string
}

export type ActivityAvailability = 'available' | 'unavailable' | 'unknown' | 'not_required'

export interface ActivityRecommendation {
  activity: ActivityType
  title: string
  icon: string
  score: number // 0-100
  level: ScoreLevel
  levelLabel: string
  summary: string
  reasons: string[]
  factors: ScoreFactor[]
  availability: ActivityAvailability
  availabilityNote: string
  nearbyCount: number | null
  nearestDistanceKm: number | null
}

export interface ClothingRecommendation {
  summary: string
  items: string[]
  accessories: string[]
  reasons: string[]
}

export interface Recommendations {
  headline: string
  clothing: ClothingRecommendation
  activities: ActivityRecommendation[]
  tips: string[]
}

export interface UnitPreferences {
  temperature: 'celsius' | 'fahrenheit'
  windSpeed: 'kmh' | 'mph'
  precipitation: 'mm' | 'inch'
  distance: 'km' | 'miles'
}
