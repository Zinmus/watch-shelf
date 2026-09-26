<script setup lang="ts">
import { computed } from 'vue'

import type { LibraryEntry } from '@/types/library'

const props = defineProps<{
  entry: LibraryEntry
  showMediaType: boolean
  watchedEpisodeCount?: number
  totalEpisodeCount?: number
  progressUnavailable?: boolean
}>()

const year = computed(() => {
  const value = props.entry.date.slice(0, 4)

  return /^\d{4}$/.test(value) ? value : null
})

const progressLabel = computed(() => {
  if (props.entry.mediaType !== 'tv' || props.entry.status !== 'watching') {
    return null
  }

  if (props.progressUnavailable) {
    return 'Progress unavailable'
  }

  if (props.watchedEpisodeCount === undefined) {
    return 'Loading progress…'
  }

  if (props.totalEpisodeCount !== undefined && props.totalEpisodeCount > 0) {
    return `${props.watchedEpisodeCount} / ${props.totalEpisodeCount}`
  }

  return `${props.watchedEpisodeCount} watched`
})
</script>

<template>
  <RouterLink
    :to="`/title/${entry.mediaType}/${entry.tmdbId}`"
    :aria-label="`View details for ${entry.title}`"
    class="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black sm:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto]"
  >
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate font-medium text-gray-950 group-hover:underline">
          {{ entry.title }}
        </h3>

        <span
          v-if="showMediaType"
          class="rounded bg-gray-100 px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-gray-500"
        >
          {{ entry.mediaType === 'movie' ? 'Movie' : 'Series' }}
        </span>
      </div>

      <p v-if="year" class="mt-0.5 text-sm text-gray-500">{{ year }}</p>
    </div>

    <p
      v-if="progressLabel"
      class="col-span-2 row-start-2 text-sm tabular-nums text-gray-600 sm:col-span-1 sm:row-start-auto sm:text-right"
    >
      {{ progressLabel }}
    </p>
    <span v-else class="hidden sm:block" aria-hidden="true" />

    <span class="text-sm text-gray-400 transition-colors group-hover:text-gray-800" aria-hidden="true">
      →
    </span>
  </RouterLink>
</template>
