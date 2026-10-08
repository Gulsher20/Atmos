import type { ActivityRecommendation, ActivityType } from '@weather/shared-types'
import { config } from '../config'
import { getKv, setKv } from '../database/db'
import { cached, locationKey } from '../lib/cache'

type Context = Pick<ActivityRecommendation, 'availability' | 'availabilityNote' | 'nearbyCount' | 'nearestDistanceKm'>
export type ActivityContext = Partial<Record<ActivityType, Context>>

interface OsmElement {
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements?: OsmElement[]
}

const DAY = 24 * 60 * 60_000

// overpass-api.de and several mirrors were returning 504/500. These two answered
// with real map data. A failed server is skipped for two minutes; the others are still tried.
const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const ENDPOINT_COOLDOWN_MS = 2 * 60_000
const downUntil = new Map<string, number>()

/** One lookup at a time. Six places loading together was getting every request rejected. */
let overpassQueue: Promise<unknown> = Promise.resolve()
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const result = overpassQueue.then(task, task)
  overpassQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

async function postOverpass(endpoint: string, query: string): Promise<OverpassResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(20_000),
    headers: {
      'User-Agent': config.userAgent,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  })
  if (!response.ok) throw new Error(`Overpass responded with ${response.status}`)
  const data = (await response.json()) as OverpassResponse
  if (!Array.isArray(data.elements)) throw new Error('Malformed Overpass response')
  return data
}

async function queryOverpass(query: string): Promise<OverpassResponse> {
  return oneAtATime(async () => {
    const now = Date.now()
    const open = OVERPASS_ENDPOINTS.filter((endpoint) => (downUntil.get(endpoint) ?? 0) <= now)
    const targets = open.length ? open : OVERPASS_ENDPOINTS
    let lastError: unknown
    for (const endpoint of targets) {
      try {
        return await postOverpass(endpoint, query)
      } catch (error) {
        downUntil.set(endpoint, Date.now() + ENDPOINT_COOLDOWN_MS)
        lastError = error
      }
    }
    throw lastError
  })
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function matching(
  elements: OsmElement[],
  latitude: number,
  longitude: number,
  predicate: (tags: Record<string, string>) => boolean,
): { count: number; nearest: number | null } {
  const hits = elements.filter((e) => predicate(e.tags ?? {}))
  const distances = hits
    .map((e) => {
      const lat = e.lat ?? e.center?.lat
      const lon = e.lon ?? e.center?.lon
      return lat === undefined || lon === undefined ? null : distanceKm(latitude, longitude, lat, lon)
    })
    .filter((d): d is number => d !== null)
  return { count: hits.length, nearest: distances.length ? Math.min(...distances) : null }
}

function availability(
  result: { count: number; nearest: number | null },
  availableText: string,
  unavailableText: string,
): Context {
  return {
    availability: result.count > 0 ? 'available' : 'unavailable',
    availabilityNote:
      result.count > 0
        ? `${availableText}${result.nearest === null ? '' : `; nearest about ${Math.max(0.1, result.nearest).toFixed(1)} km away`}.`
        : unavailableText,
    nearbyCount: result.count,
    nearestDistanceKm: result.nearest === null ? null : Math.round(result.nearest * 10) / 10,
  }
}

const anywhere = (note: string): Context => ({
  availability: 'not_required',
  availabilityNote: note,
  nearbyCount: null,
  nearestDistanceKm: null,
})

/**
 * Live nearby-place context from OpenStreetMap via Overpass.
 * Absence is only used for activities that require a physical feature/facility.
 */
async function fetchActivityContext(latitude: number, longitude: number): Promise<ActivityContext> {
  const at = `${latitude},${longitude}`
  const query = `[out:json][timeout:12];
(
  nwr(around:75000,${at})["natural"="beach"];
  nwr(around:75000,${at})["leisure"="beach_resort"];
)->.beaches;
(
  relation(around:50000,${at})["route"="hiking"];
  nwr(around:50000,${at})["natural"="peak"];
)->.hiking;
(
  nwr(around:50000,${at})["tourism"="viewpoint"];
)->.views;
(
  relation(around:35000,${at})["route"="bicycle"];
  nwr(around:25000,${at})["highway"="cycleway"];
)->.cycling;
(
  nwr(around:25000,${at})["amenity"="car_wash"];
)->.carwash;
(
  nwr(around:20000,${at})["tourism"="picnic_site"];
  nwr(around:20000,${at})["leisure"="park"];
)->.picnic;
(
  nwr(around:20000,${at})["leisure"="pitch"];
  nwr(around:20000,${at})["leisure"="sports_centre"];
)->.sports;
(
  nwr(around:15000,${at})["leisure"="garden"];
  nwr(around:15000,${at})["landuse"="allotments"];
)->.gardens;
way(around:75000,${at})["natural"="coastline"]->.coast;
(.coast;); out tags 1;
(.beaches;); out center tags 20;
(.hiking;); out center tags 20;
(.views;); out center tags 20;
(.cycling;); out center tags 20;
(.carwash;); out center tags 20;
(.picnic;); out center tags 20;
(.sports;); out center tags 20;
(.gardens;); out center tags 20;`
  const data = await queryOverpass(query)
  const elements = (data.elements ?? []).slice(0, 170)

  // Unnamed river/lake shores are often tagged natural=beach; only count them near a sea coast.
  const nearCoast = elements.some((e) => e.tags?.natural === 'coastline')
  const beach = matching(
    elements,
    latitude,
    longitude,
    (t) => t.leisure === 'beach_resort' || (t.natural === 'beach' && (nearCoast || Boolean(t.name))),
  )
  // Sand dunes and small hillocks are sometimes tagged as peaks; require real elevation.
  const hiking = matching(
    elements,
    latitude,
    longitude,
    (t) => t.route === 'hiking' || (t.natural === 'peak' && Number.parseFloat(t.ele ?? '') >= 500),
  )
  const cycle = matching(elements, latitude, longitude, (t) => t.route === 'bicycle' || t.highway === 'cycleway')
  const carWash = matching(elements, latitude, longitude, (t) => t.amenity === 'car_wash')
  const picnic = matching(elements, latitude, longitude, (t) => t.tourism === 'picnic_site' || t.leisure === 'park')
  const sports = matching(elements, latitude, longitude, (t) => t.leisure === 'pitch' || t.leisure === 'sports_centre')
  const garden = matching(elements, latitude, longitude, (t) => t.leisure === 'garden' || t.landuse === 'allotments')
  const viewpoint = matching(elements, latitude, longitude, (t) => t.tourism === 'viewpoint')

  return {
    beach: availability(beach, `${beach.count} mapped beach${beach.count === 1 ? '' : 'es'} found within 75 km`, 'No sea beach, named beach or beach resort within 75 km.'),
    hiking: availability(hiking, `${hiking.count} mapped hiking route${hiking.count === 1 ? '' : 's'} or peak${hiking.count === 1 ? '' : 's'} (500 m+) found within 50 km`, 'No mapped hiking route or peak above 500 m within 50 km.'),
    car_wash: availability(carWash, `${carWash.count} mapped car wash${carWash.count === 1 ? '' : 'es'} found within 25 km`, 'No mapped car-wash facility within 25 km.'),
    picnic: availability(picnic, `${picnic.count} mapped park${picnic.count === 1 ? '' : 's'} or picnic site${picnic.count === 1 ? '' : 's'} found within 20 km`, 'No mapped park or picnic site within 20 km.'),
    outdoor_sports: availability(sports, `${sports.count} mapped sports area${sports.count === 1 ? '' : 's'} found within 20 km`, 'No mapped pitch or sports centre within 20 km.'),
    gardening: availability(garden, `${garden.count} mapped public garden${garden.count === 1 ? '' : 's'} or allotment${garden.count === 1 ? '' : 's'} found within 15 km`, 'No mapped public garden or allotment within 15 km.'),
    cycling:
      cycle.count > 0
        ? availability(cycle, `${cycle.count} mapped cycle route${cycle.count === 1 ? '' : 's'} found within 35 km`, '')
        : anywhere('No dedicated cycle route is mapped nearby; ordinary roads may still be usable.'),
    photography:
      viewpoint.count > 0
        ? availability(viewpoint, `${viewpoint.count} mapped viewpoint${viewpoint.count === 1 ? '' : 's'} found within 50 km`, '')
        : anywhere('Photography does not require a mapped venue; no dedicated viewpoint was found nearby.'),
    walking: anywhere('Walking does not require a special venue.'),
    running: anywhere('Running does not require a special venue.'),
    indoor_activity: anywhere('Indoor activities are available anywhere.'),
  }
}

const STORE_PREFIX = 'activity-v2:'
const STORED_FRESH_MS = 30 * DAY

interface StoredContext {
  fetchedAt: number
  context: ActivityContext
}

function readStored(key: string): StoredContext | null {
  try {
    const raw = getKv(STORE_PREFIX + key)
    return raw ? (JSON.parse(raw) as StoredContext) : null
  } catch {
    return null
  }
}

/**
 * Mapped places change slowly, so results persist in SQLite for 30 days and an
 * older copy is preferred over "unknown" when Overpass is down.
 */
async function loadActivityContext(latitude: number, longitude: number): Promise<ActivityContext> {
  const key = locationKey(latitude, longitude)
  const stored = readStored(key)
  if (stored && Date.now() - stored.fetchedAt < STORED_FRESH_MS) return stored.context
  try {
    const context = await fetchActivityContext(latitude, longitude)
    setKv(STORE_PREFIX + key, JSON.stringify({ fetchedAt: Date.now(), context } satisfies StoredContext))
    return context
  } catch (error) {
    if (stored) return stored.context
    throw error
  }
}

export async function getActivityContext(latitude: number, longitude: number): Promise<ActivityContext> {
  return (await cached(`activity:${locationKey(latitude, longitude)}`, DAY, () => loadActivityContext(latitude, longitude))).value
}

export function unknownActivityContext(): ActivityContext {
  const unknown: Context = {
    availability: 'unknown',
    availabilityNote: 'Live nearby-place data is temporarily unavailable; score uses weather only.',
    nearbyCount: null,
    nearestDistanceKm: null,
  }
  return Object.fromEntries(
    ['beach', 'hiking', 'car_wash', 'picnic', 'outdoor_sports', 'gardening', 'cycling', 'photography'].map((key) => [key, unknown]),
  ) as ActivityContext
}
