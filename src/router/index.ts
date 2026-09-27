import { createRouter, createWebHistory } from 'vue-router'

import DiscoverView from '@/views/DiscoverView.vue'
import LibraryView from '@/views/LibraryView.vue'
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
      path: '/library',
      name: 'library',
      component: LibraryView,
    },
    {
      path: '/title/:type/:id',
      name: 'media-details',
      component: MediaDetailsView,
    },
  ],

  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

export default router
