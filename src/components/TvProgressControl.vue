<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { clampWatchedEpisodeCount } from '@/domain/tvProgress'

const props = defineProps<{
  modelValue: number
  total: number
  disabled?: boolean
}>()

const emit = defineEmits<{
  commit: [value: number]
}>()

const draft = ref(String(props.modelValue))

const incrementDisabled = computed(
  () =>
    props.disabled ||
    props.total === 0 ||
    clampWatchedEpisodeCount(getDraftValue(), props.total) >= props.total,
)

function getDraftValue() {
  if (draft.value.trim() === '') {
    return props.modelValue
  }

  const parsedValue = Number(draft.value)

  return Number.isFinite(parsedValue) ? parsedValue : props.modelValue
}

function commitDraft() {
  const value = clampWatchedEpisodeCount(getDraftValue(), props.total)
  draft.value = String(value)
  emit('commit', value)
}

function increment() {
  const value = clampWatchedEpisodeCount(getDraftValue(), props.total)
  const nextValue = Math.min(value + 1, props.total)
  draft.value = String(nextValue)
  emit('commit', nextValue)
}

watch(
  () => props.modelValue,
  (value) => {
    draft.value = String(value)
  },
)

watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled) {
      draft.value = String(props.modelValue)
    }
  },
)
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      v-model="draft"
      type="number"
      inputmode="numeric"
      min="0"
      :max="total"
      step="1"
      aria-label="Watched episodes"
      class="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-right tabular-nums disabled:cursor-not-allowed disabled:bg-gray-100"
      :disabled="disabled || total === 0"
      @blur="commitDraft"
      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
    />
    <span class="tabular-nums text-gray-600">/ {{ total }}</span>
    <button
      type="button"
      aria-label="Mark one more episode watched"
      class="rounded-lg bg-black px-3 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      :disabled="incrementDisabled"
      @mousedown.prevent
      @click="increment"
    >
      +
    </button>
  </div>
</template>
