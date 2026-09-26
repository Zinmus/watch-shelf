<script setup lang="ts">
import { computed } from 'vue'

import { getReleaseStatusLabel } from '@/domain/releaseStatus'

import type { ReleaseStatus } from '@/domain/releaseStatus'

const props = defineProps<{
  status: ReleaseStatus
}>()

const statusClass = computed(() => {
  switch (props.status) {
    case 'on-air':
      return 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-950/60 dark:text-green-300 dark:ring-green-400/25'
    case 'announced':
    case 'upcoming':
      return 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950/60 dark:text-orange-300 dark:ring-orange-400/25'
    case 'canceled':
      return 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-400/25'
    default:
      return 'bg-gray-50 text-gray-600 ring-gray-500/20 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-500/30'
  }
})
</script>

<template>
  <span
    class="rounded px-1.5 py-0.5 text-[0.6875rem] font-medium leading-4 ring-1 ring-inset"
    :class="statusClass"
  >
    {{ getReleaseStatusLabel(status) }}
  </span>
</template>
