import type { AirQualityCategory } from '@weather/shared-types'

export interface AqiMeta {
  category: AirQualityCategory
  label: string
  color: string
  bgColor: string
  textColor: string
  description: string
  healthAdvice: string
}

export function getAqiCategory(aqi: number): AirQualityCategory {
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'unhealthy_sensitive'
  if (aqi <= 200) return 'unhealthy'
  if (aqi <= 300) return 'very_unhealthy'
  return 'hazardous'
}

export const AQI_METADATA: Record<AirQualityCategory, AqiMeta> = {
  good: {
    category: 'good',
    label: 'Good',
    color: '#10B981', // Emerald 500
    bgColor: 'rgba(16, 185, 129, 0.15)',
    textColor: '#047857',
    description: 'Air quality is considered satisfactory, and air pollution poses little or no risk.',
    healthAdvice: 'Air quality is great. Enjoy outdoor activities freely!',
  },
  moderate: {
    category: 'moderate',
    label: 'Moderate',
    color: '#F59E0B', // Amber 500
    bgColor: 'rgba(245, 158, 11, 0.15)',
    textColor: '#B45309',
    description: 'Air quality is acceptable. However, some pollutants may be a concern for a very small number of sensitive individuals.',
    healthAdvice: 'Unusually sensitive individuals should consider limiting prolonged outdoor exertion.',
  },
  unhealthy_sensitive: {
    category: 'unhealthy_sensitive',
    label: 'Unhealthy for Sensitive Groups',
    color: '#F97316', // Orange 500
    bgColor: 'rgba(249, 115, 22, 0.15)',
    textColor: '#C2410C',
    description: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
    healthAdvice: 'Children, elderly, and people with respiratory or heart conditions should reduce prolonged outdoor exertion.',
  },
  unhealthy: {
    category: 'unhealthy',
    label: 'Unhealthy',
    color: '#EF4444', // Red 500
    bgColor: 'rgba(239, 68, 68, 0.15)',
    textColor: '#B91C1C',
    description: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.',
    healthAdvice: 'Everyone should reduce outdoor activity. Wear a mask if spending extended time outside.',
  },
  very_unhealthy: {
    category: 'very_unhealthy',
    label: 'Very Unhealthy',
    color: '#8B5CF6', // Purple 500
    bgColor: 'rgba(139, 92, 246, 0.15)',
    textColor: '#6D28D9',
    description: 'Health alert: The risk of health effects is increased for everyone.',
    healthAdvice: 'Avoid outdoor exertion. Keep windows closed and run an air purifier indoors.',
  },
  hazardous: {
    category: 'hazardous',
    label: 'Hazardous',
    color: '#881337', // Rose 900
    bgColor: 'rgba(136, 19, 55, 0.15)',
    textColor: '#881337',
    description: 'Health warning of emergency conditions: everyone is more likely to be affected.',
    healthAdvice: 'Stay indoors! Keep doors and windows closed. Use high-efficiency air filtration.',
  },
}

export function getAqiMeta(aqi: number): AqiMeta {
  const cat = getAqiCategory(aqi)
  return AQI_METADATA[cat]
}
