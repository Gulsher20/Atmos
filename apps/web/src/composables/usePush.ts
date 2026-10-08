import { computed, ref } from 'vue'
import { pushApi } from '@/services/api/weather.api'
import { useLocationStore } from '@/stores/location.store'
import { useSettingsStore } from '@/stores/settings.store'

const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const permission = ref<NotificationPermission>(supported ? Notification.permission : 'denied')
const subscription = ref<PushSubscription | null>(null)
const busy = ref(false)
const checked = ref(false)

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const output = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service worker is not ready yet. Reload and try again.')), 8000))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export function usePush() {
  const locations = useLocationStore()
  const settings = useSettingsStore()
  const enabled = computed(() => !!subscription.value)

  async function refresh() {
    if (!supported || checked.value) return
    checked.value = true
    try {
      const reg = await registration()
      subscription.value = await reg.pushManager.getSubscription()
    } catch {
      subscription.value = null
    }
  }

  async function sync(sub: PushSubscription) {
    const json = sub.toJSON()
    const location = locations.active
    if (!location || !json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Select a location first.')
    await pushApi.subscribe({
      subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } },
      location: { name: location.name, latitude: location.latitude, longitude: location.longitude },
      preferences: settings.notificationPrefs,
    })
  }

  /** Must be called from a user gesture: this is where the permission prompt appears. */
  async function enable() {
    if (!supported) throw new Error('Push notifications are not supported in this browser.')
    busy.value = true
    try {
      permission.value = await Notification.requestPermission()
      if (permission.value !== 'granted') throw new Error('Notifications are blocked. Allow them in your browser settings.')
      const reg = await registration()
      const { publicKey } = await pushApi.key()
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }))
      await sync(sub)
      subscription.value = sub
    } finally {
      busy.value = false
    }
  }

  async function disable() {
    if (!subscription.value) return
    busy.value = true
    try {
      const endpoint = subscription.value.endpoint
      await subscription.value.unsubscribe()
      await pushApi.unsubscribe(endpoint).catch(() => undefined)
      subscription.value = null
    } finally {
      busy.value = false
    }
  }

  async function updatePreferences() {
    if (subscription.value) await sync(subscription.value)
  }

  async function sendTest() {
    if (!subscription.value) throw new Error('Enable push notifications first.')
    await pushApi.test(subscription.value.endpoint)
  }

  return { supported, permission, enabled, busy, refresh, enable, disable, updatePreferences, sendTest }
}
