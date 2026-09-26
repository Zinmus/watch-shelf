<script setup lang="ts">
import { getEpisodeIdentity, getLocalDateString } from '@/domain/tvProgress'

import type { TvEpisode, TvSeasonDetails } from '@/types/tv'

defineProps<{
  season: TvSeasonDetails
  watchedIdentities: Set<string>
  savingIdentities: Set<string>
  trackingDisabled: boolean
}>()

const emit = defineEmits<{
  toggle: [episode: TvEpisode, watched: boolean]
}>()

const today = getLocalDateString()

function isFutureEpisode(episode: TvEpisode) {
  return Boolean(episode.airDate && episode.airDate > today)
}

function formatAirDate(airDate: string | null) {
  return airDate || 'Air date unknown'
}
</script>

<template>
  <details class="rounded-lg border border-gray-200 bg-white" :open="season.seasonNumber === 1">
    <summary class="cursor-pointer px-4 py-3 font-medium">
      {{ season.name }}
      <span v-if="season.seasonNumber === 0" class="ml-2 text-sm font-normal text-gray-500">
        Excluded from main progress
      </span>
    </summary>

    <ul class="divide-y divide-gray-100 border-t border-gray-200">
      <li
        v-for="episode in season.episodes"
        :key="episode.id"
        class="flex items-start gap-3 px-4 py-3"
      >
        <input
          :id="`episode-${episode.id}`"
          type="checkbox"
          class="mt-1 size-4 rounded border-gray-300"
          :checked="watchedIdentities.has(getEpisodeIdentity(episode.seasonNumber, episode.episodeNumber))"
          :disabled="
            trackingDisabled ||
            isFutureEpisode(episode) ||
            savingIdentities.has(getEpisodeIdentity(episode.seasonNumber, episode.episodeNumber))
          "
          @change="
            emit(
              'toggle',
              episode,
              ($event.target as HTMLInputElement).checked,
            )
          "
        />

        <label :for="`episode-${episode.id}`" class="min-w-0 flex-1">
          <span class="font-medium">
            {{ episode.episodeNumber }}. {{ episode.name || 'Untitled episode' }}
          </span>
          <span class="mt-1 block text-sm text-gray-500">
            {{ formatAirDate(episode.airDate) }}
            <template v-if="isFutureEpisode(episode)"> · Upcoming</template>
          </span>
        </label>
      </li>
    </ul>
  </details>
</template>
