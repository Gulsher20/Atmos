import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

const apiTarget = 'http://127.0.0.1:4000'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'push-handler.js'],
      manifest: {
        name: 'ATMOS Weather Intelligence',
        short_name: 'ATMOS',
        description: 'Multi-source forecasts, air quality, history, comparisons, alerts and what to wear.',
        theme_color: '#FFD400',
        background_color: '#F4F0E4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/health/],
        importScripts: ['push-handler.js'],
        runtimeCaching: [
          {
            // Weather data is cached by the app itself with a timestamp; never serve it silently from the SW.
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      // A dev service worker serves stale bundles after code changes; opt in with VITE_PWA_DEV=true.
      devOptions: { enabled: process.env.VITE_PWA_DEV === 'true', navigateFallback: 'index.html' },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@weather/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@weather/weather-core': path.resolve(__dirname, '../../packages/weather-core/src/index.ts'),
      '@weather/recommendation-engine': path.resolve(__dirname, '../../packages/recommendation-engine/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/health': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { vue: ['vue', 'vue-router', 'pinia'] },
      },
    },
  },
})
