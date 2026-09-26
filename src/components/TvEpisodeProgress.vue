<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import TvSeasonEpisodes from '@/components/TvSeasonEpisodes.vue'

import { getTvSeason } from '@/api/tmdb'
import { getWatchedEpisodes, setEpisodeWatched } from '@/data/watchedEpisodes'
import {
  deriveTvProgress,
  getEpisodeIdentity,
  isFinishedTvShow,
} from '@/domain/tvProgress'

import type { WatchedEpisode } from '@/types/episodes'
import type { LibraryEntry } from '@/types/library'
import type { TvShowDetails } from '@/types/media'
import type { TvEpisode, TvSeasonDetails } from '@/types/tv'

const props = defineProps<{
  show: TvShowDetails
  libraryEntry: LibraryEntry | null
}>()

const emit = defineEmits<{
  libraryEntryUpdated: [entry: LibraryEntry]
  completionState: [state: { ready: boolean; canComplete: boolean }]
}>()

const seasons = ref<TvSeasonDetails[]>([])
const watchedEpisodes = ref<WatchedEpisode[]>([])
const failedSeasonNumbers = ref<number[]>([])
const savingIdentities = ref(new Set<string>())
const loading = ref(false)
const watchedStateLoaded = ref(false)
const error = ref<string | null>(null)

let loadVersion = 0

const requiredMainSeasonNumbers = computed(() =>
  props.show.seasons
    .filter((season) => season.seasonNumber > 0 && season.episodeCount > 0)
    .map((season) => season.seasonNumber),
)

const loadedSeasonNumbers = computed(() => new Set(seasons.value.map((season) => season.seasonNumber)))

const mainSeasonDetailsComplete = computed(
  () =>
    watchedStateLoaded.value &&
    failedSeasonNumbers.value.every((seasonNumber) => seasonNumber === 0) &&
    requiredMainSeasonNumbers.value.every((seasonNumber) =>
      loadedSeasonNumbers.value.has(seasonNumber),
    ),
)

const hasMainSeasonFailure = computed(() =>
  failedSeasonNumbers.value.some((seasonNumber) => seasonNumber > 0),
)

const progress = computed(() =>
  deriveTvProgress(
    props.show,
    seasons.value,
    watchedEpisodes.value,
    mainSeasonDetailsComplete.value,
  ),
)

const watchedIdentities = computed(
  () =>
    new Set(
      watchedEpisodes.value.map((episode) =>
        getEpisodeIdentity(episode.seasonNumber, episode.episodeNumber),
      ),
    ),
)

const mainSeasons = computed(() =>
  seasons.value
    .filter((season) => season.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber - b.seasonNumber),
)

const specialSeasons = computed(() =>
  seasons.value.filter((season) => season.seasonNumber === 0),
)

const isCaughtUp = computed(
  () =>
    mainSeasonDetailsComplete.value &&
    !isFinishedTvShow(props.show.status) &&
    progress.value.releasedMainEpisodeCount > 0 &&
    progress.value.watchedReleasedEpisodeCount === progress.value.releasedMainEpisodeCount,
)

async function loadProgress() {
  const version = ++loadVersion
  const seasonSummaries = props.show.seasons.filter((season) => season.episodeCount > 0)
  const loadedSeasons: TvSeasonDetails[] = []
  const failedSeasons: number[] = []

  seasons.value = []
  watchedEpisodes.value = []
  failedSeasonNumbers.value = []
  watchedStateLoaded.value = false
  loading.value = true
  error.value = null

  const watchedPromise = getWatchedEpisodes(props.show.id)
    .then((watched) => ({ watched, cause: null }))
    .catch((cause: unknown) => ({ watched: null, cause }))

  for (let index = 0; index < seasonSummaries.length; index += 4) {
    const batch = seasonSummaries.slice(index, index + 4)
    const results = await Promise.allSettled(
      batch.map((season) => getTvSeason(props.show.id, season.seasonNumber)),
    )

    results.forEach((result, resultIndex) => {
      if (result.status === 'fulfilled') {
        loadedSeasons.push(result.value)
      } else {
        console.error(result.reason)
        failedSeasons.push(batch[resultIndex]!.seasonNumber)
      }
    })

    if (version !== loadVersion) {
      return
    }
  }

  try {
    const watchedResult = await watchedPromise

    if (version !== loadVersion) {
      return
    }

    if (watchedResult.watched) {
      watchedEpisodes.value = watchedResult.watched
      watchedStateLoaded.value = true
    } else {
      console.error(watchedResult.cause)
      error.value = 'Failed to load your watched episodes.'
    }
  } catch (err) {
    console.error(err)
    error.value = 'Failed to finish loading episode progress.'
  }

  if (version !== loadVersion) {
    return
  }

  seasons.value = loadedSeasons
  failedSeasonNumbers.value = failedSeasons
  loading.value = false

  if (failedSeasons.length > 0 && !error.value) {
    error.value = hasMainSeasonFailure.value
      ? 'Some main seasons could not be loaded. Completion is unavailable until you retry.'
      : 'Specials could not be loaded. Main episode completion is still available.'
  }
}

async function toggleEpisode(episode: TvEpisode, watched: boolean) {
  const identity = getEpisodeIdentity(episode.seasonNumber, episode.episodeNumber)
  const nextSavingIdentities = new Set(savingIdentities.value)
  nextSavingIdentities.add(identity)
  savingIdentities.value = nextSavingIdentities
  error.value = null

  try {
    const watchedEpisode: WatchedEpisode = {
      showTmdbId: props.show.id,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
    }
    const updatedLibraryEntry = await setEpisodeWatched(
      watchedEpisode,
      watched,
      !watched && props.libraryEntry?.status === 'completed',
    )

    if (watched) {
      watchedEpisodes.value = [...watchedEpisodes.value, watchedEpisode]
    } else {
      watchedEpisodes.value = watchedEpisodes.value.filter(
        (entry) =>
          getEpisodeIdentity(entry.seasonNumber, entry.episodeNumber) !== identity,
      )
    }

    if (updatedLibraryEntry) {
      emit('libraryEntryUpdated', updatedLibraryEntry)
    }
  } catch (err) {
    console.error(err)
    error.value = 'Failed to update this episode.'
  } finally {
    const remainingSavingIdentities = new Set(savingIdentities.value)
    remainingSavingIdentities.delete(identity)
    savingIdentities.value = remainingSavingIdentities
  }
}

watch(
  () => props.show.id,
  () => void loadProgress(),
  { immediate: true },
)

watch(
  () => props.libraryEntry,
  (entry, previousEntry) => {
    if (!entry && previousEntry) {
      watchedEpisodes.value = []
    }
  },
)

watch(
  [mainSeasonDetailsComplete, () => progress.value.canComplete],
  ([ready, canComplete]) => emit('completionState', { ready, canComplete }),
  { immediate: true },
)
</script>

<template>
  <section class="mt-8 max-w-3xl rounded-xl bg-gray-50 p-5">
    <h2 class="text-xl font-semibold">Episode progress</h2>

    <p v-if="loading" class="mt-3 text-sm text-gray-500">Loading seasons and episodes...</p>

    <template v-else>
      <template v-if="mainSeasonDetailsComplete">
        <p class="mt-2 text-gray-700">
          <span class="font-semibold">{{ progress.watchedReleasedEpisodeCount }}</span>
          / {{ progress.releasedMainEpisodeCount }} released episodes watched
        </p>
        <p class="mt-1 text-sm text-gray-500">
          {{ progress.totalMainEpisodeCount }} total main episodes
        </p>
        <p v-if="isCaughtUp && !progress.canComplete" class="mt-2 text-sm text-gray-600">
          Caught up — more episodes may be released.
        </p>
      </template>

      <p v-else class="mt-2 text-sm text-gray-600">
        Complete episode progress is unavailable until all main seasons load.
      </p>

      <p v-if="!libraryEntry" class="mt-3 text-sm text-gray-600">
        Add this series to your library to track watched episodes.
      </p>

      <p v-if="error" class="mt-3 text-sm text-red-600">{{ error }}</p>
      <button
        v-if="failedSeasonNumbers.length > 0 || !watchedStateLoaded"
        type="button"
        class="mt-3 rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-800"
        @click="loadProgress"
      >
        Retry episode data
      </button>

      <div v-if="mainSeasons.length > 0" class="mt-5 space-y-3">
        <TvSeasonEpisodes
          v-for="season in mainSeasons"
          :key="season.id"
          :season="season"
          :watched-identities="watchedIdentities"
          :saving-identities="savingIdentities"
          :tracking-disabled="!libraryEntry"
          @toggle="toggleEpisode"
        />
      </div>

      <div v-if="specialSeasons.length > 0" class="mt-6">
        <h3 class="mb-2 font-semibold">Specials</h3>
        <p class="mb-3 text-sm text-gray-500">
          Specials can be tracked individually but do not count toward main progress or completion.
        </p>
        <TvSeasonEpisodes
          v-for="season in specialSeasons"
          :key="season.id"
          :season="season"
          :watched-identities="watchedIdentities"
          :saving-identities="savingIdentities"
          :tracking-disabled="!libraryEntry"
          @toggle="toggleEpisode"
        />
      </div>
    </template>
  </section>
</template>
