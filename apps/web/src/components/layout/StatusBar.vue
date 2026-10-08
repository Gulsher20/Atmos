<script setup lang="ts">
import { useOnline } from '@vueuse/core'
import { WifiOff } from 'lucide-vue-next'
import { usePwa } from '@/composables/usePwa'

const online = useOnline()
const { needRefresh, offlineReady, updateServiceWorker } = usePwa()
</script>

<template>
  <div class="relative z-20">
    <div v-if="!online" class="flex items-center justify-center gap-2 border-b-3 border-ink bg-flame px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider" role="status">
      <WifiOff :size="16" :stroke-width="3" /> You're offline — showing the last saved forecast
    </div>
    <div v-if="needRefresh" class="flex flex-wrap items-center justify-center gap-3 border-b-3 border-ink bg-sky px-4 py-2" role="status">
      <span class="font-mono text-xs font-bold uppercase tracking-wider">A new version of ATMOS is ready</span>
      <button type="button" class="b-btn b-btn-ink py-1" @click="updateServiceWorker(true)">Reload</button>
      <button type="button" class="b-btn py-1" @click="needRefresh = false">Later</button>
    </div>
    <div v-else-if="offlineReady" class="flex items-center justify-center gap-3 border-b-3 border-ink bg-mint px-4 py-2" role="status">
      <span class="font-mono text-xs font-bold uppercase tracking-wider">Ready to work offline</span>
      <button type="button" class="b-btn py-1" @click="offlineReady = false">OK</button>
    </div>
  </div>
</template>
