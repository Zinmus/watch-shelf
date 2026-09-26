<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { getMovie, getTvShow } from '@/api/tmdb'
import { getLibraryEntry, removeLibraryEntry, saveLibraryEntry } from '@/data/library'

import { type LibraryEntry, type LibraryStatus } from '@/types/library'
import { type MediaDetails, type MediaType } from '@/types/media'

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'
const BACKDROP_BASE_URL = 'https://image.tmdb.org/t/p/w1280'

const route = useRoute()

const media = ref<MediaDetails | null>(null)
const libraryEntry = ref<LibraryEntry | null>(null)
const selectedStatus = ref<LibraryStatus | ''>('')
const loading = ref(false)
const libraryLoading = ref(false)
const savingLibrary = ref(false)
const error = ref<string | null>(null)
const libraryError = ref<string | null>(null)

const STATUS_OPTIONS: { value: LibraryStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
]

let loadVersion = 0

function isMediaType(value: string): value is MediaType {
  return value === 'movie' || value === 'tv'
}

function getYear(date: string) {
  return date ? date.slice(0, 4) : 'Unknown'
}

async function loadMedia() {
  const version = ++loadVersion
  const type = String(route.params.type)
  const id = Number(route.params.id)

  media.value = null
  libraryEntry.value = null
  selectedStatus.value = ''
  error.value = null
  libraryError.value = null
  loading.value = false
  libraryLoading.value = false

  if (!isMediaType(type) || !Number.isFinite(id)) {
    error.value = 'Invalid media URL.'
    return
  }

  loading.value = true
  libraryLoading.value = true

  const detailsPromise = type === 'movie' ? getMovie(id) : getTvShow(id)
  const libraryPromise = getLibraryEntry(type, id)
  const [detailsResult, libraryResult] = await Promise.allSettled([
    detailsPromise,
    libraryPromise,
  ])

  if (version !== loadVersion) {
    return
  }

  if (detailsResult.status === 'fulfilled') {
    media.value = detailsResult.value
  } else {
    console.error(detailsResult.reason)
    error.value = 'Failed to load media details.'
  }

  if (libraryResult.status === 'fulfilled') {
    libraryEntry.value = libraryResult.value ?? null
    selectedStatus.value = libraryResult.value?.status ?? ''
  } else {
    console.error(libraryResult.reason)
    libraryError.value = 'Failed to load this title\'s library state.'
  }

  loading.value = false
  libraryLoading.value = false
}

async function persistSelectedStatus() {
  if (!media.value || !selectedStatus.value) {
    return
  }

  try {
    savingLibrary.value = true
    libraryError.value = null

    libraryEntry.value = await saveLibraryEntry(
      {
        tmdbId: media.value.id,
        mediaType: media.value.mediaType,
        title: media.value.title,
        posterPath: media.value.posterPath,
        date: media.value.date,
      },
      selectedStatus.value,
    )
  } catch (err) {
    console.error(err)
    libraryError.value = 'Failed to save this title to your library.'
  } finally {
    savingLibrary.value = false
  }
}

async function removeFromLibrary() {
  if (!media.value || !libraryEntry.value) {
    return
  }

  try {
    savingLibrary.value = true
    libraryError.value = null

    await removeLibraryEntry(media.value.mediaType, media.value.id)

    libraryEntry.value = null
    selectedStatus.value = ''
  } catch (err) {
    console.error(err)
    libraryError.value = 'Failed to remove this title from your library.'
  } finally {
    savingLibrary.value = false
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

          <section class="mt-8 max-w-xl rounded-xl bg-gray-50 p-5">
            <h2 class="text-xl font-semibold">Your library</h2>

            <p v-if="libraryLoading" class="mt-3 text-sm text-gray-500">
              Loading library status...
            </p>

            <template v-else>
              <p v-if="libraryEntry" class="mt-2 text-sm text-gray-600">
                Saved as
                <span class="font-medium capitalize text-gray-900">{{ libraryEntry.status }}</span>
              </p>

              <p v-else class="mt-2 text-sm text-gray-600">
                Choose a status to add this title to your library.
              </p>

              <div class="mt-4 flex flex-wrap items-end gap-3">
                <label class="flex min-w-48 flex-col gap-1">
                  <span class="text-sm font-medium text-gray-700">Status</span>
                  <select
                    v-model="selectedStatus"
                    :disabled="savingLibrary"
                    class="rounded-lg border border-gray-300 bg-white px-3 py-2 disabled:cursor-not-allowed"
                  >
                    <option disabled value="">Choose a status</option>
                    <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <button
                  type="button"
                  :disabled="
                    savingLibrary ||
                    !selectedStatus ||
                    (libraryEntry !== null && selectedStatus === libraryEntry.status)
                  "
                  class="rounded-lg bg-black px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
                  @click="persistSelectedStatus"
                >
                  {{ savingLibrary ? 'Saving...' : libraryEntry ? 'Update status' : 'Add to library' }}
                </button>

                <button
                  v-if="libraryEntry"
                  type="button"
                  :disabled="savingLibrary"
                  class="rounded-lg bg-red-50 px-4 py-2 text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  @click="removeFromLibrary"
                >
                  Remove
                </button>
              </div>

              <p v-if="libraryError" class="mt-3 text-sm text-red-600">
                {{ libraryError }}
              </p>
            </template>
          </section>

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
