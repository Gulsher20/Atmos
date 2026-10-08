<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Check, Pencil, Star, Trash2, X } from 'lucide-vue-next'
import type { GeocodingResult, WeatherLocation } from '@weather/shared-types'
import LocationSearch from '@/components/locations/LocationSearch.vue'
import CoordinateForm from '@/components/locations/CoordinateForm.vue'
import WeatherIcon from '@/components/ui/WeatherIcon.vue'
import type { ReverseResult } from '@/services/api/weather.api'
import { useFormat } from '@/composables/useFormat'
import { loadDashboard, timezoneUnknown, type DashboardState } from '@/composables/useDashboard'
import { useLocationStore } from '@/stores/location.store'
import { useNotificationStore } from '@/stores/notification.store'
import { useUiStore } from '@/stores/ui.store'

const store = useLocationStore()
const notifications = useNotificationStore()
const ui = useUiStore()
const router = useRouter()
const f = useFormat()
const { locations } = storeToRefs(store)
const editing = ref<string | null>(null)
const draft = ref('')
const previews = reactive<Record<string, DashboardState>>({})

async function preview(l: WeatherLocation) {
  const state = await loadDashboard(l)
  previews[l.id] = state
  if (state.data && !timezoneUnknown(state.data)) store.updateTimezone(l.id, state.data.location.timezone)
}
onMounted(() => locations.value.forEach((l) => void preview(l)))

function added(l: WeatherLocation) {
  notifications.toast({ icon: '📍', title: 'Saved', message: `${l.name} added to your places.`, tone: 'mint' })
  ui.burst()
  void preview(l)
}

function addSearch(r: GeocodingResult) {
  added(store.add({ name: r.name, country: r.country, region: r.region, latitude: r.latitude, longitude: r.longitude, timezone: r.timezone }))
}

function addCoords(r: ReverseResult & { name: string }) {
  added(store.add({ name: r.name, country: r.country, region: r.region, latitude: r.latitude, longitude: r.longitude, timezone: r.timezone }))
}

function startEdit(l: WeatherLocation) {
  editing.value = l.id
  draft.value = l.name
}
function commitEdit(id: string) {
  const oldName = store.locations.find((l) => l.id === id)?.name
  if (!store.rename(id, draft.value)) {
    notifications.toast({ icon: '⚠️', title: 'Name required', message: 'Enter a name before saving.', tone: 'flame' })
    return
  }
  editing.value = null
  notifications.toast({ icon: '✏️', title: 'Renamed', message: `${oldName ?? 'Place'} is now ${draft.value.trim()}.`, tone: 'mint' })
}
function remove(l: WeatherLocation) {
  if (window.confirm(`Remove ${l.name}?`)) store.remove(l.id)
}
function open(l: WeatherLocation) {
  store.select(l.id)
  void router.push('/')
}

const sorted = computed(() => [...locations.value].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault)))
</script>

<template>
  <div class="grid grid-cols-1 gap-6">
    <header>
      <p class="b-label inline-block border-3 border-ink bg-ink px-2 py-1 text-sun">Manage</p>
      <h1 class="b-title mt-2 w-fit border-3 border-ink bg-paper px-4 pb-1 pt-3 text-6xl shadow-brutal sm:text-7xl">Your places</h1>
    </header>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section class="b-card bg-sun p-5" aria-label="Search by name">
        <h2 class="b-section-title mb-4">Find by name</h2>
        <LocationSearch @select="addSearch" />
      </section>
      <section class="b-card bg-sky p-5" aria-label="Add by coordinates">
        <h2 class="b-section-title mb-4">Drop a pin</h2>
        <CoordinateForm @save="addCoords" />
      </section>
    </div>

    <section aria-label="Saved places">
      <h2 class="b-section-title mb-4">Saved · {{ locations.length }}</h2>
      <p v-if="!locations.length" class="b-card bg-paper p-5">Nothing saved yet. Search above to add your first place.</p>
      <ul class="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="(l, i) in sorted" :key="l.id" class="b-card b-card-hover bg-paper" :style="{ '--i': i }">
          <div class="flex items-start justify-between gap-3 p-4">
            <div class="min-w-0 flex-1">
              <form v-if="editing === l.id" class="grid gap-2" @submit.prevent="commitEdit(l.id)">
                <label :for="`rename-${l.id}`" class="b-label">New place name</label>
                <input :id="`rename-${l.id}`" v-model="draft" class="b-input py-1.5" maxlength="60" autocomplete="off" autofocus />
                <div class="flex gap-2">
                  <button type="submit" class="b-btn b-btn-ink flex-1 py-1.5" :disabled="!draft.trim()">
                    <Check :size="16" :stroke-width="3" /> Save
                  </button>
                  <button type="button" class="b-btn flex-1 py-1.5" @click="editing = null">
                    <X :size="16" :stroke-width="3" /> Cancel
                  </button>
                </div>
              </form>
              <button v-else type="button" class="text-left" @click="open(l)">
                <p class="b-title truncate text-3xl hover:underline">{{ l.name }}</p>
              </button>
              <p class="truncate text-sm">{{ [l.region, l.country].filter(Boolean).join(', ') || 'Custom pin' }}</p>
              <p class="font-mono text-[10px] font-bold">{{ l.latitude.toFixed(3) }}, {{ l.longitude.toFixed(3) }} · {{ l.timezone }}</p>
            </div>
            <div v-if="previews[l.id]?.data" class="text-right">
              <div class="b-icon-box ml-auto h-12 w-12 bg-white">
                <WeatherIcon :condition="previews[l.id]!.data!.current.condition" :is-day="previews[l.id]!.data!.current.isDay" />
              </div>
              <p class="b-title mt-1 text-3xl">{{ f.temp(previews[l.id]!.data!.current.temperature) }}</p>
            </div>
          </div>
          <div class="flex border-t-3 border-ink">
            <button type="button" class="flex flex-1 items-center justify-center gap-1 border-r-3 border-ink py-2 font-mono text-[10px] font-bold uppercase hover:bg-sun" :class="l.isDefault ? 'bg-sun' : ''" @click="store.setDefault(l.id)">
              <Star :size="14" :stroke-width="3" :fill="l.isDefault ? '#0E0E0E' : 'none'" /> {{ l.isDefault ? 'Default' : 'Make default' }}
            </button>
            <button type="button" class="flex flex-1 items-center justify-center gap-1 border-r-3 border-ink py-2 font-mono text-[10px] font-bold uppercase hover:bg-sky" @click="startEdit(l)">
              <Pencil :size="14" :stroke-width="3" /> Rename
            </button>
            <button type="button" class="flex flex-1 items-center justify-center gap-1 py-2 font-mono text-[10px] font-bold uppercase hover:bg-flame" @click="remove(l)">
              <Trash2 :size="14" :stroke-width="3" /> Remove
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
