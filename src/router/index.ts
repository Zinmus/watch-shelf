import { createRouter, createWebHistory } from 'vue-router'

import DiscoverView from '@/views/DiscoverView.vue'
import LibraryView from '@/views/LibraryView.vue'
import MediaDetailsView from '@/views/MediaDetailsView.vue'
import { DEFAULT_DOCUMENT_TITLE, setDocumentTitle } from '@/router/documentTitle'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'discover',
      component: DiscoverView,
      meta: { title: DEFAULT_DOCUMENT_TITLE },
    },
    {
      path: '/library',
      name: 'library',
      component: LibraryView,
      meta: { title: `Library / ${DEFAULT_DOCUMENT_TITLE}` },
    },
    {
      path: '/title/:type/:id',
      name: 'media-details',
      component: MediaDetailsView,
      meta: { title: DEFAULT_DOCUMENT_TITLE },
    },
  ],

  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 }
  },
})

router.afterEach((to) => {
  setDocumentTitle(to.meta.title)
})

export default router
