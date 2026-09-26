<script setup lang="ts">
import { computed } from 'vue'

import { clampWatchedEpisodeCount } from '@/domain/tvProgress'

const props = defineProps<{
  modelValue: number
  total: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  commit: [value: number]
}>()

const incrementDisabled = computed(
  () =>
    props.disabled ||
    props.total === 0 ||
    clampWatchedEpisodeCount(props.modelValue, props.total) >= props.total,
)

function increment() {
  const value = clampWatchedEpisodeCount(props.modelValue, props.total)
  const nextValue = Math.min(value + 1, props.total)
  emit('commit', nextValue)
}
</script>

<template>
  <div class="flex w-full items-center justify-between gap-3 text-sm">
    <span class="text-gray-600">Episodes</span>
    <div class="flex items-center gap-3">
      <span class="tabular-nums text-gray-600">{{ modelValue }} / {{ total }}</span>
      <button
        type="button"
        aria-label="Mark one more episode watched"
        class="rounded-md bg-black px-3 py-1.5 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="incrementDisabled"
        @click="increment"
      >
        +
      </button>
    </div>
  </div>
</template>
