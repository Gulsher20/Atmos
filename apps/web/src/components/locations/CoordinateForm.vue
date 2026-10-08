<script setup lang="ts">
import { computed, ref } from 'vue'
import { Crosshair, LocateFixed } from 'lucide-vue-next'
import { locationsApi, type ReverseResult } from '@/services/api/weather.api'
import { isValidCoordinate } from '@/stores/location.store'

const emit = defineEmits<{ save: [place: ReverseResult & { name: string }] }>()

const lat = ref('')
const lon = ref('')
const name = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const pending = ref<ReverseResult | null>(null)

const latNum = computed(() => Number(lat.value))
const lonNum = computed(() => Number(lon.value))
const latError = computed(() => (lat.value !== '' && !(Number.isFinite(latNum.value) && Math.abs(latNum.value) <= 90) ? 'Latitude must be between -90 and 90' : null))
const lonError = computed(() => (lon.value !== '' && !(Number.isFinite(lonNum.value) && Math.abs(lonNum.value) <= 180) ? 'Longitude must be between -180 and 180' : null))
const valid = computed(() => lat.value !== '' && lon.value !== '' && isValidCoordinate(latNum.value, lonNum.value))

async function lookup(latitude: number, longitude: number) {
  busy.value = true
  error.value = null
  try {
    pending.value = await locationsApi.reverse(latitude, longitude)
    name.value = pending.value.name
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Lookup failed'
  } finally {
    busy.value = false
  }
}

function submit() {
  if (valid.value) void lookup(latNum.value, lonNum.value)
}

function useMyLocation() {
  if (!('geolocation' in navigator)) {
    error.value = 'Geolocation is not available in this browser.'
    return
  }
  busy.value = true
  error.value = null
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      lat.value = pos.coords.latitude.toFixed(4)
      lon.value = pos.coords.longitude.toFixed(4)
      void lookup(pos.coords.latitude, pos.coords.longitude)
    },
    (err) => {
      busy.value = false
      error.value = err.code === err.PERMISSION_DENIED ? 'Location permission denied. You can still type coordinates.' : 'Could not get your position.'
    },
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
  )
}

function save() {
  if (!pending.value) return
  emit('save', { ...pending.value, name: name.value.trim() || pending.value.name })
  discard()
}

function discard() {
  pending.value = null
  lat.value = ''
  lon.value = ''
  name.value = ''
}
</script>

<template>
  <div>
    <form class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" novalidate @submit.prevent="submit">
      <div>
        <label for="lat" class="b-label mb-1.5 block">Latitude</label>
        <input id="lat" v-model.trim="lat" inputmode="decimal" class="b-input" placeholder="33.6844" :aria-invalid="!!latError" />
        <p v-if="latError" class="mt-1 font-mono text-[10px] font-bold uppercase text-flame">{{ latError }}</p>
      </div>
      <div>
        <label for="lon" class="b-label mb-1.5 block">Longitude</label>
        <input id="lon" v-model.trim="lon" inputmode="decimal" class="b-input" placeholder="73.0479" :aria-invalid="!!lonError" />
        <p v-if="lonError" class="mt-1 font-mono text-[10px] font-bold uppercase text-flame">{{ lonError }}</p>
      </div>
      <button type="submit" class="b-btn b-btn-ink self-start sm:mt-[22px]" :disabled="!valid || busy"><Crosshair :size="16" :stroke-width="3" /> Look up</button>
    </form>

    <div class="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" class="b-btn b-btn-sun" :disabled="busy" @click="useMyLocation"><LocateFixed :size="16" :stroke-width="3" /> Use my location</button>
      <p class="text-sm">Your position is only used for this lookup. It's kept on this device only if you press save.</p>
    </div>
    <p v-if="error" class="mt-3 font-mono text-xs font-bold uppercase text-flame">{{ error }}</p>

    <div v-if="pending" class="mt-4 animate-pop border-3 border-ink bg-mint p-4 shadow-brutal-sm">
      <p class="b-label">Found</p>
      <p class="b-title text-3xl">{{ pending.name }}</p>
      <p class="text-sm">{{ [pending.region, pending.country].filter(Boolean).join(', ') }} · {{ pending.latitude.toFixed(4) }}, {{ pending.longitude.toFixed(4) }} · {{ pending.timezone }}</p>
      <label for="place-name" class="b-label mb-1 mt-3 block">Save as</label>
      <input id="place-name" v-model="name" maxlength="60" class="b-input" />
      <div class="mt-3 flex gap-3">
        <button type="button" class="b-btn b-btn-ink" @click="save">Save place</button>
        <button type="button" class="b-btn" @click="discard">Discard</button>
      </div>
    </div>
  </div>
</template>
