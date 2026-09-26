<script setup lang="ts">
import type { MediaType } from '@/types/media'

interface MediaCardItem {
  id: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  date: string
}

defineProps<{
  media: MediaCardItem
}>()

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

function getYear(date: string) {
  return date ? date.slice(0, 4) : 'Unknown'
}
</script>

<template>
  <RouterLink :to="`/title/${media.mediaType}/${media.id}`" class="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4">
    <article>
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
