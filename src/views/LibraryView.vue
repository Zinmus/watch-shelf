<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import MediaCard from '@/components/MediaCard.vue'

import { getLibraryEntries } from '@/data/library'

import type { LibraryEntry, LibraryStatus } from '@/types/library'
import type { MediaType } from '@/types/media'

type StatusFilter = 'all' | LibraryStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'planned', label: 'Planned' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
]

const activeType = ref<MediaType>('movie')
const activeStatus = ref<StatusFilter>('all')
const entries = ref<LibraryEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const hasEntries = computed(() => entries.value.length > 0)

const visibleEntries = computed(() =>
  entries.value
    .filter(
      (entry) =>
        entry.mediaType === activeType.value &&
        (activeStatus.value === 'all' || entry.status === activeStatus.value),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
)

function toMediaCardItem(entry: LibraryEntry) {
  return {
    id: entry.tmdbId,
    mediaType: entry.mediaType,
    title: entry.title,
    posterPath: entry.posterPath,
    date: entry.date,
  }
}

async function loadLibrary() {
  try {
    loading.value = true
    error.value = null
    entries.value = await getLibraryEntries()
  } catch (err) {
    console.error(err)
    error.value = 'Failed to load your library.'
  } finally {
    loading.value = false
  }
}

onMounted(loadLibrary)
</script>

<template>
  <main class="mx-auto max-w-7xl px-4 py-8">
    <h1 class="mb-6 text-3xl font-bold">Library</h1>

    <div class="mb-4 flex gap-2">
      <button
        type="button"
        class="rounded-lg px-4 py-2"
        :class="activeType === 'movie' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
        @click="activeType = 'movie'"
      >
        Movies
      </button>

      <button
        type="button"
        class="rounded-lg px-4 py-2"
        :class="activeType === 'tv' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
        @click="activeType = 'tv'"
      >
        Series
      </button>
    </div>

    <div class="mb-8 flex flex-wrap gap-2" aria-label="Filter library by status">
      <button
        v-for="filter in STATUS_FILTERS"
        :key="filter.value"
        type="button"
        class="rounded-full px-3 py-1.5 text-sm"
        :class="
          activeStatus === filter.value
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        "
        @click="activeStatus = filter.value"
      >
        {{ filter.label }}
      </button>
    </div>

    <p v-if="loading" class="py-12 text-center text-gray-500">Loading library...</p>

    <div v-else-if="error" class="py-12 text-center">
      <p class="text-red-600">{{ error }}</p>
      <button type="button" class="mt-4 rounded-lg bg-black px-4 py-2 text-white" @click="loadLibrary">
        Try again
      </button>
    </div>

    <div
      v-else-if="visibleEntries.length > 0"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      <div v-for="entry in visibleEntries" :key="entry.key">
        <MediaCard :media="toMediaCardItem(entry)" />
        <p class="mt-2 text-sm capitalize text-gray-500">{{ entry.status }}</p>
      </div>
    </div>

    <div v-else-if="!hasEntries" class="rounded-xl bg-gray-50 px-6 py-12 text-center">
      <h2 class="text-xl font-semibold">Your library is empty</h2>
      <p class="mt-2 text-gray-600">Find a movie or series and add it from its details page.</p>
      <RouterLink to="/" class="mt-5 inline-block rounded-lg bg-black px-4 py-2 text-white">
        Browse Discover
      </RouterLink>
    </div>

    <div v-else class="rounded-xl bg-gray-50 px-6 py-12 text-center">
      <h2 class="text-xl font-semibold">No matching titles</h2>
      <p class="mt-2 text-gray-600">Try another media type or status filter.</p>
      <button
        type="button"
        class="mt-5 rounded-lg bg-gray-200 px-4 py-2 text-gray-800"
        @click="activeStatus = 'all'"
      >
        Show all statuses
      </button>
    </div>
  </main>
</template>
