<script setup lang="ts">
import { onMounted, ref } from 'vue'

import MediaCard from '@/components/MediaCard.vue'
import { getMovies, getTvShows, type MediaItem, type MediaType } from '@/api/tmdb'

const activeType = ref<MediaType>('movie')
const items = ref<MediaItem[]>([])

const loading = ref(true)
const error = ref<string | null>(null)

async function loadMedia() {
  try {
    loading.value = true
    error.value = null

    items.value = activeType.value === 'movie' ? await getMovies(1) : await getTvShows(1)
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

  await loadMedia()
}

onMounted(() => {
  loadMedia()
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

    <p v-if="loading">Loading...</p>

    <p v-else-if="error" class="text-red-600">
      {{ error }}
    </p>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <MediaCard v-for="item in items" :key="`${item.mediaType}-${item.id}`" :media="item" />
    </div>
  </main>
</template>
