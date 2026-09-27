<script setup lang="ts">
import TvProgressControl from '@/components/TvProgressControl.vue'

import type { LibraryStatus, TvSeasonLibraryEntry } from '@/types/library'
import type { TvSeasonSummary } from '@/types/tv'

export type SeasonStatusSelection = LibraryStatus | 'not-in-library'

const props = defineProps<{
  season: TvSeasonSummary
  entry?: TvSeasonLibraryEntry
  disabled?: boolean
}>()

const emit = defineEmits<{
  statusChange: [season: TvSeasonSummary, status: SeasonStatusSelection]
  progressCommit: [season: TvSeasonSummary, watchedEpisodeCount: number]
}>()

const STATUS_OPTIONS: { value: SeasonStatusSelection; label: string }[] = [
  { value: 'not-in-library', label: 'Not in library' },
  { value: 'planned', label: 'Planned' },
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
]

function handleStatusChange(event: Event) {
  const select = event.target as HTMLSelectElement
  const status = select.value as SeasonStatusSelection

  select.value = props.entry?.status ?? 'not-in-library'
  emit('statusChange', props.season, status)
}
</script>

<template>
  <article class="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-900">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-medium text-gray-950 dark:text-gray-100">
        {{ season.name || `Season ${season.seasonNumber}` }}
      </h3>

      <label>
        <span class="sr-only">
          {{ season.name || `Season ${season.seasonNumber}` }} library status
        </span>
        <select
          :value="entry?.status ?? 'not-in-library'"
          :disabled="disabled"
          class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-950 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
          @change="handleStatusChange"
        >
          <option v-for="option in STATUS_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="entry" class="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
      <TvProgressControl
        :model-value="entry.watchedEpisodeCount"
        :total="season.episodeCount"
        :disabled="disabled"
        :accessible-label="`${season.name || `Season ${season.seasonNumber}`} watched episode count`"
        @commit="emit('progressCommit', season, $event)"
      />
    </div>
  </article>
</template>
