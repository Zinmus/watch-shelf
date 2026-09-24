import { createRouter, createWebHistory } from 'vue-router'

import DiscoverView from '@/views/DiscoverView.vue'
import MediaDetailsView from '@/views/MediaDetailsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'discover',
      component: DiscoverView,
    },
    {
      path: '/title/:type/:id',
      name: 'media-details',
      component: MediaDetailsView,
    },
  ],
})

export default router
