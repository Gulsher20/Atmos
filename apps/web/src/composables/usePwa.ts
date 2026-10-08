import { ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const installEvent = ref<BeforeInstallPromptEvent | null>(null)
const installed = ref(typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installEvent.value = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    installEvent.value = null
  })
}

/** Registers the service worker. Call once (App shell). */
export function usePwa() {
  return useRegisterSW({ immediate: true })
}

export function useInstall() {
  async function install() {
    if (!installEvent.value) return
    await installEvent.value.prompt()
    await installEvent.value.userChoice
    installEvent.value = null
  }
  return { canInstall: installEvent, installed, install }
}
