import type { GeocodingResult } from '@weather/shared-types'
import { z } from 'zod'
import { fetchJson } from '../lib/http'
import { searchLocations } from '../providers/open-meteo/open-meteo.provider'

const NominatimSchema = z.array(
  z.object({
    place_id: z.number(),
    lat: z.string(),
    lon: z.string(),
    name: z.string().optional(),
    display_name: z.string(),
    category: z.string().optional(),
    importance: z.number().optional(),
    address: z.record(z.string(), z.string()).optional(),
  }),
)

const PLACE_CATEGORIES = new Set(['place', 'boundary', 'natural', 'landuse', 'tourism', 'leisure'])
const NOTABLE_IMPORTANCE = 0.45

type Ranked = GeocodingResult & { notable?: boolean }

/** Nominatim also knows deserts, districts and regions (e.g. "Thar Desert", "Tharparkar") that the city gazetteer lacks. */
async function searchNominatim(query: string): Promise<Ranked[]> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=8&addressdetails=1&accept-language=en`
  const { data } = await fetchJson('nominatim', url)
  return NominatimSchema.parse(data)
    .filter((r) => !r.category || PLACE_CATEGORIES.has(r.category))
    .map((r) => ({
      notable: (r.importance ?? 0) >= NOTABLE_IMPORTANCE,
      id: `osm-${r.place_id}`,
      name: r.name || r.display_name.split(',')[0]!.trim(),
      country: r.address?.country,
      region: r.address?.state ?? r.address?.region ?? r.address?.county,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      // Resolved from the first forecast for this place.
      timezone: 'UTC',
    }))
}

const isSamePlace = (a: GeocodingResult, b: GeocodingResult) =>
  Math.abs(a.latitude - b.latitude) < 0.05 && Math.abs(a.longitude - b.longitude) < 0.05

export async function searchPlaces(query: string): Promise<GeocodingResult[]> {
  const [cities, osm] = await Promise.allSettled([searchLocations(query), searchNominatim(query)])
  if (cities.status === 'rejected' && osm.status === 'rejected') throw cities.reason
  const primary = cities.status === 'fulfilled' ? cities.value : []
  const extra = osm.status === 'fulfilled' ? osm.value.filter((o) => !primary.some((c) => isSamePlace(c, o))) : []
  const lowered = query.toLowerCase()
  const rank = (r: Ranked) => {
    const name = r.name.toLowerCase()
    return (r.notable ? 2 : 0) + (name === lowered || name.startsWith(`${lowered} `) ? 1 : 0)
  }
  return ([...primary, ...extra] as Ranked[])
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 12)
    .map(({ notable: _notable, ...result }) => result)
}
