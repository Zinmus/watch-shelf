<script setup lang="ts">
import TvProgressControl from '@/components/TvProgressControl.vue'

import type { SeasonProgress } from '@/domain/tvProgress'

defineProps<{
  seasons: SeasonProgress[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  commit: [seasonNumber: number, watchedEpisodeCount: number]
}>()

function getSeasonLabel(season: SeasonProgress) {
  return season.name.trim() || `Season ${season.seasonNumber}`
}
</script>

<template>
  <section aria-labelledby="seasons-heading">
    <h2
      id="seasons-heading"
      class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
    >
      Seasons
    </h2>

    <ul class="divide-y divide-gray-200 dark:divide-gray-800">
      <li
        v-for="season in seasons"
        :key="season.id"
        class="py-1"
      >
        <TvProgressControl
          :model-value="season.watchedEpisodeCount"
          :total="season.episodeCount"
          :label="getSeasonLabel(season)"
          :active="season.state === 'current'"
          :disabled="disabled || season.episodeCount === 0"
          @commit="emit('commit', season.seasonNumber, $event)"
        />
      </li>
    </ul>
  </section>
</template>
