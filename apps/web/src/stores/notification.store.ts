import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { readJson, writeJson } from '@/services/storage.service'

export interface InAppNotification {
  id: string
  icon: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  location: string
  createdAt: string
  read: boolean
}

export interface Toast {
  id: number
  icon: string
  title: string
  message: string
  tone: 'sun' | 'flame' | 'ink' | 'mint'
}

const MAX_ITEMS = 60

export const useNotificationStore = defineStore('notification', () => {
  const items = ref<InAppNotification[]>(readJson('notifications', []))
  const toasts = ref<Toast[]>([])
  let toastSeq = 0

  watch(items, (v) => writeJson('notifications', v), { deep: true })

  const unread = computed(() => items.value.filter((n) => !n.read).length)

  function toast(input: Omit<Toast, 'id'>, ms = 4500) {
    const id = ++toastSeq
    toasts.value.push({ ...input, id })
    if (toasts.value.length > 3) toasts.value.shift()
    setTimeout(() => dismissToast(id), ms)
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  /** Add a notification once per id (de-duplicated). Returns true when it was new. */
  function push(n: Omit<InAppNotification, 'read' | 'createdAt'>, withToast = true): boolean {
    if (items.value.some((existing) => existing.id === n.id)) return false
    items.value.unshift({ ...n, read: false, createdAt: new Date().toISOString() })
    items.value = items.value.slice(0, MAX_ITEMS)
    if (withToast) toast({ icon: n.icon, title: n.title, message: n.message, tone: n.severity === 'info' ? 'sun' : 'flame' })
    return true
  }

  function markAllRead() {
    items.value.forEach((n) => (n.read = true))
  }

  function remove(id: string) {
    items.value = items.value.filter((n) => n.id !== id)
  }

  function clear() {
    items.value = []
  }

  return { items, toasts, unread, toast, dismissToast, push, markAllRead, remove, clear }
})
