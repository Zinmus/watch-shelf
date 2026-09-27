<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import ReleaseStatusBadge from '@/components/ReleaseStatusBadge.vue'
import TvSeasonLibraryControl from '@/components/TvSeasonLibraryControl.vue'

import { getMovie, getTvShow } from '@/api/tmdb'
import {
  commitLegacyTvMigration,
  getLegacyTvLibraryEntry,
  getMovieLibraryEntry,
  getTvSeasonLibraryEntries,
  removeMovieLibraryEntry,
  removeTvSeasonLibraryEntry,
  saveMovieLibraryEntry,
  saveTvSeasonLibraryEntry,
} from '@/data/library'
import { createLegacyTvMigrationPlan, getMainSeasonSummaries } from '@/domain/legacyTvMigration'
import { normalizeReleaseStatus } from '@/domain/releaseStatus'
import { clampWatchedEpisodeCount } from '@/domain/tvProgress'

import type { SeasonStatusSelection } from '@/components/TvSeasonLibraryControl.vue'
import type {
  MovieLibraryEntry,
  MovieLibraryStatus,
  TvSeasonLibraryEntry,
} from '@/types/library'
import type { MediaDetails, MediaType, MovieDetails, TvShowDetails } from '@/types/media'
import type { TvSeasonSummary } from '@/types/tv'

type MovieStatusSelection = MovieLibraryStatus | 'not-in-library'

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

const route = useRoute()

const media = ref<MediaDetails | null>(null)
const movieLibraryEntry = ref<MovieLibraryEntry | null>(null)
const tvSeasonEntries = ref(new Map<number, TvSeasonLibraryEntry>())
const selectedMovieStatus = ref<MovieStatusSelection>('not-in-library')
const loading = ref(false)
const libraryLoading = ref(false)
const savingMovie = ref(false)
const savingSeasons = ref(new Set<number>())
const legacyMigrationPending = ref(false)
const error = ref<string | null>(null)
const libraryError = ref<string | null>(null)
const libraryNotice = ref<string | null>(null)

const MOVIE_STATUS_OPTIONS: { value: MovieStatusSelection; label: string }[] = [
  { value: 'not-in-library', label: 'Not in library' },
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
]

const mainSeasons = computed(() =>
  media.value?.mediaType === 'tv' ? getMainSeasonSummaries(media.value.seasons) : [],
)

const releaseStatus = computed(() =>
  media.value ? normalizeReleaseStatus(media.value.mediaType, media.value.status) : null,
)

let loadVersion = 0

function isMediaType(value: string): value is MediaType {
  return value === 'movie' || value === 'tv'
}

function getYear(date: string) {
  return date ? date.slice(0, 4) : 'Unknown'
}

function setTvSeasonEntries(entries: TvSeasonLibraryEntry[]) {
  tvSeasonEntries.value = new Map(entries.map((entry) => [entry.seasonNumber, entry]))
}

function replaceTvSeasonEntry(entry: TvSeasonLibraryEntry) {
  const nextEntries = new Map(tvSeasonEntries.value)
  nextEntries.set(entry.seasonNumber, entry)
  tvSeasonEntries.value = nextEntries
}

function deleteTvSeasonEntry(seasonNumber: number) {
  const nextEntries = new Map(tvSeasonEntries.value)
  nextEntries.delete(seasonNumber)
  tvSeasonEntries.value = nextEntries
}

function setSeasonSaving(seasonNumber: number, saving: boolean) {
  const nextSavingSeasons = new Set(savingSeasons.value)

  if (saving) {
    nextSavingSeasons.add(seasonNumber)
  } else {
    nextSavingSeasons.delete(seasonNumber)
  }

  savingSeasons.value = nextSavingSeasons
}

function getMovieEntryInput(movie: MovieDetails) {
  return {
    tmdbId: movie.id,
    title: movie.title,
    posterPath: movie.posterPath,
    date: movie.date,
  }
}

function getTvSeasonEntryInput(show: TvShowDetails, season: TvSeasonSummary) {
  return {
    showTmdbId: show.id,
    seasonNumber: season.seasonNumber,
    showTitle: show.title,
    seasonName: season.name || undefined,
  }
}

async function normalizeTvSeasonProgress(show: TvShowDetails, version: number) {
  let normalizedAnyEntry = false

  for (const season of getMainSeasonSummaries(show.seasons)) {
    const entry = tvSeasonEntries.value.get(season.seasonNumber)

    if (!entry) {
      continue
    }

    const normalizedCount = clampWatchedEpisodeCount(
      entry.watchedEpisodeCount,
      season.episodeCount,
    )

    if (normalizedCount === entry.watchedEpisodeCount) {
      continue
    }

    const updatedEntry = await saveTvSeasonLibraryEntry(
      getTvSeasonEntryInput(show, season),
      entry.status,
      normalizedCount,
    )

    if (version !== loadVersion) {
      return
    }

    replaceTvSeasonEntry(updatedEntry)
    normalizedAnyEntry = true
  }

  if (normalizedAnyEntry) {
    libraryNotice.value = 'Season progress was updated to match current series data.'
  }
}

async function migrateLegacyTvEntry(
  show: TvShowDetails,
  version: number,
) {
  const legacyEntry = await getLegacyTvLibraryEntry(show.id)

  if (version !== loadVersion || !legacyEntry) {
    return
  }

  legacyMigrationPending.value = true
  const migrationPlan = createLegacyTvMigrationPlan(legacyEntry, show.title, show.seasons)

  if (!migrationPlan.ok) {
    libraryError.value =
      migrationPlan.reason === 'progress-exceeds-known-total'
        ? 'Saved series progress exceeds the current episode total. The original data was retained.'
        : 'Saved series data could not be converted because no main seasons are available. The original data was retained.'
    return
  }

  const result = await commitLegacyTvMigration(legacyEntry, migrationPlan.entries)

  if (version !== loadVersion) {
    return
  }

  if (result === 'migrated' || result === 'already-migrated') {
    const migratedEntries = await getTvSeasonLibraryEntries(show.id)

    if (version !== loadVersion) {
      return
    }

    setTvSeasonEntries(migratedEntries)
    legacyMigrationPending.value = false
    libraryNotice.value = 'Existing series progress was converted to season progress.'
    return
  }

  libraryError.value =
    result === 'conflict'
      ? 'Saved series data conflicts with an existing season entry. The original data was retained.'
      : 'Saved series data changed during conversion. The original data was retained.'
}

async function reconcileMovieState(movie: MovieDetails, version: number) {
  const legacyStatus = (movieLibraryEntry.value as { status?: string } | null)?.status

  if (legacyStatus !== 'watching') {
    return
  }

  try {
    savingMovie.value = true
    const updatedEntry = await saveMovieLibraryEntry(getMovieEntryInput(movie), 'planned')

    if (version !== loadVersion) {
      return
    }

    movieLibraryEntry.value = updatedEntry
    selectedMovieStatus.value = updatedEntry.status
    libraryNotice.value = 'Status was updated to Planned for this movie.'
  } catch (cause) {
    if (version === loadVersion) {
      console.error(cause)
      libraryError.value = 'Failed to normalize this movie\'s library state.'
    }
  } finally {
    if (version === loadVersion) {
      savingMovie.value = false
    }
  }
}

async function loadMovie(id: number, version: number) {
  const [detailsResult, libraryResult] = await Promise.allSettled([
    getMovie(id),
    getMovieLibraryEntry(id),
  ])

  if (version !== loadVersion) return

  if (detailsResult.status === 'rejected') {
    console.error(detailsResult.reason)
    error.value = 'Failed to load media details.'
  } else {
    media.value = detailsResult.value
  }

  if (libraryResult.status === 'rejected') {
    console.error(libraryResult.reason)
    libraryError.value = 'Failed to load this title\'s library state.'
  } else {
    movieLibraryEntry.value = libraryResult.value ?? null
    selectedMovieStatus.value =
      (libraryResult.value as { status?: string } | undefined)?.status === 'watching'
        ? 'planned'
        : (libraryResult.value?.status ?? 'not-in-library')
  }

  if (detailsResult.status === 'fulfilled' && libraryResult.status === 'fulfilled') {
    await reconcileMovieState(detailsResult.value, version)
  }
}

async function loadTvShow(id: number, version: number) {
  const [detailsResult, libraryResult] = await Promise.allSettled([
    getTvShow(id),
    getTvSeasonLibraryEntries(id),
  ])

  if (version !== loadVersion) return

  if (detailsResult.status === 'rejected') {
    console.error(detailsResult.reason)
    error.value = 'Failed to load media details.'
  } else {
    media.value = detailsResult.value
  }

  if (libraryResult.status === 'rejected') {
    console.error(libraryResult.reason)
    libraryError.value = 'Failed to load this title\'s library state.'
  } else {
    setTvSeasonEntries(libraryResult.value)
  }

  if (detailsResult.status === 'fulfilled' && libraryResult.status === 'fulfilled') {
    try {
      await migrateLegacyTvEntry(detailsResult.value, version)

      if (version === loadVersion && !legacyMigrationPending.value) {
        await normalizeTvSeasonProgress(detailsResult.value, version)
      }
    } catch (cause) {
      if (version === loadVersion) {
        console.error(cause)
        legacyMigrationPending.value = true
        libraryError.value = 'Saved series data could not be converted. The original data was retained.'
      }
    }
  }
}

async function loadMedia() {
  const version = ++loadVersion
  const type = String(route.params.type)
  const id = Number(route.params.id)

  media.value = null
  movieLibraryEntry.value = null
  tvSeasonEntries.value = new Map()
  selectedMovieStatus.value = 'not-in-library'
  error.value = null
  libraryError.value = null
  libraryNotice.value = null
  legacyMigrationPending.value = false
  savingMovie.value = false
  savingSeasons.value = new Set()

  if (!isMediaType(type) || !Number.isFinite(id)) {
    error.value = 'Invalid media URL.'
    return
  }

  loading.value = true
  libraryLoading.value = true

  if (type === 'movie') {
    await loadMovie(id, version)
  } else {
    await loadTvShow(id, version)
  }

  if (version === loadVersion) {
    loading.value = false
    libraryLoading.value = false
  }
}

async function handleMovieStatusChange() {
  if (media.value?.mediaType !== 'movie') return

  const movie = media.value
  const previousStatus = movieLibraryEntry.value?.status ?? 'not-in-library'
  const nextStatus = selectedMovieStatus.value

  if (nextStatus === previousStatus) return

  try {
    savingMovie.value = true
    libraryError.value = null
    libraryNotice.value = null

    if (nextStatus === 'not-in-library') {
      await removeMovieLibraryEntry(movie.id)
      movieLibraryEntry.value = null
      return
    }

    movieLibraryEntry.value = await saveMovieLibraryEntry(
      getMovieEntryInput(movie),
      nextStatus,
    )
    selectedMovieStatus.value = movieLibraryEntry.value.status
  } catch (cause) {
    console.error(cause)
    libraryError.value = 'Failed to update this title\'s library state.'
    selectedMovieStatus.value = previousStatus
  } finally {
    savingMovie.value = false
  }
}

async function handleSeasonStatusChange(
  season: TvSeasonSummary,
  nextStatus: SeasonStatusSelection,
) {
  if (media.value?.mediaType !== 'tv' || legacyMigrationPending.value) return

  const show = media.value
  const existingEntry = tvSeasonEntries.value.get(season.seasonNumber)
  const previousStatus = existingEntry?.status ?? 'not-in-library'

  if (nextStatus === previousStatus) return

  if (
    nextStatus === 'not-in-library' &&
    existingEntry &&
    existingEntry.watchedEpisodeCount > 0 &&
    !window.confirm(`Remove ${season.name || `Season ${season.seasonNumber}`} and delete its progress?`)
  ) {
    return
  }

  try {
    setSeasonSaving(season.seasonNumber, true)
    libraryError.value = null
    libraryNotice.value = null

    if (nextStatus === 'not-in-library') {
      await removeTvSeasonLibraryEntry(show.id, season.seasonNumber)
      deleteTvSeasonEntry(season.seasonNumber)
      return
    }

    const updatedEntry = await saveTvSeasonLibraryEntry(
      getTvSeasonEntryInput(show, season),
      nextStatus,
      existingEntry?.watchedEpisodeCount ?? 0,
    )
    replaceTvSeasonEntry(updatedEntry)
  } catch (cause) {
    console.error(cause)
    libraryError.value = `Failed to update ${season.name || `Season ${season.seasonNumber}`}.`
  } finally {
    setSeasonSaving(season.seasonNumber, false)
  }
}

async function updateSeasonProgress(
  season: TvSeasonSummary,
  requestedCount: number,
) {
  if (media.value?.mediaType !== 'tv' || legacyMigrationPending.value) return

  const show = media.value
  const entry = tvSeasonEntries.value.get(season.seasonNumber)

  if (!entry) return

  const nextCount = clampWatchedEpisodeCount(requestedCount, season.episodeCount)

  if (nextCount === entry.watchedEpisodeCount) return

  try {
    setSeasonSaving(season.seasonNumber, true)
    libraryError.value = null
    libraryNotice.value = null
    const updatedEntry = await saveTvSeasonLibraryEntry(
      getTvSeasonEntryInput(show, season),
      entry.status,
      nextCount,
    )
    replaceTvSeasonEntry(updatedEntry)
  } catch (cause) {
    console.error(cause)
    libraryError.value = `Failed to update ${season.name || `Season ${season.seasonNumber}`} progress.`
  } finally {
    setSeasonSaving(season.seasonNumber, false)
  }
}

watch(() => [route.params.type, route.params.id], loadMedia, { immediate: true })
</script>

<template>
  <main>
    <p v-if="loading" class="py-12 text-center text-gray-500 dark:text-gray-400">Loading...</p>

    <p v-else-if="error" class="py-12 text-center text-red-600 dark:text-red-400">
      {{ error }}
    </p>

    <template v-else-if="media">
      <div
        class="mx-auto grid max-w-5xl items-start gap-6 px-4 py-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8"
      >
        <div class="w-full max-w-[220px]">
          <img
            v-if="media.posterPath"
            :src="`${IMAGE_BASE_URL}${media.posterPath}`"
            :alt="media.title"
            class="w-full rounded-lg object-cover"
          />

          <div v-else class="flex aspect-[2/3] items-center justify-center rounded-lg bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            No poster
          </div>

          <section v-if="media.mediaType === 'movie'" class="mt-3 space-y-2">
            <p v-if="libraryLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading library status...</p>

            <label v-else>
              <span class="sr-only">Status</span>
              <select
                v-model="selectedMovieStatus"
                :disabled="savingMovie"
                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
                @change="handleMovieStatusChange"
              >
                <option v-for="option in MOVIE_STATUS_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </section>
        </div>

        <div class="min-w-0">
          <RouterLink to="/" class="mb-4 inline-block text-sm text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white">
            ← Back to Discover
          </RouterLink>

          <h1 class="text-3xl font-bold text-gray-950 dark:text-white sm:text-4xl">
            {{ media.title }}
          </h1>

          <div class="mt-3 flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{{ getYear(media.date) }}</span>
            <span>{{ media.mediaType === 'movie' ? 'Movie' : 'Series' }}</span>
            <ReleaseStatusBadge v-if="releaseStatus" :status="releaseStatus" />
          </div>

          <div class="mt-4 flex flex-wrap gap-2">
            <span
              v-for="genre in media.genres"
              :key="genre.id"
              class="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-300"
            >
              {{ genre.name }}
            </span>
          </div>

          <p v-if="libraryError" class="mt-4 text-sm text-red-600 dark:text-red-400">
            {{ libraryError }}
          </p>

          <p v-if="libraryNotice" class="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {{ libraryNotice }}
          </p>

          <section class="mt-6">
            <h2 class="text-xl font-semibold text-gray-950 dark:text-gray-100">Overview</h2>

            <p class="mt-3 max-w-3xl leading-7 text-gray-700 dark:text-gray-300">
              {{ media.overview || 'No overview available.' }}
            </p>
          </section>

          <section v-if="media.mediaType === 'tv'" class="mt-7">
            <div class="mb-3 flex items-baseline justify-between gap-3">
              <h2 class="text-xl font-semibold text-gray-950 dark:text-gray-100">Seasons</h2>
              <span class="text-sm text-gray-500 dark:text-gray-400">Specials excluded</span>
            </div>

            <p v-if="libraryLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading season library status...</p>

            <div v-else-if="mainSeasons.length > 0" class="grid gap-2 lg:grid-cols-2">
              <TvSeasonLibraryControl
                v-for="season in mainSeasons"
                :key="season.seasonNumber"
                :season="season"
                :entry="tvSeasonEntries.get(season.seasonNumber)"
                :disabled="legacyMigrationPending || savingSeasons.has(season.seasonNumber)"
                @status-change="handleSeasonStatusChange"
                @progress-commit="updateSeasonProgress"
              />
            </div>

            <p v-else class="text-sm text-gray-500 dark:text-gray-400">No main seasons are available.</p>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>
