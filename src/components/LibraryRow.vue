<script setup lang="ts">
import { computed } from 'vue'

import ReleaseStatusBadge from '@/components/ReleaseStatusBadge.vue'

import type { LibraryEntry } from '@/types/library'
import type { ReleaseStatus } from '@/domain/releaseStatus'

const props = defineProps<{
  entry: LibraryEntry
  releaseStatus?: ReleaseStatus
  totalEpisodeCount?: number
  progressUnavailable?: boolean
}>()

const progressLabel = computed(() => {
  if (props.entry.mediaType !== 'tv') {
    return null
  }

  if (props.progressUnavailable) {
    return `${props.entry.watchedEpisodeCount} watched`
  }

  if (props.totalEpisodeCount !== undefined && props.totalEpisodeCount > 0) {
    return `${Math.min(props.entry.watchedEpisodeCount, props.totalEpisodeCount)} / ${props.totalEpisodeCount}`
  }

  if (props.totalEpisodeCount === 0) {
    return '0 / 0'
  }

  return 'Loading progress…'
})

const detailsTmdbId = computed(() =>
  props.entry.mediaType === 'movie' ? props.entry.tmdbId : props.entry.showTmdbId,
)

const displayTitle = computed(() =>
  props.entry.mediaType === 'movie'
    ? props.entry.title
    : `${props.entry.showTitle} — ${props.entry.seasonName || `Season ${props.entry.seasonNumber}`}`,
)
</script>

<template>
  <RouterLink
    :to="`/title/${entry.mediaType}/${detailsTmdbId}`"
    :aria-label="`View details for ${displayTitle}`"
    class="group grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black dark:hover:bg-gray-800/70 dark:focus-visible:outline-gray-300 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto]"
  >
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate font-medium leading-5 text-gray-950 group-hover:underline dark:text-gray-100">
          {{ displayTitle }}
        </h3>

        <ReleaseStatusBadge v-if="releaseStatus" :status="releaseStatus" />
      </div>
    </div>

    <p
      v-if="progressLabel"
      class="col-span-2 row-start-2 text-sm leading-5 tabular-nums text-gray-600 dark:text-gray-400 sm:col-span-1 sm:row-start-auto sm:text-right"
    >
      {{ progressLabel }}
    </p>
    <span v-else class="hidden sm:block" aria-hidden="true" />

    <span class="text-sm text-gray-400 transition-colors group-hover:text-gray-800 dark:text-gray-500 dark:group-hover:text-gray-200" aria-hidden="true">
      →
    </span>
  </RouterLink>
</template>
