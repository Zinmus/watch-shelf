<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

import { clampWatchedEpisodeCount } from '@/domain/tvProgress'

const props = defineProps<{
  modelValue: number
  total: number
  disabled?: boolean
  label?: string
  active?: boolean
  titleTooltip?: boolean
}>()

const emit = defineEmits<{
  commit: [value: number]
}>()

const editing = ref(false)
const editValue = ref('')
const editButton = ref<HTMLButtonElement | null>(null)
const editInput = ref<HTMLInputElement | null>(null)
const labelElement = ref<HTMLElement | null>(null)
const isLabelTruncated = ref(false)
const tooltipId = `progress-label-${useId()}`
let labelResizeObserver: ResizeObserver | undefined

const normalizedValue = computed(() =>
  clampWatchedEpisodeCount(props.modelValue, props.total),
)

const accessibleProgressName = computed(() =>
  props.label ? `${props.label} watched episode count` : 'watched episode count',
)

const progressLabel = computed(() => props.label ?? 'Episodes')

const progressWidth = computed(() => {
  const digitCount = String(Math.max(props.total, 0)).length
  return `${Math.max(digitCount * 2 + 1, 5)}ch`
})

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

function updateLabelTruncation() {
  const element = labelElement.value
  isLabelTruncated.value = Boolean(
    props.titleTooltip && element && element.scrollWidth > element.clientWidth,
  )
}

onMounted(() => {
  void nextTick(updateLabelTruncation)

  if (props.titleTooltip && labelElement.value && typeof ResizeObserver !== 'undefined') {
    labelResizeObserver = new ResizeObserver(updateLabelTruncation)
    labelResizeObserver.observe(labelElement.value)
  }
})

onBeforeUnmount(() => labelResizeObserver?.disconnect())

watch(normalizedValue, (value) => {
  if (!editing.value) {
    editValue.value = String(value)
  }
})

watch(progressLabel, () => void nextTick(updateLabelTruncation))
</script>

<template>
  <div class="flex w-full items-center gap-1.5 text-xs">
    <div
      class="group relative min-w-0 flex-1"
      :class="
        active
          ? 'text-gray-800 dark:text-gray-200'
          : 'text-gray-600 dark:text-gray-400'
      "
    >
      <span
        ref="labelElement"
        class="block truncate rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1"
        :tabindex="titleTooltip && isLabelTruncated ? 0 : undefined"
        :aria-describedby="isLabelTruncated ? tooltipId : undefined"
      >
        {{ progressLabel }}
      </span>

      <span
        v-if="titleTooltip && isLabelTruncated"
        :id="tooltipId"
        role="tooltip"
        class="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden max-w-xs rounded bg-gray-950 px-2 py-1 text-xs leading-4 whitespace-normal text-white shadow-lg group-hover:block group-focus-within:block dark:bg-gray-100 dark:text-gray-950"
      >
        {{ progressLabel }}
      </span>
    </div>

    <div class="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        :aria-label="`Decrease ${accessibleProgressName}`"
        class="flex size-6 items-center justify-center rounded text-sm text-gray-600 hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        :disabled="decrementDisabled"
        @click="decrement"
      >
        &minus;
      </button>

      <div
        class="flex items-center justify-center tabular-nums text-gray-600 dark:text-gray-400"
        :style="{ minWidth: progressWidth }"
      >
        <template v-if="editing">
          <input
            ref="editInput"
            v-model="editValue"
            type="number"
            inputmode="numeric"
            step="1"
            :min="0"
            :max="total"
            :aria-label="accessibleProgressName"
            class="w-8 rounded border border-gray-300 bg-white px-1 py-0.5 text-right text-xs text-gray-950 tabular-nums focus:border-gray-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-gray-400"
            @blur="commitEdit()"
            @keydown.enter.prevent="commitEdit(true)"
            @keydown.esc.prevent="cancelEdit"
          />
          <span>/{{ total }}</span>
        </template>

        <button
          v-else
          ref="editButton"
          type="button"
          :aria-label="`Edit ${accessibleProgressName}`"
          class="rounded px-0.5 py-0.5 tabular-nums hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-white"
          :class="active ? 'font-medium text-gray-950 dark:text-white' : ''"
          :disabled="disabled"
          @click="startEditing"
        >
          {{ normalizedValue }}/{{ total }}
        </button>
      </div>

      <button
        type="button"
        :aria-label="`Increase ${accessibleProgressName}`"
        class="flex size-6 items-center justify-center rounded text-sm text-gray-600 hover:bg-gray-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        :disabled="incrementDisabled"
        @click="increment"
      >
        +
      </button>
    </div>
  </div>
</template>
