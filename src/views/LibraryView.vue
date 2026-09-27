<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import LibraryRow from '@/components/LibraryRow.vue'

import { getMovie, getTvShow } from '@/api/tmdb'
import {
  commitLegacyTvMigration,
  getLegacyTvLibraryEntries,
  getLibraryEntries,
  saveTvSeasonLibraryEntry,
} from '@/data/library'
import { createLegacyTvMigrationPlan } from '@/domain/legacyTvMigration'
import { normalizeReleaseStatus } from '@/domain/releaseStatus'
import { clampWatchedEpisodeCount } from '@/domain/tvProgress'

import type { ReleaseStatus } from '@/domain/releaseStatus'
import type {
  LegacyTvLibraryEntry,
  LibraryEntry,
  LibraryStatus,
  TvSeasonLibraryEntry,
} from '@/types/library'
import type { MediaType, TvShowDetails } from '@/types/media'

type MediaFilter = 'all' | MediaType
type SortOrder = 'updated' | 'title'

interface LibrarySection {
  status: LibraryStatus
  title: string
  entries: LibraryEntry[]
}

interface MediaRequest {
  key: string
  mediaType: MediaType
  tmdbId: number
}

type MediaEnrichment =
  | { mediaType: 'movie'; releaseStatus: ReleaseStatus | null }
  | { mediaType: 'tv'; releaseStatus: ReleaseStatus | null; show: TvShowDetails }

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
const MAX_DETAILS_REQUESTS = 3

const activeType = ref<MediaFilter>('all')
const sortOrder = ref<SortOrder>('title')
const entries = ref<LibraryEntry[]>([])
const legacyTvEntries = ref<LegacyTvLibraryEntry[]>([])
const seasonEpisodeCounts = ref(new Map<string, number>())
const releaseStatuses = ref(new Map<string, ReleaseStatus>())
const failedMediaKeys = ref(new Set<string>())
const resolvedMediaKeys = ref(new Set<string>())
const migrationMessages = ref(new Map<number, string>())
const loading = ref(true)
const error = ref<string | null>(null)

const detailsCache = new Map<string, Promise<MediaEnrichment>>()
const queuedMediaKeys = new Set<string>()
const detailsRequestQueue: MediaRequest[] = []
let activeDetailsRequests = 0
let mounted = true

const hasEntries = computed(
  () => entries.value.length > 0 || legacyTvEntries.value.length > 0,
)

const filteredEntries = computed(() =>
  entries.value.filter(
    (entry) => activeType.value === 'all' || entry.mediaType === activeType.value,
  ),
)

function compareEntryTitles(a: LibraryEntry, b: LibraryEntry) {
  const aTitle = a.mediaType === 'movie' ? a.title : a.showTitle
  const bTitle = b.mediaType === 'movie' ? b.title : b.showTitle
  const titleComparison = aTitle.localeCompare(bTitle, undefined, { sensitivity: 'base' })

  if (titleComparison !== 0) {
    return titleComparison
  }

  if (a.mediaType === 'tv' && b.mediaType === 'tv') {
    return a.seasonNumber - b.seasonNumber
  }

  return a.mediaType.localeCompare(b.mediaType)
}

const visibleSections = computed<LibrarySection[]>(() =>
  SECTION_ORDER.map((status) => ({
    status,
    title: SECTION_TITLES[status],
    entries: filteredEntries.value
      .filter((entry) => entry.status === status)
      .sort((a, b) =>
        sortOrder.value === 'title'
          ? compareEntryTitles(a, b)
          : b.updatedAt.localeCompare(a.updatedAt),
      ),
  })).filter((section) => section.entries.length > 0),
)

const visibleLegacyTvEntries = computed(() =>
  activeType.value === 'movie' ? [] : legacyTvEntries.value,
)

const mediaRequests = computed<MediaRequest[]>(() => {
  const requests = new Map<string, MediaRequest>()

  for (const entry of entries.value) {
    const tmdbId = entry.mediaType === 'movie' ? entry.tmdbId : entry.showTmdbId
    const key = `${entry.mediaType}:${tmdbId}`
    requests.set(key, { key, mediaType: entry.mediaType, tmdbId })
  }

  for (const entry of legacyTvEntries.value) {
    const key = `tv:${entry.showTmdbId}`
    requests.set(key, { key, mediaType: 'tv', tmdbId: entry.showTmdbId })
  }

  return [...requests.values()]
})

function getMediaKey(entry: LibraryEntry) {
  return entry.mediaType === 'movie'
    ? `movie:${entry.tmdbId}`
    : `tv:${entry.showTmdbId}`
}

function isProgressUnavailable(entry: TvSeasonLibraryEntry) {
  const mediaKey = getMediaKey(entry)

  return (
    failedMediaKeys.value.has(mediaKey) ||
    (resolvedMediaKeys.value.has(mediaKey) && !seasonEpisodeCounts.value.has(entry.key))
  )
}

function setReleaseStatus(key: string, status: ReleaseStatus) {
  const nextStatuses = new Map(releaseStatuses.value)
  nextStatuses.set(key, status)
  releaseStatuses.value = nextStatuses
}

function setSeasonEpisodeCounts(show: TvShowDetails) {
  const nextCounts = new Map(seasonEpisodeCounts.value)

  for (const season of show.seasons) {
    if (season.seasonNumber > 0) {
      nextCounts.set(
        `tv:${show.id}:season:${season.seasonNumber}`,
        Math.max(0, Math.trunc(season.episodeCount)),
      )
    }
  }

  seasonEpisodeCounts.value = nextCounts
}

async function reloadStoredLibrary() {
  const [activeEntries, pendingLegacyEntries] = await Promise.all([
    getLibraryEntries(),
    getLegacyTvLibraryEntries(),
  ])

  if (!mounted) return

  entries.value = activeEntries
  legacyTvEntries.value = pendingLegacyEntries
}

async function migrateLegacyEntry(show: TvShowDetails) {
  const legacyEntry = legacyTvEntries.value.find(
    (candidate) => candidate.showTmdbId === show.id,
  )

  if (!legacyEntry) return

  const migrationPlan = createLegacyTvMigrationPlan(legacyEntry, show.title, show.seasons)

  if (!migrationPlan.ok) {
    const nextMessages = new Map(migrationMessages.value)
    nextMessages.set(
      show.id,
      migrationPlan.reason === 'progress-exceeds-known-total'
        ? 'Saved progress exceeds the current episode total.'
        : 'No main seasons are currently available.',
    )
    migrationMessages.value = nextMessages
    return
  }

  const result = await commitLegacyTvMigration(legacyEntry, migrationPlan.entries)

  if (!mounted) return

  if (result === 'migrated' || result === 'already-migrated') {
    await reloadStoredLibrary()
    return
  }

  const nextMessages = new Map(migrationMessages.value)
  nextMessages.set(
    show.id,
    result === 'conflict'
      ? 'An existing season entry prevents automatic conversion.'
      : 'The saved record changed during conversion.',
  )
  migrationMessages.value = nextMessages
}

async function normalizeTvSeasonProgress(show: TvShowDetails) {
  const totals = new Map(
    show.seasons
      .filter((season) => season.seasonNumber > 0)
      .map((season) => [season.seasonNumber, Math.max(0, Math.trunc(season.episodeCount))]),
  )
  const showEntries = entries.value.filter(
    (entry): entry is TvSeasonLibraryEntry =>
      entry.mediaType === 'tv' && entry.showTmdbId === show.id,
  )
  const updatedEntries = new Map<string, TvSeasonLibraryEntry>()

  for (const entry of showEntries) {
    const total = totals.get(entry.seasonNumber)

    if (total === undefined) continue

    const normalizedCount = clampWatchedEpisodeCount(entry.watchedEpisodeCount, total)

    if (normalizedCount === entry.watchedEpisodeCount) continue

    const updatedEntry = await saveTvSeasonLibraryEntry(
      {
        showTmdbId: entry.showTmdbId,
        seasonNumber: entry.seasonNumber,
        showTitle: show.title,
        seasonName:
          show.seasons.find((season) => season.seasonNumber === entry.seasonNumber)?.name ||
          entry.seasonName,
      },
      entry.status,
      normalizedCount,
    )
    updatedEntries.set(updatedEntry.key, updatedEntry)
  }

  if (!mounted || updatedEntries.size === 0) return

  entries.value = entries.value.map((entry) => updatedEntries.get(entry.key) ?? entry)
}

function fetchMediaEnrichment(request: MediaRequest): Promise<MediaEnrichment> {
  if (request.mediaType === 'movie') {
    return getMovie(request.tmdbId).then((movie) => ({
      mediaType: 'movie',
      releaseStatus: normalizeReleaseStatus('movie', movie.status),
    }))
  }

  return getTvShow(request.tmdbId).then((show) => ({
    mediaType: 'tv',
    releaseStatus: normalizeReleaseStatus('tv', show.status),
    show,
  }))
}

function drainDetailsRequestQueue() {
  while (
    mounted &&
    activeDetailsRequests < MAX_DETAILS_REQUESTS &&
    detailsRequestQueue.length > 0
  ) {
    const mediaRequest = detailsRequestQueue.shift()

    if (!mediaRequest) return

    queuedMediaKeys.delete(mediaRequest.key)
    activeDetailsRequests += 1

    let detailsPromise = detailsCache.get(mediaRequest.key)

    if (!detailsPromise) {
      detailsPromise = fetchMediaEnrichment(mediaRequest)
      detailsCache.set(mediaRequest.key, detailsPromise)
    }

    void detailsPromise
      .then(async (enrichment) => {
        if (!mounted) return

        const nextResolvedKeys = new Set(resolvedMediaKeys.value)
        nextResolvedKeys.add(mediaRequest.key)
        resolvedMediaKeys.value = nextResolvedKeys

        if (enrichment.releaseStatus) {
          setReleaseStatus(mediaRequest.key, enrichment.releaseStatus)
        }

        if (enrichment.mediaType === 'tv') {
          setSeasonEpisodeCounts(enrichment.show)
          await migrateLegacyEntry(enrichment.show)
          await normalizeTvSeasonProgress(enrichment.show)
        }
      })
      .catch((cause: unknown) => {
        console.error(cause)
        const nextFailedKeys = new Set(failedMediaKeys.value)
        nextFailedKeys.add(mediaRequest.key)
        failedMediaKeys.value = nextFailedKeys

        if (mediaRequest.mediaType === 'tv') {
          const pendingEntry = legacyTvEntries.value.find(
            (entry) => entry.showTmdbId === mediaRequest.tmdbId,
          )

          if (pendingEntry) {
            const nextMessages = new Map(migrationMessages.value)
            nextMessages.set(
              mediaRequest.tmdbId,
              'Current season metadata could not be loaded. The original data was retained.',
            )
            migrationMessages.value = nextMessages
          }
        }
      })
      .finally(() => {
        activeDetailsRequests -= 1
        drainDetailsRequestQueue()
      })
  }
}

function queueMediaDetails() {
  mediaRequests.value.forEach((mediaRequest) => {
    if (detailsCache.has(mediaRequest.key) || queuedMediaKeys.has(mediaRequest.key)) {
      return
    }

    queuedMediaKeys.add(mediaRequest.key)
    detailsRequestQueue.push(mediaRequest)
  })

  drainDetailsRequestQueue()
}

async function loadLibrary() {
  loading.value = true
  error.value = null
  failedMediaKeys.value = new Set()
  resolvedMediaKeys.value = new Set()
  migrationMessages.value = new Map()

  try {
    await reloadStoredLibrary()
  } catch (cause) {
    console.error(cause)
    error.value = 'Failed to load your library.'
    loading.value = false
    return
  }

  loading.value = false
  queueMediaDetails()
}

function resetMediaFilter() {
  activeType.value = 'all'
}

watch(mediaRequests, queueMediaDetails)

onMounted(loadLibrary)

onBeforeUnmount(() => {
  mounted = false
  detailsRequestQueue.length = 0
  queuedMediaKeys.clear()
})
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-8 border-b border-gray-200 pb-6 dark:border-gray-800">
      <h1 class="text-3xl font-bold tracking-tight text-gray-950 dark:text-white">Library</h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Your saved movies, seasons, and viewing progress.</p>

      <div class="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div class="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800" aria-label="Filter library by media type">
          <button
            v-for="filter in MEDIA_FILTERS"
            :key="filter.value"
            type="button"
            :aria-pressed="activeType === filter.value"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="activeType === filter.value ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white'"
            @click="activeType = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Sort</span>
          <select v-model="sortOrder" class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
    </header>

    <p v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400">Loading library...</p>

    <div v-else-if="error" class="rounded-lg border border-red-100 bg-red-50 px-6 py-10 text-center dark:border-red-900/60 dark:bg-red-950/40">
      <p class="text-red-700 dark:text-red-300">{{ error }}</p>
      <button type="button" class="mt-4 rounded-lg bg-gray-950 px-4 py-2 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white" @click="loadLibrary">
        Try again
      </button>
    </div>

    <template v-else-if="visibleSections.length > 0 || visibleLegacyTvEntries.length > 0">
      <section v-if="visibleLegacyTvEntries.length > 0" class="mb-10">
        <div class="mb-3">
          <h2 class="text-xl font-semibold text-gray-950 dark:text-gray-100">Pending season migration</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">These saved series remain intact until current season metadata can be applied safely.</p>
        </div>

        <div class="divide-y divide-amber-200 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 dark:divide-amber-900 dark:border-amber-900 dark:bg-amber-950/30">
          <RouterLink
            v-for="entry in visibleLegacyTvEntries"
            :key="entry.showTmdbId"
            :to="`/title/tv/${entry.showTmdbId}`"
            class="grid gap-1 px-4 py-3 hover:bg-amber-100/60 dark:hover:bg-amber-900/30 sm:grid-cols-[minmax(0,1fr)_auto]"
          >
            <span class="font-medium text-gray-950 dark:text-gray-100">{{ entry.showTitle }}</span>
            <span class="text-sm tabular-nums text-gray-600 dark:text-gray-400">{{ entry.watchedEpisodeCount }} watched</span>
            <span class="text-sm text-amber-800 dark:text-amber-300 sm:col-span-2">
              {{ migrationMessages.get(entry.showTmdbId) ?? 'Waiting for current season metadata…' }}
            </span>
          </RouterLink>
        </div>
      </section>

      <div class="space-y-10">
        <section v-for="section in visibleSections" :key="section.status">
          <div class="mb-3 flex items-baseline gap-2">
            <h2 class="text-xl font-semibold text-gray-950 dark:text-gray-100">{{ section.title }}</h2>
            <span :aria-label="`${section.entries.length} library entities`" class="text-sm tabular-nums text-gray-500 dark:text-gray-400">{{ section.entries.length }}</span>
          </div>

          <div class="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            <LibraryRow
              v-for="entry in section.entries"
              :key="entry.key"
              :entry="entry"
              :release-status="releaseStatuses.get(getMediaKey(entry))"
              :total-episode-count="entry.mediaType === 'tv' ? seasonEpisodeCounts.get(entry.key) : undefined"
              :progress-unavailable="entry.mediaType === 'tv' && isProgressUnavailable(entry)"
            />
          </div>
        </section>
      </div>
    </template>

    <div v-else-if="!hasEntries" class="rounded-xl bg-gray-50 px-6 py-12 text-center dark:bg-gray-900">
      <h2 class="text-xl font-semibold">Your library is empty</h2>
      <p class="mt-2 text-gray-600 dark:text-gray-400">Find a movie or series and add it from its details page.</p>
      <RouterLink to="/" class="mt-5 inline-block rounded-lg bg-gray-950 px-4 py-2 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-white">
        Browse Discover
      </RouterLink>
    </div>

    <div v-else class="rounded-xl bg-gray-50 px-6 py-12 text-center dark:bg-gray-900">
      <h2 class="text-xl font-semibold">No matching library entities</h2>
      <p class="mt-2 text-gray-600 dark:text-gray-400">There are no movies or saved seasons for this filter.</p>
      <button type="button" class="mt-5 rounded-lg bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" @click="resetMediaFilter">
        Show all media
      </button>
    </div>
  </main>
</template>
