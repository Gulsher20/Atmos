import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import './styles/main.css'

if (import.meta.env.DEV && !import.meta.env.VITE_PWA_DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
    if (!registrations.length) return
    await Promise.all(registrations.map((r) => r.unregister()))
    if ('caches' in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
    location.reload()
  })
}

createApp(App).use(createPinia()).use(router).mount('#app')
