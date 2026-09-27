<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

import { clampWatchedEpisodeCount } from '@/domain/tvProgress'

import type { SeasonProgress } from '@/domain/tvProgress'

const props = defineProps<{
  seasons: SeasonProgress[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  commit: [seasonNumber: number, watchedEpisodeCount: number]
}>()

const editingSeasonNumber = ref<number | null>(null)
const editValue = ref('')
const seasonList = ref<HTMLElement | null>(null)

const editingSeason = computed(() =>
  props.seasons.find(
    (season) => season.seasonNumber === editingSeasonNumber.value,
  ),
)

function getSeasonLabel(season: SeasonProgress) {
  return season.name.trim() || `Season ${season.seasonNumber}`
}

async function startEditing(season: SeasonProgress) {
  if (props.disabled || season.episodeCount === 0) {
    return
  }

  editingSeasonNumber.value = season.seasonNumber
  editValue.value = String(season.watchedEpisodeCount)
  await nextTick()
  seasonList.value?.querySelector<HTMLInputElement>('input')?.select()
}

function closeEditor() {
  editingSeasonNumber.value = null
}

function commitEdit() {
  const season = editingSeason.value

  if (!season) {
    return
  }

  const rawValue = String(editValue.value)
  const value = Number(rawValue)

  if (rawValue.trim() !== '' && Number.isInteger(value)) {
    const nextValue = clampWatchedEpisodeCount(value, season.episodeCount)

    if (nextValue !== season.watchedEpisodeCount) {
      emit('commit', season.seasonNumber, nextValue)
    }
  }

  closeEditor()
}

function cancelEdit() {
  closeEditor()
}
</script>

<template>
  <section ref="seasonList" aria-labelledby="seasons-heading">
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
        class="flex min-h-8 items-center justify-between gap-3 py-1 text-sm"
      >
        <span
          class="min-w-0 truncate"
          :class="
            season.state === 'unwatched'
              ? 'text-gray-500 dark:text-gray-400'
              : 'text-gray-800 dark:text-gray-200'
          "
        >
          {{ getSeasonLabel(season) }}
        </span>

        <div class="flex shrink-0 items-center gap-1.5 tabular-nums">
          <span
            v-if="season.state === 'completed'"
            aria-label="Completed"
            class="text-emerald-600 dark:text-emerald-400"
          >
            &#10003;
          </span>

          <template v-if="editingSeasonNumber === season.seasonNumber">
            <input
              v-model="editValue"
              type="number"
              inputmode="numeric"
              step="1"
              :min="0"
              :max="season.episodeCount"
              :aria-label="`Watched episodes for ${getSeasonLabel(season)}`"
              class="w-10 rounded border border-gray-300 bg-white px-1 py-0.5 text-right text-sm text-gray-950 tabular-nums focus:border-gray-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
              @blur="commitEdit"
              @keydown.enter.prevent="commitEdit"
              @keydown.esc.prevent="cancelEdit"
            />
            <span class="text-gray-500 dark:text-gray-400">/ {{ season.episodeCount }}</span>
          </template>

          <button
            v-else
            type="button"
            :aria-label="`Edit watched episodes for ${getSeasonLabel(season)}`"
            class="rounded px-1 py-0.5 hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:hover:bg-gray-800 dark:hover:text-white dark:disabled:hover:bg-transparent"
            :class="
              season.state === 'current'
                ? 'font-medium text-gray-950 dark:text-white'
                : 'text-gray-500 dark:text-gray-400'
            "
            :disabled="disabled || season.episodeCount === 0"
            @click="startEditing(season)"
          >
            {{ season.watchedEpisodeCount }} / {{ season.episodeCount }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>
