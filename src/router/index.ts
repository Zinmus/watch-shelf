import { createRouter, createWebHistory } from 'vue-router'

import DiscoverView from '../views/DiscoverView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [{ path: '/', component: DiscoverView }],
})

export default router
