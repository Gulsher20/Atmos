export interface HistoryDay {
  date: string
  tempMax: number | null
  tempMin: number | null
  tempMean: number | null
  precipitation: number | null // mm
  rain: number | null
  snowfall: number | null // cm
  sunshineHours: number | null
  windMax: number | null
  gustMax: number | null
  humidity: number | null
  cloudCover: number | null
}

export interface HistorySummary {
  avgTemp: number | null
  totalPrecipitation: number | null
  avgWind: number | null
  sunshineHours: number | null
  rainyDays: number
}

export interface HistoryReport {
  start: string
  end: string
  days: HistoryDay[]
  summary: HistorySummary
  previous: HistorySummary | null
  insights: string[]
}

export type HistoryRange = '7d' | '30d' | '3m' | '1y' | 'custom'
