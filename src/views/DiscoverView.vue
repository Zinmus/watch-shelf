<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import MediaCard from '@/components/MediaCard.vue'
import { getMovies, getTvShows } from '@/api/tmdb'
import { type MediaItem, type MediaType } from '@/types/media'

const activeType = ref<MediaType>('movie')
const items = ref<MediaItem[]>([])

const currentPage = ref(1)
const hasMore = ref(true)

const loading = ref(false)
const error = ref<string | null>(null)

const loadMoreTrigger = ref<HTMLElement | null>(null)

const showScrollTop = ref(false)

let observer: IntersectionObserver | null = null

async function loadMedia() {
  if (loading.value || !hasMore.value) {
    return
  }

  try {
    loading.value = true
    error.value = null

    const data =
      activeType.value === 'movie'
        ? await getMovies(currentPage.value)
        : await getTvShows(currentPage.value)

    items.value.push(...data.results)

    hasMore.value = data.page < data.total_pages

    if (hasMore.value) {
      currentPage.value++
    }
  } catch (err) {
    console.error(err)
    error.value = 'Failed to load media.'
  } finally {
    loading.value = false
  }
}

async function selectType(type: MediaType) {
  if (activeType.value === type) {
    return
  }

  activeType.value = type
  items.value = []
  currentPage.value = 1
  hasMore.value = true
  error.value = null

  await loadMedia()
}

function setupObserver() {
  if (!loadMoreTrigger.value) {
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]

      if (entry?.isIntersecting) {
        loadMedia()
      }
    },
    {
      rootMargin: '300px',
    },
  )

  observer.observe(loadMoreTrigger.value)
}

function handleScroll() {
  showScrollTop.value = window.scrollY > 600
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll)

  await loadMedia()
  await nextTick()

  setupObserver()
})

onBeforeUnmount(() => {
  observer?.disconnect()

  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <main class="mx-auto max-w-7xl px-4 py-8">
    <h1 class="mb-6 text-3xl font-bold">Discover</h1>

    <div class="mb-6 flex gap-2">
      <button
        type="button"
        class="rounded-lg px-4 py-2"
        :class="activeType === 'movie' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
        @click="selectType('movie')"
      >
        Movies
      </button>

      <button
        type="button"
        class="rounded-lg px-4 py-2"
        :class="activeType === 'tv' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
        @click="selectType('tv')"
      >
        Series
      </button>
    </div>

    <p v-if="error && items.length === 0" class="text-red-600">
      {{ error }}
    </p>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <MediaCard v-for="item in items" :key="`${item.mediaType}-${item.id}`" :media="item" />
    </div>

    <div ref="loadMoreTrigger" class="h-1" />

    <p v-if="loading" class="py-6 text-center text-gray-500">Loading...</p>

    <p v-else-if="error" class="py-6 text-center text-red-600">
      {{ error }}
    </p>

    <p v-else-if="!hasMore && items.length > 0" class="py-6 text-center text-gray-500">
      No more results.
    </p>

    <button
      v-if="showScrollTop"
      type="button"
      aria-label="Scroll to top"
      class="fixed right-6 bottom-6 flex h-11 w-11 items-center justify-center rounded-full bg-black text-xl text-white shadow-lg transition hover:scale-105"
      @click="scrollToTop"
    >
      ↑
    </button>
  </main>
</template>
