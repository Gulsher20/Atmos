import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { title: 'Now' } },
    { path: '/locations', name: 'locations', component: () => import('@/pages/LocationsPage.vue'), meta: { title: 'Places' } },
    { path: '/locations/:id', name: 'location', component: () => import('@/pages/DashboardPage.vue'), meta: { title: 'Place' } },
    { path: '/compare', name: 'compare', component: () => import('@/pages/ComparePage.vue'), meta: { title: 'Compare' } },
    { path: '/history', name: 'history', component: () => import('@/pages/HistoryPage.vue'), meta: { title: 'History' } },
    { path: '/accuracy', name: 'accuracy', component: () => import('@/pages/AccuracyPage.vue'), meta: { title: 'Accuracy' } },
    { path: '/alerts', name: 'alerts', component: () => import('@/pages/AlertsPage.vue'), meta: { title: 'Alerts' } },
    { path: '/settings', name: 'settings', component: () => import('@/pages/SettingsPage.vue'), meta: { title: 'Settings' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue'), meta: { title: 'Lost' } },
  ],
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? 'Weather')} — ATMOS`
})
