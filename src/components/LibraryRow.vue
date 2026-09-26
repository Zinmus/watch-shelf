<script setup lang="ts">
import { computed } from 'vue'

import { getReleaseStatusLabel } from '@/domain/releaseStatus'

import type { LibraryEntry } from '@/types/library'
import type { ReleaseStatus } from '@/domain/releaseStatus'

const props = defineProps<{
  entry: LibraryEntry
  releaseStatus?: ReleaseStatus
  totalEpisodeCount?: number
  progressUnavailable?: boolean
}>()

const progressLabel = computed(() => {
  if (props.entry.mediaType !== 'tv' || props.entry.status !== 'watching') {
    return null
  }

  if (props.progressUnavailable) {
    return 'Progress unavailable'
  }

  if (props.totalEpisodeCount !== undefined && props.totalEpisodeCount > 0) {
    return `${Math.min(props.entry.watchedEpisodeCount ?? 0, props.totalEpisodeCount)} / ${props.totalEpisodeCount}`
  }

  if (props.totalEpisodeCount === 0) {
    return '0 / 0'
  }

  return 'Loading progress…'
})

const releaseStatusClass = computed(() => {
  switch (props.releaseStatus) {
    case 'on-air':
      return 'bg-green-50 text-green-700 ring-green-600/20'
    case 'announced':
    case 'upcoming':
      return 'bg-orange-50 text-orange-700 ring-orange-600/20'
    case 'canceled':
      return 'bg-red-50 text-red-700 ring-red-600/20'
    default:
      return 'bg-gray-50 text-gray-600 ring-gray-500/20'
  }
})
</script>

<template>
  <RouterLink
    :to="`/title/${entry.mediaType}/${entry.tmdbId}`"
    :aria-label="`View details for ${entry.title}`"
    class="group grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black sm:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto]"
  >
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h3 class="truncate font-medium leading-5 text-gray-950 group-hover:underline">
          {{ entry.title }}
        </h3>

        <span
          v-if="releaseStatus"
          class="rounded px-1.5 py-0.5 text-[0.6875rem] font-medium leading-4 ring-1 ring-inset"
          :class="releaseStatusClass"
        >
          {{ getReleaseStatusLabel(releaseStatus) }}
        </span>
      </div>
    </div>

    <p
      v-if="progressLabel"
      class="col-span-2 row-start-2 text-sm leading-5 tabular-nums text-gray-600 sm:col-span-1 sm:row-start-auto sm:text-right"
    >
      {{ progressLabel }}
    </p>
    <span v-else class="hidden sm:block" aria-hidden="true" />

    <span class="text-sm text-gray-400 transition-colors group-hover:text-gray-800" aria-hidden="true">
      →
    </span>
  </RouterLink>
</template>
