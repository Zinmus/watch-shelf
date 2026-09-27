<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { clampWatchedEpisodeCount } from '@/domain/tvProgress'

const props = defineProps<{
  modelValue: number
  total: number
  disabled?: boolean
  accessibleLabel?: string
}>()

const emit = defineEmits<{
  commit: [value: number]
}>()

const editing = ref(false)
const editValue = ref('')
const editButton = ref<HTMLButtonElement | null>(null)
const editInput = ref<HTMLInputElement | null>(null)

const normalizedValue = computed(() =>
  clampWatchedEpisodeCount(props.modelValue, props.total),
)

const decrementDisabled = computed(
  () => props.disabled || editing.value || normalizedValue.value === 0,
)

const incrementDisabled = computed(
  () =>
    props.disabled ||
    editing.value ||
    props.total === 0 ||
    normalizedValue.value >= props.total,
)

function decrement() {
  emit('commit', Math.max(normalizedValue.value - 1, 0))
}

function increment() {
  emit('commit', Math.min(normalizedValue.value + 1, props.total))
}

async function startEditing() {
  editValue.value = String(normalizedValue.value)
  editing.value = true
  await nextTick()
  editInput.value?.select()
}

function closeEditor(restoreFocus = false) {
  editing.value = false

  if (restoreFocus) {
    void nextTick(() => editButton.value?.focus())
  }
}

function commitEdit(restoreFocus = false) {
  if (!editing.value) {
    return
  }

  const rawValue = String(editValue.value)
  const value = Number(rawValue)

  if (rawValue.trim() !== '' && Number.isInteger(value)) {
    const nextValue = clampWatchedEpisodeCount(value, props.total)

    if (nextValue !== normalizedValue.value) {
      emit('commit', nextValue)
    }
  }

  closeEditor(restoreFocus)
}

function cancelEdit() {
  editValue.value = String(normalizedValue.value)
  closeEditor(true)
}

watch(normalizedValue, (value) => {
  if (!editing.value) {
    editValue.value = String(value)
  }
})
</script>

<template>
  <div class="flex w-full items-center justify-between gap-3 text-sm">
    <span class="text-gray-600 dark:text-gray-400">Episodes</span>
    <div class="flex items-center gap-1">
      <button
        type="button"
        :aria-label="`Decrease ${accessibleLabel ?? 'watched episode count'}`"
        class="flex size-7 items-center justify-center rounded-md text-base text-gray-600 hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        :disabled="decrementDisabled"
        @click="decrement"
      >
        &minus;
      </button>

      <div class="flex min-w-20 items-center justify-center tabular-nums text-gray-600 dark:text-gray-400">
        <template v-if="editing">
          <input
            ref="editInput"
            v-model="editValue"
            type="number"
            inputmode="numeric"
            step="1"
            :min="0"
            :max="total"
            :aria-label="accessibleLabel ?? 'Watched episode count'"
            class="w-11 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-right text-sm text-gray-950 tabular-nums focus:border-gray-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
            @blur="commitEdit()"
            @keydown.enter.prevent="commitEdit(true)"
            @keydown.esc.prevent="cancelEdit"
          />
          <span class="ml-1">/ {{ total }}</span>
        </template>

        <button
          v-else
          ref="editButton"
          type="button"
          :aria-label="`Edit ${accessibleLabel ?? 'watched episode count'}`"
          class="rounded px-1 py-0.5 tabular-nums hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-white"
          :disabled="disabled"
          @click="startEditing"
        >
          {{ normalizedValue }} / {{ total }}
        </button>
      </div>

      <button
        type="button"
        :aria-label="`Increase ${accessibleLabel ?? 'watched episode count'}`"
        class="flex size-7 items-center justify-center rounded-md text-base text-gray-600 hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        :disabled="incrementDisabled"
        @click="increment"
      >
        +
      </button>
    </div>
  </div>
</template>
