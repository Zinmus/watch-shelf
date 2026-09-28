<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import LibraryRow from '@/components/LibraryRow.vue'

import { getLibraryEntries } from '@/data/library'

import type { LibraryEntry, LibraryStatus } from '@/types/library'
import type { MediaType } from '@/types/media'

type MediaFilter = 'all' | MediaType
type SortOrder = 'updated' | 'title'

interface LibrarySection {
  status: LibraryStatus
  title: string
  entries: LibraryEntry[]
}

const MEDIA_FILTERS: { value: MediaFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'Series' },
]

const SECTION_TITLES: Record<LibraryStatus, string> = {
  watching: 'Watching',
  planned: 'Planned',
  completed: 'Completed',
}

const SECTION_ORDER: LibraryStatus[] = ['watching', 'planned', 'completed']
const activeType = ref<MediaFilter>('all')
const sortOrder = ref<SortOrder>('title')
const entries = ref<LibraryEntry[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const hasEntries = computed(() => entries.value.length > 0)

const filteredEntries = computed(() =>
  entries.value.filter(
    (entry) => activeType.value === 'all' || entry.mediaType === activeType.value,
  ),
)

const visibleSections = computed<LibrarySection[]>(() =>
  SECTION_ORDER.map((status) => ({
    status,
    title: SECTION_TITLES[status],
    entries: filteredEntries.value
      .filter((entry) => entry.status === status)
      .sort((a, b) => {
        if (sortOrder.value === 'title') {
          return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
        }

        return b.updatedAt.localeCompare(a.updatedAt)
      }),
  })).filter((section) => section.entries.length > 0),
)

async function loadLibrary() {
  loading.value = true
  error.value = null

  try {
    entries.value = await getLibraryEntries()
  } catch (cause) {
    console.error(cause)
    error.value = 'Failed to load your library.'
    loading.value = false
    return
  }

  loading.value = false
}

function resetMediaFilter() {
  activeType.value = 'all'
}

onMounted(loadLibrary)
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-8 border-b border-gray-200 pb-6 dark:border-gray-800">
      <h1 class="text-3xl font-bold tracking-tight text-gray-950 dark:text-white">Library</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Your saved movies, series, and viewing progress.</p>

      <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div
          class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
          aria-label="Filter library by media type"
        >
          <button
            v-for="filter in MEDIA_FILTERS"
            :key="filter.value"
            type="button"
            :aria-pressed="activeType === filter.value"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              activeType === filter.value
                ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white'
            "
            @click="activeType = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Sort</span>
          <select
            v-model="sortOrder"
            class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
    </header>

    <p v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400">Loading library...</p>

    <div
      v-else-if="error"
      class="rounded-lg border border-red-100 bg-red-50 px-6 py-10 text-center dark:border-red-900/60 dark:bg-red-950/40"
    >
      <p class="text-red-700 dark:text-red-300">{{ error }}</p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-gray-950 px-4 py-2 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white"
        @click="loadLibrary"
      >
        Try again
      </button>
    </div>

    <div v-else-if="visibleSections.length > 0" class="space-y-10">
      <section v-for="section in visibleSections" :key="section.status">
        <div class="mb-3 flex items-baseline gap-2">
          <h2 class="text-xl font-semibold text-gray-950 dark:text-gray-100">{{ section.title }}</h2>
          <span class="text-sm tabular-nums text-gray-500 dark:text-gray-400">{{ section.entries.length }}</span>
        </div>

        <div
          class="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900"
        >
          <LibraryRow
            v-for="entry in section.entries"
            :key="entry.key"
            :entry="entry"
          />
        </div>
      </section>
    </div>

    <div v-else-if="!hasEntries" class="rounded-xl bg-gray-50 px-6 py-12 text-center dark:bg-gray-900">
      <h2 class="text-xl font-semibold">Your library is empty</h2>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Find a movie or series and add it from its details page.</p>
      <RouterLink to="/" class="mt-5 inline-block rounded-lg bg-gray-950 px-4 py-2 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white">
        Browse Discover
      </RouterLink>
    </div>

    <div v-else class="rounded-xl bg-gray-50 px-6 py-12 text-center dark:bg-gray-900">
      <h2 class="text-xl font-semibold">No matching titles</h2>
      <p class="mt-2 text-gray-600 dark:text-gray-400">There are no titles for this media filter.</p>
      <button
        type="button"
        class="mt-5 rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        @click="resetMediaFilter"
      >
        Show all media
      </button>
    </div>
  </main>
</template>
