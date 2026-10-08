import type {
  AccuracyMetric,
  AccuracyReport,
  Dashboard,
  GeocodingResult,
  HistoryReport,
  ProviderStatusInfo,
  PushSubscribeRequest,
} from '@weather/shared-types'
import { request } from './client'

const coords = (lat: number, lon: number) => `lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`

export const weatherApi = {
  dashboard: (lat: number, lon: number) => request<Dashboard>(`/api/dashboard?${coords(lat, lon)}`),
  history: (lat: number, lon: number, start: string, end: string) =>
    request<HistoryReport>(`/api/history?${coords(lat, lon)}&start=${start}&end=${end}`),
  accuracy: (lat: number, lon: number, metric: AccuracyMetric, horizon: number) =>
    request<AccuracyReport>(`/api/accuracy?${coords(lat, lon)}&metric=${metric}&horizon=${horizon}`),
  providers: () => request<ProviderStatusInfo[]>('/api/providers'),
}

export interface ReverseResult {
  name: string
  region?: string
  country?: string
  latitude: number
  longitude: number
  timezone: string
}

export const locationsApi = {
  search: (q: string) => request<GeocodingResult[]>(`/api/geocode?q=${encodeURIComponent(q)}`),
  reverse: (lat: number, lon: number) => request<ReverseResult>(`/api/reverse?${coords(lat, lon)}`),
}

export const pushApi = {
  key: () => request<{ publicKey: string }>('/api/push/key'),
  subscribe: (body: PushSubscribeRequest) => request<{ subscribed: boolean }>('/api/push/subscribe', { method: 'POST', body: JSON.stringify(body) }),
  unsubscribe: (endpoint: string) => request<{ subscribed: boolean }>('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  test: (endpoint: string) => request<{ sent: boolean }>('/api/push/test', { method: 'POST', body: JSON.stringify({ endpoint }) }),
}
