<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import LibraryRow from '@/components/LibraryRow.vue'

import { getTvShow } from '@/api/tmdb'
import { getLibraryEntries } from '@/data/library'
import { getAllWatchedEpisodes } from '@/data/watchedEpisodes'

import type { WatchedEpisode } from '@/types/episodes'
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
const MAX_TV_REQUESTS = 3

const activeType = ref<MediaFilter>('all')
const sortOrder = ref<SortOrder>('updated')
const entries = ref<LibraryEntry[]>([])
const watchedCounts = ref(new Map<number, number>())
const totalEpisodeCounts = ref(new Map<number, number>())
const watchedEpisodesLoaded = ref(false)
const watchedEpisodesFailed = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)

const tvDetailsCache = new Map<number, Promise<number>>()
const queuedTvIds = new Set<number>()
const tvRequestQueue: number[] = []
let activeTvRequests = 0
let mounted = true

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

const watchingTvIds = computed(() =>
  visibleSections.value
    .find((section) => section.status === 'watching')
    ?.entries.filter((entry) => entry.mediaType === 'tv')
    .map((entry) => entry.tmdbId) ?? [],
)

function groupWatchedEpisodes(watchedEpisodes: WatchedEpisode[]) {
  const counts = new Map<number, number>()

  watchedEpisodes.forEach((episode) => {
    if (episode.seasonNumber <= 0) {
      return
    }

    counts.set(episode.showTmdbId, (counts.get(episode.showTmdbId) ?? 0) + 1)
  })

  watchedCounts.value = counts
}

function setTotalEpisodeCount(tmdbId: number, count: number) {
  const nextCounts = new Map(totalEpisodeCounts.value)
  nextCounts.set(tmdbId, count)
  totalEpisodeCounts.value = nextCounts
}

function getWatchedEpisodeCount(entry: LibraryEntry) {
  if (
    entry.mediaType !== 'tv' ||
    entry.status !== 'watching' ||
    !watchedEpisodesLoaded.value ||
    watchedEpisodesFailed.value
  ) {
    return undefined
  }

  return watchedCounts.value.get(entry.tmdbId) ?? 0
}

function drainTvRequestQueue() {
  while (mounted && activeTvRequests < MAX_TV_REQUESTS && tvRequestQueue.length > 0) {
    const tmdbId = tvRequestQueue.shift()

    if (tmdbId === undefined) {
      return
    }

    queuedTvIds.delete(tmdbId)
    activeTvRequests += 1

    let request = tvDetailsCache.get(tmdbId)

    if (!request) {
      request = getTvShow(tmdbId).then((show) =>
        show.seasons
          .filter((season) => season.seasonNumber > 0)
          .reduce((total, season) => total + season.episodeCount, 0),
      )
      tvDetailsCache.set(tmdbId, request)
    }

    void request
      .then((totalEpisodeCount) => {
        if (mounted) {
          setTotalEpisodeCount(tmdbId, totalEpisodeCount)
        }
      })
      .catch((cause: unknown) => {
        console.error(cause)
      })
      .finally(() => {
        activeTvRequests -= 1
        drainTvRequestQueue()
      })
  }
}

function queueWatchingTvDetails() {
  if (!watchedEpisodesLoaded.value || watchedEpisodesFailed.value) {
    return
  }

  watchingTvIds.value.forEach((tmdbId) => {
    if (
      totalEpisodeCounts.value.has(tmdbId) ||
      tvDetailsCache.has(tmdbId) ||
      queuedTvIds.has(tmdbId)
    ) {
      return
    }

    queuedTvIds.add(tmdbId)
    tvRequestQueue.push(tmdbId)
  })

  drainTvRequestQueue()
}

async function loadLibrary() {
  loading.value = true
  error.value = null
  watchedEpisodesLoaded.value = false
  watchedEpisodesFailed.value = false
  watchedCounts.value = new Map()

  const watchedEpisodesPromise = getAllWatchedEpisodes()
    .then((watchedEpisodes) => ({ watchedEpisodes, cause: null }))
    .catch((cause: unknown) => ({ watchedEpisodes: null, cause }))

  try {
    entries.value = await getLibraryEntries()
  } catch (cause) {
    console.error(cause)
    error.value = 'Failed to load your library.'
    loading.value = false
    return
  }

  loading.value = false

  const watchedResult = await watchedEpisodesPromise

  if (!mounted) {
    return
  }

  if (watchedResult.watchedEpisodes) {
    groupWatchedEpisodes(watchedResult.watchedEpisodes)
  } else {
    console.error(watchedResult.cause)
    watchedEpisodesFailed.value = true
  }

  watchedEpisodesLoaded.value = true
  queueWatchingTvDetails()
}

function resetMediaFilter() {
  activeType.value = 'all'
}

watch(watchingTvIds, queueWatchingTvDetails)

onMounted(loadLibrary)

onBeforeUnmount(() => {
  mounted = false
  tvRequestQueue.length = 0
  queuedTvIds.clear()
})
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-8 border-b border-gray-200 pb-6">
      <h1 class="text-3xl font-bold tracking-tight text-gray-950">Library</h1>
      <p class="mt-2 text-gray-600">Your saved movies, series, and viewing progress.</p>

      <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div class="flex gap-1 rounded-lg bg-gray-100 p-1" aria-label="Filter library by media type">
          <button
            v-for="filter in MEDIA_FILTERS"
            :key="filter.value"
            type="button"
            :aria-pressed="activeType === filter.value"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="
              activeType === filter.value
                ? 'bg-white text-gray-950 shadow-sm'
                : 'text-gray-600 hover:text-gray-950'
            "
            @click="activeType = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-600">
          <span>Sort</span>
          <select
            v-model="sortOrder"
            class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-gray-900"
          >
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
    </header>

    <p v-if="loading" class="py-12 text-center text-gray-500">Loading library...</p>

    <div v-else-if="error" class="rounded-lg border border-red-100 bg-red-50 px-6 py-10 text-center">
      <p class="text-red-700">{{ error }}</p>
      <button type="button" class="mt-4 rounded-lg bg-black px-4 py-2 text-white" @click="loadLibrary">
        Try again
      </button>
    </div>

    <div v-else-if="visibleSections.length > 0" class="space-y-10">
      <section v-for="section in visibleSections" :key="section.status">
        <div class="mb-3 flex items-baseline gap-2">
          <h2 class="text-xl font-semibold text-gray-950">{{ section.title }}</h2>
          <span class="text-sm tabular-nums text-gray-500">{{ section.entries.length }}</span>
        </div>

        <div class="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <LibraryRow
            v-for="entry in section.entries"
            :key="entry.key"
            :entry="entry"
            :show-media-type="activeType === 'all'"
            :watched-episode-count="getWatchedEpisodeCount(entry)"
            :total-episode-count="
              entry.mediaType === 'tv' && entry.status === 'watching'
                ? totalEpisodeCounts.get(entry.tmdbId)
                : undefined
            "
            :progress-unavailable="
              entry.mediaType === 'tv' && entry.status === 'watching' && watchedEpisodesFailed
            "
          />
        </div>
      </section>
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
      <p class="mt-2 text-gray-600">There are no titles for this media filter.</p>
      <button
        type="button"
        class="mt-5 rounded-lg bg-gray-200 px-4 py-2 text-gray-800"
        @click="resetMediaFilter"
      >
        Show all media
      </button>
    </div>
  </main>
</template>
