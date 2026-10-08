<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { Search } from 'lucide-vue-next'
import type { GeocodingResult } from '@weather/shared-types'
import { locationsApi } from '@/services/api/weather.api'

const emit = defineEmits<{ select: [result: GeocodingResult] }>()

const query = ref('')
const results = ref<GeocodingResult[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const highlighted = ref(0)
let seq = 0

const run = useDebounceFn(async (q: string) => {
  const id = ++seq
  loading.value = true
  error.value = null
  try {
    const found = await locationsApi.search(q)
    if (id === seq) {
      results.value = found
      highlighted.value = 0
    }
  } catch (e) {
    if (id === seq) error.value = e instanceof Error ? e.message : 'Search failed'
  } finally {
    if (id === seq) loading.value = false
  }
}, 400)

watch(query, (q) => {
  if (q.trim().length < 2) {
    seq += 1
    results.value = []
    loading.value = false
    return
  }
  void run(q.trim())
})

function choose(result: GeocodingResult | undefined) {
  if (!result) return
  emit('select', result)
  query.value = ''
  results.value = []
}

function onKey(e: KeyboardEvent) {
  if (!results.value.length) return
  if (e.key === 'ArrowDown') highlighted.value = (highlighted.value + 1) % results.value.length
  else if (e.key === 'ArrowUp') highlighted.value = (highlighted.value - 1 + results.value.length) % results.value.length
  else if (e.key === 'Enter') choose(results.value[highlighted.value])
  else return
  e.preventDefault()
}
</script>

<template>
  <div class="relative">
    <label for="location-search" class="b-label mb-1.5 block">Search any city, town or place</label>
    <div class="relative">
      <Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" :size="18" :stroke-width="3" />
      <input
        id="location-search"
        v-model="query"
        type="search"
        autocomplete="off"
        class="b-input pl-10"
        placeholder="e.g. Reykjavík, Karachi, Lima…"
        role="combobox"
        aria-controls="location-results"
        :aria-expanded="results.length > 0"
        @keydown="onKey"
      />
    </div>
    <p v-if="loading" class="mt-2 font-mono text-xs font-bold uppercase">Searching the planet…</p>
    <p v-else-if="error" class="mt-2 font-mono text-xs font-bold uppercase text-flame">{{ error }}</p>
    <p v-else-if="query.trim().length >= 2 && !results.length" class="mt-2 font-mono text-xs font-bold uppercase">No places found — try coordinates instead.</p>

    <ul v-if="results.length" id="location-results" role="listbox" class="absolute inset-x-0 z-30 mt-2 max-h-80 overflow-y-auto border-3 border-ink bg-white shadow-brutal">
      <li v-for="(r, i) in results" :key="r.id" role="option" :aria-selected="i === highlighted">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 border-b-2 border-ink px-3 py-2.5 text-left last:border-b-0"
          :class="i === highlighted ? 'bg-sun' : 'hover:bg-sun'"
          @mouseenter="highlighted = i"
          @click="choose(r)"
        >
          <span>
            <span class="b-title block text-xl">{{ r.name }}</span>
            <span class="text-sm">{{ [r.region, r.country].filter(Boolean).join(', ') }}</span>
          </span>
          <span class="shrink-0 font-mono text-[10px] font-bold">{{ r.latitude.toFixed(2) }}, {{ r.longitude.toFixed(2) }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
