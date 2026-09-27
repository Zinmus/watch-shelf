<script setup lang="ts">
import type { MediaType } from '@/types/media'
import type { LibraryStatus } from '@/types/library'

interface MediaCardItem {
  id: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  date: string
}

const props = defineProps<{
  media: MediaCardItem
  libraryStatus?: LibraryStatus
  tvSeasonCount?: number
  tvLibraryPending?: boolean
}>()

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

const STATUS_LABELS: Record<LibraryStatus, string> = {
  planned: 'Planned in your library',
  watching: 'Watching in your library',
  completed: 'Completed in your library',
}

const STATUS_CLASSES: Record<LibraryStatus, string> = {
  planned: 'bg-blue-50 text-blue-700 ring-blue-600/25 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-400/30',
  watching: 'bg-amber-50 text-amber-700 ring-amber-600/25 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-400/30',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-600/25 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-400/30',
}

function getYear(date: string) {
  return date ? date.slice(0, 4) : 'Unknown'
}
</script>

<template>
  <RouterLink :to="`/title/${media.mediaType}/${media.id}`" class="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4">
    <article>
      <div class="relative">
        <img
          v-if="media.posterPath"
          :src="`${IMAGE_BASE_URL}${media.posterPath}`"
          :alt="media.title"
          class="aspect-[2/3] w-full rounded-lg object-cover transition-opacity group-hover:opacity-90"
        />

        <div
          v-else
          class="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
        >
          No poster
        </div>

        <span
          v-if="media.mediaType === 'movie' && props.libraryStatus"
          role="img"
          :aria-label="STATUS_LABELS[props.libraryStatus]"
          :title="STATUS_LABELS[props.libraryStatus]"
          class="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ring-1 ring-inset"
          :class="STATUS_CLASSES[props.libraryStatus]"
        >
          <svg
            aria-hidden="true"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              v-if="props.libraryStatus === 'planned'"
              d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.5L6 21V4.75Z"
            />
            <path
              v-else-if="props.libraryStatus === 'watching'"
              d="m8 5 11 7-11 7V5Z"
            />
            <path v-else d="m5 12 4 4L19 6" />
          </svg>
        </span>

        <span
          v-else-if="media.mediaType === 'tv' && (props.tvSeasonCount || props.tvLibraryPending)"
          role="img"
          :aria-label="
            props.tvLibraryPending
              ? 'Series in your library; season migration pending'
              : `${props.tvSeasonCount} ${props.tvSeasonCount === 1 ? 'season' : 'seasons'} in your library`
          "
          :title="
            props.tvLibraryPending
              ? 'Season migration pending'
              : `${props.tvSeasonCount} ${props.tvSeasonCount === 1 ? 'season' : 'seasons'} in library`
          "
          class="absolute top-2 right-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-violet-50 px-1.5 text-xs font-semibold text-violet-700 shadow-sm ring-1 ring-violet-600/25 ring-inset dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-400/30"
        >
          <span v-if="props.tvLibraryPending" aria-hidden="true">•••</span>
          <span v-else aria-hidden="true">{{ props.tvSeasonCount }}</span>
        </span>
      </div>

      <h2 class="mt-2 font-medium text-gray-950 group-hover:underline dark:text-gray-100">
        {{ media.title }}
      </h2>

      <div class="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span>
          {{ getYear(media.date) }}
        </span>

        <span>
          {{ media.mediaType === 'movie' ? 'Movie' : 'Series' }}
        </span>
      </div>
    </article>
  </RouterLink>
</template>
