<script setup lang="ts">
import type { MediaItem } from '@/types/media'

defineProps<{
  media: MediaItem
}>()

const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

function getYear(date: string) {
  return date ? date.slice(0, 4) : 'Unknown'
}
</script>

<template>
  <article>
    <img
      v-if="media.posterPath"
      :src="`${IMAGE_BASE_URL}${media.posterPath}`"
      :alt="media.title"
      class="aspect-[2/3] w-full rounded-lg object-cover"
    />

    <div v-else class="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-gray-200">
      No poster
    </div>

    <h2 class="mt-2 font-medium">
      {{ media.title }}
    </h2>

    <div class="mt-1 flex items-center gap-2 text-sm text-gray-500">
      <span>
        {{ getYear(media.date) }}
      </span>

      <span>
        {{ media.mediaType === 'movie' ? 'Movie' : 'Series' }}
      </span>
    </div>
  </article>
</template>
