<script setup lang="ts">
import { computed } from 'vue'

import type { LibraryEntry } from '@/types/library'

const props = defineProps<{
  entry: LibraryEntry
}>()

const progressLabel = computed(() => {
  if (props.entry.mediaType !== 'tv') {
    return null
  }

  if (props.entry.totalEpisodeCount === null) {
    return `${props.entry.watchedEpisodeCount} watched`
  }

  return `${props.entry.watchedEpisodeCount} / ${props.entry.totalEpisodeCount}`
})

</script>

<template>
  <RouterLink
    :to="`/title/${entry.mediaType}/${entry.tmdbId}`"
    :aria-label="`View details for ${entry.title}`"
    class="group grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black dark:hover:bg-gray-800/70 dark:focus-visible:outline-gray-300 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_auto]"
  >
    <div class="min-w-0">
      <h3 class="truncate font-medium leading-5 text-gray-950 group-hover:underline dark:text-gray-100">
        {{ entry.title }}
      </h3>
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
