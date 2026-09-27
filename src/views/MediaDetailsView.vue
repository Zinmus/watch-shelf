<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import ReleaseStatusBadge from '@/components/ReleaseStatusBadge.vue'
import TvProgressControl from '@/components/TvProgressControl.vue'

import { getMovie, getTvShow } from '@/api/tmdb'
import {
  getLibraryEntry,
  removeLibraryEntry,
  saveLibraryEntry,
  updateTvLibraryState,
} from '@/data/library'
import { normalizeReleaseStatus } from '@/domain/releaseStatus'
import {
  applyTvProgressChange,
  applyTvStatusSelection,
  canSetTvShowCompleted,
  getTotalMainEpisodeCount,
  reconcileTvLibraryState,
} from '@/domain/tvProgress'

import type { LibraryEntry, LibraryStatus } from '@/types/library'
import type { MediaDetails, MediaType } from '@/types/media'

type StatusSelection = LibraryStatus | 'not-in-library'

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

const route = useRoute()

const media = ref<MediaDetails | null>(null)
const libraryEntry = ref<LibraryEntry | null>(null)
const selectedStatus = ref<StatusSelection>('not-in-library')
const loading = ref(false)
const libraryLoading = ref(false)
const savingLibrary = ref(false)
const error = ref<string | null>(null)
const libraryError = ref<string | null>(null)
const libraryNotice = ref<string | null>(null)

const MOVIE_STATUS_OPTIONS: { value: StatusSelection; label: string }[] = [
  { value: 'not-in-library', label: 'Not in library' },
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
]

const TV_STATUS_OPTIONS: { value: StatusSelection; label: string }[] = [
  { value: 'not-in-library', label: 'Not in library' },
  { value: 'planned', label: 'Planned' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
]

const statusOptions = computed(() =>
  media.value?.mediaType === 'movie' ? MOVIE_STATUS_OPTIONS : TV_STATUS_OPTIONS,
)

const totalMainEpisodeCount = computed(() =>
  media.value?.mediaType === 'tv' ? getTotalMainEpisodeCount(media.value.seasons) : 0,
)

const watchedEpisodeCount = computed(() => libraryEntry.value?.watchedEpisodeCount ?? 0)

const releaseStatus = computed(() =>
  media.value ? normalizeReleaseStatus(media.value.mediaType, media.value.status) : null,
)

const tvCanComplete = computed(
  () =>
    media.value?.mediaType === 'tv' &&
    canSetTvShowCompleted(totalMainEpisodeCount.value),
)

const showTvProgress = computed(
  () => media.value?.mediaType === 'tv' && libraryEntry.value?.mediaType === 'tv',
)

let loadVersion = 0

function isMediaType(value: string): value is MediaType {
  return value === 'movie' || value === 'tv'
}

function getYear(date: string) {
  return date ? date.slice(0, 4) : 'Unknown'
}

function getEntryStatus(): StatusSelection {
  return libraryEntry.value?.status ?? 'not-in-library'
}

function getLibraryEntryInput() {
  if (!media.value) {
    throw new Error('Media details are unavailable.')
  }

  return {
    tmdbId: media.value.id,
    mediaType: media.value.mediaType,
    title: media.value.title,
    posterPath: media.value.posterPath,
    date: media.value.date,
  }
}

async function reconcileTvState(version: number) {
  if (media.value?.mediaType !== 'tv' || libraryEntry.value?.mediaType !== 'tv') {
    return
  }

  const reconciledState = reconcileTvLibraryState(
    libraryEntry.value.status,
    watchedEpisodeCount.value,
    totalMainEpisodeCount.value,
  )

  if (
    reconciledState.watchedEpisodeCount === watchedEpisodeCount.value &&
    reconciledState.status === libraryEntry.value.status
  ) {
    return
  }

  try {
    savingLibrary.value = true
    const updatedEntry = await updateTvLibraryState(
      media.value.id,
      reconciledState.status,
      reconciledState.watchedEpisodeCount,
    )

    if (version !== loadVersion) {
      return
    }

    libraryEntry.value = updatedEntry
    selectedStatus.value = reconciledState.status
    libraryNotice.value = 'Progress and status were updated to match current series data.'
  } catch (cause) {
    if (version === loadVersion) {
      console.error(cause)
      libraryError.value = 'Failed to reconcile this title\'s library state.'
    }
  } finally {
    if (version === loadVersion) {
      savingLibrary.value = false
    }
  }
}

async function reconcileMovieState(version: number) {
  if (media.value?.mediaType !== 'movie' || libraryEntry.value?.status !== 'watching') {
    return
  }

  try {
    savingLibrary.value = true
    const updatedEntry = await saveLibraryEntry(getLibraryEntryInput(), 'planned')

    if (version !== loadVersion) {
      return
    }

    libraryEntry.value = updatedEntry
    selectedStatus.value = updatedEntry.status
    libraryNotice.value = 'Status was updated to Planned for this movie.'
  } catch (cause) {
    if (version === loadVersion) {
      console.error(cause)
      libraryError.value = 'Failed to normalize this movie\'s library state.'
    }
  } finally {
    if (version === loadVersion) {
      savingLibrary.value = false
    }
  }
}

async function loadMedia() {
  const version = ++loadVersion
  const type = String(route.params.type)
  const id = Number(route.params.id)

  media.value = null
  libraryEntry.value = null
  selectedStatus.value = 'not-in-library'
  error.value = null
  libraryError.value = null
  libraryNotice.value = null
  loading.value = false
  libraryLoading.value = false
  savingLibrary.value = false

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
    selectedStatus.value =
      type === 'movie' && libraryResult.value?.status === 'watching'
        ? 'planned'
        : (libraryResult.value?.status ?? 'not-in-library')
  } else {
    console.error(libraryResult.reason)
    libraryError.value = 'Failed to load this title\'s library state.'
  }

  loading.value = false
  libraryLoading.value = false

  if (detailsResult.status === 'fulfilled' && libraryResult.status === 'fulfilled') {
    if (type === 'movie') {
      await reconcileMovieState(version)
    } else {
      await reconcileTvState(version)
    }
  }
}

async function handleStatusChange() {
  if (!media.value) {
    return
  }

  const previousStatus = getEntryStatus()
  const nextStatus = selectedStatus.value

  if (nextStatus === previousStatus) {
    return
  }

  if (nextStatus === 'not-in-library') {
    if (!libraryEntry.value) {
      return
    }

    if (
      media.value.mediaType === 'tv' &&
      watchedEpisodeCount.value > 0 &&
      !window.confirm('Remove this title and delete its episode progress?')
    ) {
      selectedStatus.value = previousStatus
      return
    }
  }

  if (nextStatus === 'completed' && media.value.mediaType === 'tv' && !tvCanComplete.value) {
    libraryError.value = 'A series can only be completed when its episode total is known.'
    selectedStatus.value = previousStatus
    return
  }

  try {
    savingLibrary.value = true
    libraryError.value = null
    libraryNotice.value = null

    if (nextStatus === 'not-in-library') {
      await removeLibraryEntry(media.value.mediaType, media.value.id)
      libraryEntry.value = null
      return
    }

    if (media.value.mediaType === 'tv' && libraryEntry.value) {
      const nextState = applyTvStatusSelection(
        nextStatus,
        watchedEpisodeCount.value,
        totalMainEpisodeCount.value,
      )
      libraryEntry.value = await updateTvLibraryState(
        media.value.id,
        nextState.status,
        nextState.watchedEpisodeCount,
      )
    } else {
      const initialEpisodeCount = media.value.mediaType === 'tv'
        ? applyTvStatusSelection(nextStatus, 0, totalMainEpisodeCount.value)
            .watchedEpisodeCount
        : 0
      libraryEntry.value = await saveLibraryEntry(
        getLibraryEntryInput(),
        nextStatus,
        initialEpisodeCount,
      )
    }

    selectedStatus.value = libraryEntry.value.status
  } catch (cause) {
    console.error(cause)
    libraryError.value = 'Failed to update this title\'s library state.'
    selectedStatus.value = previousStatus
  } finally {
    savingLibrary.value = false
  }
}

async function updateProgress(requestedCount: number) {
  if (media.value?.mediaType !== 'tv' || libraryEntry.value?.mediaType !== 'tv') {
    return
  }

  const previousStatus = libraryEntry.value.status
  const nextState = applyTvProgressChange(
    previousStatus,
    watchedEpisodeCount.value,
    requestedCount,
    totalMainEpisodeCount.value,
  )

  if (
    nextState.watchedEpisodeCount === watchedEpisodeCount.value &&
    nextState.status === previousStatus
  ) {
    return
  }

  try {
    savingLibrary.value = true
    libraryError.value = null
    libraryNotice.value = null
    libraryEntry.value = await updateTvLibraryState(
      media.value.id,
      nextState.status,
      nextState.watchedEpisodeCount,
    )
    selectedStatus.value = nextState.status

    if (nextState.status !== previousStatus) {
      libraryNotice.value = `Status changed to ${nextState.status}.`
    }
  } catch (cause) {
    console.error(cause)
    libraryError.value = 'Failed to update episode progress.'
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

          <section class="mt-3 space-y-2">
            <p v-if="libraryLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading library status...</p>

            <template v-else>
              <label>
                <span class="sr-only">Status</span>
                <select
                  v-model="selectedStatus"
                  :disabled="savingLibrary"
                  class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
                  @change="handleStatusChange"
                >
                  <option
                    v-for="option in statusOptions"
                    :key="option.value"
                    :value="option.value"
                    :disabled="
                      media.mediaType === 'tv' &&
                      option.value === 'completed' &&
                      !tvCanComplete
                    "
                  >
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <div v-if="showTvProgress" class="pt-2">
                <TvProgressControl
                  :model-value="watchedEpisodeCount"
                  :total="totalMainEpisodeCount"
                  :disabled="savingLibrary"
                  @commit="updateProgress"
                />
              </div>

              <p v-if="libraryError" class="text-sm text-red-600 dark:text-red-400">
                {{ libraryError }}
              </p>

              <p v-if="libraryNotice" class="text-sm text-gray-600 dark:text-gray-400">
                {{ libraryNotice }}
              </p>
            </template>
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

          <section class="mt-6">
            <h2 class="text-xl font-semibold text-gray-950 dark:text-gray-100">Overview</h2>

            <p class="mt-3 max-w-3xl leading-7 text-gray-700 dark:text-gray-300">
              {{ media.overview || 'No overview available.' }}
            </p>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>
