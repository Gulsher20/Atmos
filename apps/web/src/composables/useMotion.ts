import { computed } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { useSettingsStore } from '@/stores/settings.store'

export function useMotion() {
  const settings = useSettingsStore()
  const system = usePreferredReducedMotion()
  const reduced = computed(() => settings.motion === 'reduced' || (settings.motion === 'system' && system.value === 'reduce'))
  return { reduced }
}
