<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getMovie, getTvShow } from '@/api/tmdb'
import { type MediaDetails, type MediaType } from '@/types/media'

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280'

const route = useRoute()

const media = ref<MediaDetails | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

function isMediaType(value: string): value is MediaType {
  return value === 'movie' || value === 'tv'
}

function getYear(date: string) {
  return date ? date.slice(0, 4) : 'Unknown'
}

async function loadMedia() {
  const type = String(route.params.type)
  const id = Number(route.params.id)

  if (!isMediaType(type) || !Number.isFinite(id)) {
    error.value = 'Invalid media URL.'
    return
  }

  try {
    loading.value = true
    error.value = null
    media.value = null

    media.value = type === 'movie' ? await getMovie(id) : await getTvShow(id)
  } catch (err) {
    console.error(err)
    error.value = 'Failed to load media details.'
  } finally {
    loading.value = false
  }
}

watch(() => [route.params.type, route.params.id], loadMedia, {
  immediate: true,
})
</script>

<template>
  <main>
    <p v-if="loading" class="py-12 text-center text-gray-500">Loading...</p>

    <p v-else-if="error" class="py-12 text-center text-red-600">
      {{ error }}
    </p>

    <template v-else-if="media">
      <div v-if="media.backdropPath" class="relative h-72 overflow-hidden">
        <img
          :src="`${BACKDROP_BASE_URL}${media.backdropPath}`"
          :alt="media.title"
          class="h-full w-full object-cover"
        />

        <div class="absolute inset-0 bg-gradient-to-t from-white via-white/20 to-transparent" />
      </div>

      <div class="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[240px_1fr]">
        <div>
          <img
            v-if="media.posterPath"
            :src="`${IMAGE_BASE_URL}${media.posterPath}`"
            :alt="media.title"
            class="w-full rounded-lg object-cover"
          />

          <div v-else class="flex aspect-[2/3] items-center justify-center rounded-lg bg-gray-200">
            No poster
          </div>
        </div>

        <div>
          <RouterLink to="/" class="mb-4 inline-block text-sm text-gray-500 hover:text-black">
            ← Back to Discover
          </RouterLink>

          <h1 class="text-4xl font-bold">
            {{ media.title }}
          </h1>

          <div class="mt-3 flex flex-wrap gap-3 text-sm text-gray-500">
            <span>
              {{ getYear(media.date) }}
            </span>

            <span>
              {{ media.mediaType === 'movie' ? 'Movie' : 'Series' }}
            </span>

            <span>
              {{ media.status }}
            </span>
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="genre in media.genres"
              :key="genre.id"
              class="rounded-full bg-gray-100 px-3 py-1 text-sm"
            >
              {{ genre.name }}
            </span>
          </div>

          <section class="mt-8">
            <h2 class="text-xl font-semibold">Overview</h2>

            <p class="mt-3 max-w-3xl leading-7 text-gray-700">
              {{ media.overview || 'No overview available.' }}
            </p>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>
