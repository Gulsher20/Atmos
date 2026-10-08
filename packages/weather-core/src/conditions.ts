import type { ConditionGroup, WeatherCondition, WeatherSeverity } from '@weather/shared-types'

export function conditionGroup(condition: WeatherCondition): ConditionGroup {
  if (condition.startsWith('thunderstorm')) return 'thunderstorm'
  if (condition.includes('snow') || condition === 'snow_grains') return 'snow'
  if (condition === 'heavy_rain' || condition === 'violent_rain_showers' || condition === 'heavy_freezing_rain') return 'heavy_rain'
  if (condition.includes('rain')) return 'rain'
  if (condition.includes('drizzle')) return 'drizzle'
  if (condition.includes('fog')) return 'fog'
  if (condition === 'overcast' || condition === 'partly_cloudy') return 'cloudy'
  if (condition === 'clear_sky' || condition === 'mainly_clear') return 'clear'
  return 'unknown'
}

/** Representative condition for a group, used when voting across providers. */
export const GROUP_CONDITION: Record<ConditionGroup, WeatherCondition> = {
  clear: 'clear_sky',
  cloudy: 'partly_cloudy',
  fog: 'fog',
  drizzle: 'light_drizzle',
  rain: 'moderate_rain',
  heavy_rain: 'heavy_rain',
  snow: 'moderate_snow',
  thunderstorm: 'thunderstorm',
  unknown: 'unknown',
}

export const GROUP_LABEL: Record<ConditionGroup, string> = {
  clear: 'Clear',
  cloudy: 'Cloudy',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  heavy_rain: 'Heavy rain',
  snow: 'Snow',
  thunderstorm: 'Thunderstorm',
  unknown: 'Unknown',
}

export interface ConditionMeta {
  code: WeatherCondition
  label: string
  description: string
  severity: WeatherSeverity
  icon: string
  cssClass: string
}

export const CONDITION_METADATA: Record<WeatherCondition, ConditionMeta> = {
  clear_sky: {
    code: 'clear_sky',
    label: 'Clear Sky',
    description: 'Clear sunny or starry skies',
    severity: 'normal',
    icon: 'sun',
    cssClass: 'weather-clear',
  },
  mainly_clear: {
    code: 'mainly_clear',
    label: 'Mainly Clear',
    description: 'Mostly clear with few clouds',
    severity: 'normal',
    icon: 'sun-cloud',
    cssClass: 'weather-mainly-clear',
  },
  partly_cloudy: {
    code: 'partly_cloudy',
    label: 'Partly Cloudy',
    description: 'Scattered clouds',
    severity: 'normal',
    icon: 'cloud-sun',
    cssClass: 'weather-partly-cloudy',
  },
  overcast: {
    code: 'overcast',
    label: 'Overcast',
    description: 'Dense cloudy skies',
    severity: 'normal',
    icon: 'cloud',
    cssClass: 'weather-overcast',
  },
  fog: {
    code: 'fog',
    label: 'Fog',
    description: 'Visibility restricted by low fog',
    severity: 'moderate',
    icon: 'smog',
    cssClass: 'weather-fog',
  },
  depositing_rime_fog: {
    code: 'depositing_rime_fog',
    label: 'Rime Fog',
    description: 'Freezing fog depositing ice crystals',
    severity: 'moderate',
    icon: 'smog-ice',
    cssClass: 'weather-rime-fog',
  },
  light_drizzle: {
    code: 'light_drizzle',
    label: 'Light Drizzle',
    description: 'Fine light rain droplets',
    severity: 'normal',
    icon: 'cloud-drizzle',
    cssClass: 'weather-drizzle',
  },
  moderate_drizzle: {
    code: 'moderate_drizzle',
    label: 'Moderate Drizzle',
    description: 'Steady light drizzle',
    severity: 'normal',
    icon: 'cloud-drizzle',
    cssClass: 'weather-drizzle',
  },
  dense_drizzle: {
    code: 'dense_drizzle',
    label: 'Dense Drizzle',
    description: 'Heavy precipitation drizzle',
    severity: 'moderate',
    icon: 'cloud-rain',
    cssClass: 'weather-dense-drizzle',
  },
  light_freezing_drizzle: {
    code: 'light_freezing_drizzle',
    label: 'Light Freezing Drizzle',
    description: 'Freezing rain droplets creating icy surfaces',
    severity: 'severe',
    icon: 'snowflake-drizzle',
    cssClass: 'weather-freezing-drizzle',
  },
  dense_freezing_drizzle: {
    code: 'dense_freezing_drizzle',
    label: 'Dense Freezing Drizzle',
    description: 'Significant freezing drizzle hazard',
    severity: 'severe',
    icon: 'snowflake-drizzle',
    cssClass: 'weather-freezing-drizzle',
  },
  slight_rain: {
    code: 'slight_rain',
    label: 'Slight Rain',
    description: 'Light rainfall',
    severity: 'normal',
    icon: 'cloud-rain',
    cssClass: 'weather-rain-slight',
  },
  moderate_rain: {
    code: 'moderate_rain',
    label: 'Moderate Rain',
    description: 'Steady rain shower',
    severity: 'normal',
    icon: 'cloud-showers-heavy',
    cssClass: 'weather-rain-moderate',
  },
  heavy_rain: {
    code: 'heavy_rain',
    label: 'Heavy Rain',
    description: 'Downpour of rain',
    severity: 'severe',
    icon: 'cloud-showers-heavy',
    cssClass: 'weather-rain-heavy',
  },
  light_freezing_rain: {
    code: 'light_freezing_rain',
    label: 'Light Freezing Rain',
    description: 'Rain freezing on impact',
    severity: 'severe',
    icon: 'cloud-sleet',
    cssClass: 'weather-freezing-rain',
  },
  heavy_freezing_rain: {
    code: 'heavy_freezing_rain',
    label: 'Heavy Freezing Rain',
    description: 'Heavy rain causing rapid ice buildup',
    severity: 'extreme',
    icon: 'cloud-sleet',
    cssClass: 'weather-freezing-rain-heavy',
  },
  slight_snow: {
    code: 'slight_snow',
    label: 'Slight Snow',
    description: 'Light snowfall',
    severity: 'normal',
    icon: 'snowflake',
    cssClass: 'weather-snow-slight',
  },
  moderate_snow: {
    code: 'moderate_snow',
    label: 'Moderate Snow',
    description: 'Steady snow accumulation',
    severity: 'moderate',
    icon: 'snowflake',
    cssClass: 'weather-snow-moderate',
  },
  heavy_snow: {
    code: 'heavy_snow',
    label: 'Heavy Snowfall',
    description: 'Heavy blizzard-like snow',
    severity: 'severe',
    icon: 'snowflake-heavy',
    cssClass: 'weather-snow-heavy',
  },
  snow_grains: {
    code: 'snow_grains',
    label: 'Snow Grains',
    description: 'Small frozen grains of ice/snow',
    severity: 'normal',
    icon: 'snowflake',
    cssClass: 'weather-snow-grains',
  },
  slight_rain_showers: {
    code: 'slight_rain_showers',
    label: 'Slight Rain Showers',
    description: 'Passing light rain showers',
    severity: 'normal',
    icon: 'cloud-sun-rain',
    cssClass: 'weather-showers-slight',
  },
  moderate_rain_showers: {
    code: 'moderate_rain_showers',
    label: 'Moderate Rain Showers',
    description: 'Passing rain showers',
    severity: 'normal',
    icon: 'cloud-rain',
    cssClass: 'weather-showers-moderate',
  },
  violent_rain_showers: {
    code: 'violent_rain_showers',
    label: 'Violent Rain Showers',
    description: 'Torrential localized showers',
    severity: 'severe',
    icon: 'cloud-showers-water',
    cssClass: 'weather-showers-violent',
  },
  slight_snow_showers: {
    code: 'slight_snow_showers',
    label: 'Slight Snow Showers',
    description: 'Passing snow flurries',
    severity: 'normal',
    icon: 'cloud-snow',
    cssClass: 'weather-snow-showers',
  },
  heavy_snow_showers: {
    code: 'heavy_snow_showers',
    label: 'Heavy Snow Showers',
    description: 'Burst of intense snowfall',
    severity: 'severe',
    icon: 'cloud-snow',
    cssClass: 'weather-snow-showers-heavy',
  },
  thunderstorm: {
    code: 'thunderstorm',
    label: 'Thunderstorm',
    description: 'Thunder and lightning expected',
    severity: 'severe',
    icon: 'cloud-bolt',
    cssClass: 'weather-thunderstorm',
  },
  thunderstorm_slight_hail: {
    code: 'thunderstorm_slight_hail',
    label: 'Thunderstorm with Hail',
    description: 'Electrical storm with small hail',
    severity: 'severe',
    icon: 'cloud-hail',
    cssClass: 'weather-thunderstorm-hail',
  },
  thunderstorm_heavy_hail: {
    code: 'thunderstorm_heavy_hail',
    label: 'Severe Hailstorm',
    description: 'Dangerous storm with heavy hail',
    severity: 'extreme',
    icon: 'cloud-hail-mixed',
    cssClass: 'weather-hailstorm',
  },
  unknown: {
    code: 'unknown',
    label: 'Unknown',
    description: 'Unspecified weather condition',
    severity: 'normal',
    icon: 'question',
    cssClass: 'weather-unknown',
  },
}

export function getConditionMeta(code: WeatherCondition): ConditionMeta {
  return CONDITION_METADATA[code] || CONDITION_METADATA.unknown
}

export function WmoCodeToCondition(wmoCode: number): WeatherCondition {
  switch (wmoCode) {
    case 0:
      return 'clear_sky'
    case 1:
      return 'mainly_clear'
    case 2:
      return 'partly_cloudy'
    case 3:
      return 'overcast'
    case 45:
      return 'fog'
    case 48:
      return 'depositing_rime_fog'
    case 51:
      return 'light_drizzle'
    case 53:
      return 'moderate_drizzle'
    case 55:
      return 'dense_drizzle'
    case 56:
      return 'light_freezing_drizzle'
    case 57:
      return 'dense_freezing_drizzle'
    case 61:
      return 'slight_rain'
    case 63:
      return 'moderate_rain'
    case 65:
      return 'heavy_rain'
    case 66:
      return 'light_freezing_rain'
    case 67:
      return 'heavy_freezing_rain'
    case 71:
      return 'slight_snow'
    case 73:
      return 'moderate_snow'
    case 75:
      return 'heavy_snow'
    case 77:
      return 'snow_grains'
    case 80:
      return 'slight_rain_showers'
    case 81:
      return 'moderate_rain_showers'
    case 82:
      return 'violent_rain_showers'
    case 85:
      return 'slight_snow_showers'
    case 86:
      return 'heavy_snow_showers'
    case 95:
      return 'thunderstorm'
    case 96:
      return 'thunderstorm_slight_hail'
    case 99:
      return 'thunderstorm_heavy_hail'
    default:
      return 'unknown'
  }
}
