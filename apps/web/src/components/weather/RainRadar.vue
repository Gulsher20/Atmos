<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useIntervalFn } from '@vueuse/core'
import { Minus, Pause, Play, Plus } from 'lucide-vue-next'
import { useMotion } from '@/composables/useMotion'

const props = defineProps<{
  latitude: number
  longitude: number
  name: string
  timezone: string
}>()

const TILE = 256
const MIN_ZOOM = 4
const MAX_ZOOM = 9

interface Frame {
  time: number
  path: string
  forecast: boolean
}

interface Manifest {
  host: string
  radar: {
    past?: { time: number; path: string }[]
    nowcast?: { time: number; path: string }[]
  }
}

interface BaseTile {
  key: string
  left: number
  top: number
  base: string
}

interface RadarTile {
  key: string
  left: number
  top: number
  size: number
  url: string
}

let cached: { at: number; frames: Frame[]; host: string } | null = null

const { reduced } = useMotion()
const zoom = ref(6)
const stage = ref<HTMLElement | null>(null)
const size = ref({ w: 0, h: 0 })
const frames = ref<Frame[]>([])
const host = ref('https://tilecache.rainviewer.com')
const index = ref(0)
const status = ref<'loading' | 'ready' | 'error'>('loading')

const frame = computed(() => frames.value[index.value] ?? null)

function project(lat: number, lon: number, z: number) {
  const n = 2 ** z
  const x = ((lon + 180) / 360) * n
  const rad = (lat * Math.PI) / 180
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n
  return { x, y }
}

const layers = computed(() => {
  const empty = { base: [] as BaseTile[], radar: [] as RadarTile[] }
  const w = size.value.w
  const h = size.value.h
  const current = frame.value
  if (!w || !h || !current) return empty
  const z = zoom.value
  const radarZoom = Math.min(z, 7)
  const scale = 2 ** (z - radarZoom)
  const n = 2 ** z
  const radarN = 2 ** radarZoom
  const center = project(props.latitude, props.longitude, z)
  const originX = center.x * TILE - w / 2
  const originY = center.y * TILE - h / 2
  const x0 = Math.floor(originX / TILE)
  const y0 = Math.floor(originY / TILE)
  const x1 = Math.floor((originX + w - 1) / TILE)
  const y1 = Math.floor((originY + h - 1) / TILE)
  const radarSpan = TILE * scale
  const rx0 = Math.floor(originX / radarSpan)
  const ry0 = Math.floor(originY / radarSpan)
  const rx1 = Math.floor((originX + w - 1) / radarSpan)
  const ry1 = Math.floor((originY + h - 1) / radarSpan)
  const base: BaseTile[] = []
  const radar: RadarTile[] = []
  for (let x = x0; x <= x1; x += 1) {
    const wrapped = ((x % n) + n) % n
    for (let y = y0; y <= y1; y += 1) {
      if (y < 0 || y >= n) continue
      base.push({
        key: `${z}/${wrapped}/${y}`,
        left: x * TILE - originX,
        top: y * TILE - originY,
        base: `https://tile.openstreetmap.org/${z}/${wrapped}/${y}.png`,
      })
    }
  }
  for (let x = rx0; x <= rx1; x += 1) {
    const wrapped = ((x % radarN) + radarN) % radarN
    for (let y = ry0; y <= ry1; y += 1) {
      if (y < 0 || y >= radarN) continue
      radar.push({
        key: `${current.path}/${radarZoom}/${wrapped}/${y}`,
        left: x * radarSpan - originX,
        top: y * radarSpan - originY,
        size: radarSpan,
        url: `${host.value}${current.path}/256/${radarZoom}/${wrapped}/${y}/2/1_1.png`,
      })
    }
  }
  return { base, radar }
})

function hideBroken(event: Event) {
  const img = event.target
  if (img instanceof HTMLImageElement) img.style.visibility = 'hidden'
}

function latestObserved(list: Frame[]) {
  let found = 0
  list.forEach((item, i) => {
    if (!item.forecast) found = i
  })
  return found
}

async function load() {
  status.value = frames.value.length ? 'ready' : 'loading'
  try {
    if (!cached || Date.now() - cached.at > 4 * 60_000) {
      const response = await fetch('https://api.rainviewer.com/public/weather-maps.json')
      if (!response.ok) throw new Error('radar')
      const data = (await response.json()) as Manifest
      const past = (data.radar.past ?? []).map((item) => ({ ...item, forecast: false }))
      const nowcast = (data.radar.nowcast ?? []).map((item) => ({ ...item, forecast: true }))
      cached = {
        at: Date.now(),
        frames: [...past, ...nowcast],
        host: data.host.replace(/\/$/, ''),
      }
    }
    frames.value = cached.frames
    host.value = cached.host
    index.value = latestObserved(cached.frames)
    status.value = cached.frames.length ? 'ready' : 'error'
  } catch {
    if (!frames.value.length) status.value = 'error'
  }
}

const { pause, resume, isActive } = useIntervalFn(() => {
  if (!frames.value.length || document.hidden) return
  index.value = (index.value + 1) % frames.value.length
}, 800, { immediate: false })

function toggle() {
  if (isActive.value) pause()
  else resume()
}

function zoomOut() {
  zoom.value = Math.max(MIN_ZOOM, zoom.value - 1)
}

function zoomIn() {
  zoom.value = Math.min(MAX_ZOOM, zoom.value + 1)
}

function clock(time: number) {
  const zone = props.timezone || 'UTC'
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: zone,
    }).format(time * 1000)
  } catch {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(time * 1000)
  }
}

watch(() => [props.latitude, props.longitude] as const, () => {
  void load()
})

watch(reduced, (value) => {
  if (value) pause()
})

let observer: ResizeObserver | null = null
onMounted(() => {
  if (reduced.value) pause()
  else resume()
  void load()
  const el = stage.value
  if (!el) return
  observer = new ResizeObserver(() => {
    size.value = { w: el.clientWidth, h: el.clientHeight }
  })
  observer.observe(el)
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
  <section class="b-card p-4 sm:p-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="font-mono text-[10px] font-bold uppercase tracking-widest">Precipitation</p>
        <h2 class="font-display text-3xl uppercase leading-none">Rain radar</h2>
      </div>
      <p class="max-w-[40%] truncate text-right font-mono text-[10px] font-bold uppercase">{{ name }}</p>
    </div>

    <div ref="stage" class="relative mt-4 h-72 overflow-hidden border-3 border-ink bg-[#e4dfd3] sm:h-80">
      <template v-if="status === 'ready'">
        <img
          v-for="tile in layers.base"
          :key="`base-${tile.key}`"
          :src="tile.base"
          alt=""
          draggable="false"
          class="pointer-events-none absolute h-64 w-64 max-w-none"
          :style="{ left: `${tile.left}px`, top: `${tile.top}px` }"
          @error="hideBroken"
        />
        <img
          v-for="tile in layers.radar"
          :key="`radar-${tile.key}`"
          :src="tile.url"
          alt=""
          draggable="false"
          class="pointer-events-none absolute max-w-none"
          :style="{ left: `${tile.left}px`, top: `${tile.top}px`, width: `${tile.size}px`, height: `${tile.size}px` }"
          @error="hideBroken"
        />
        <div class="pointer-events-none absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 border-3 border-ink bg-flame" />
      </template>
      <p v-else-if="status === 'loading'" class="absolute inset-0 grid place-items-center font-mono text-xs font-bold uppercase">
        Loading radar
      </p>
      <p v-else class="absolute inset-0 grid place-items-center px-6 text-center font-mono text-xs font-bold uppercase">
        Rain radar is unavailable right now.
      </p>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" class="b-btn px-3 py-2" :disabled="status !== 'ready'" @click="toggle">
        <Pause v-if="isActive" :size="14" />
        <Play v-else :size="14" />
        {{ isActive ? 'Pause' : 'Play' }}
      </button>
      <button type="button" class="b-btn px-3 py-2" :disabled="zoom <= MIN_ZOOM" aria-label="Zoom out" @click="zoomOut">
        <Minus :size="14" />
      </button>
      <button type="button" class="b-btn px-3 py-2" :disabled="zoom >= MAX_ZOOM" aria-label="Zoom in" @click="zoomIn">
        <Plus :size="14" />
      </button>
      <p class="font-mono text-[11px] font-bold uppercase">
        {{ frame ? clock(frame.time) : '—' }}
        <span v-if="frame?.forecast"> · forecast</span>
      </p>
    </div>

    <div v-if="frames.length" class="mt-3 flex gap-1" role="group" aria-label="Radar frames">
      <button
        v-for="(item, i) in frames"
        :key="item.path"
        type="button"
        class="h-2 min-w-0 flex-1 border-2 border-ink"
        :class="i === index ? 'bg-ink' : item.forecast ? 'bg-sun' : 'bg-paper'"
        :aria-label="clock(item.time)"
        :aria-pressed="i === index"
        @click="index = i"
      />
    </div>

    <p class="mt-3 font-mono text-[10px] font-bold uppercase leading-relaxed">
      No color means no rain in that frame. Radar © RainViewer · © OpenStreetMap contributors
    </p>
  </section>
</template>
