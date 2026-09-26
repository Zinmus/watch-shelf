<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import MediaCard from '@/components/MediaCard.vue'

import {
  getGenres,
  getMovies,
  getTrending,
  getTvShows,
  searchMovies,
  searchTvShows,
} from '@/api/tmdb'

import type { DiscoverFilters, DiscoverSort, Genre, MediaItem, MediaType } from '@/types/media'

type DiscoverTab = MediaType | 'trending'

const activeType = ref<DiscoverTab>('trending')

const items = ref<MediaItem[]>([])
const genres = ref<Genre[]>([])

const currentPage = ref(1)
const hasMore = ref(true)

const loading = ref(false)
const error = ref<string | null>(null)

const searchInput = ref('')
const searchQuery = ref('')

const filtersOpen = ref(false)
const filtersPanel = ref<HTMLElement | null>(null)
const filtersButton = ref<HTMLButtonElement | null>(null)

const filterGenreId = ref<number | ''>('')
const filterYear = ref<number | ''>('')
const filterSort = ref<DiscoverSort>('popularity')

const appliedFilters = ref<DiscoverFilters>({
  sortBy: 'popularity',
})

const loadMoreTrigger = ref<HTMLElement | null>(null)

const showScrollTop = ref(false)

const activeFilterCount = computed(() => {
  let count = 0

  if (appliedFilters.value.genreId !== undefined) count++
  if (appliedFilters.value.year !== undefined) count++
  if (appliedFilters.value.sortBy !== 'popularity') count++

  return count
})

let observer: IntersectionObserver | null = null

/*
 * Used to ignore responses from an older request
 * after the user changes type/search/filters.
 */
let requestVersion = 0

async function loadMedia() {
  if (loading.value || !hasMore.value) {
    return
  }

  const version = requestVersion
  const page = currentPage.value
  const type = activeType.value
  const query = searchQuery.value
  const filters = {
    ...appliedFilters.value,
  }

  try {
    loading.value = true
    error.value = null

    let data

    if (type === 'trending') {
      data = await getTrending(page)
    } else if (query) {
      data = type === 'movie' ? await searchMovies(query, page) : await searchTvShows(query, page)
    } else {
      data = type === 'movie' ? await getMovies(page, filters) : await getTvShows(page, filters)
    }

    /*
     * The user changed the current view while
     * this request was running.
     */
    if (version !== requestVersion) {
      return
    }

    items.value.push(...data.results)

    hasMore.value = data.page < data.total_pages

    currentPage.value = data.page + 1
  } catch (err) {
    if (version !== requestVersion) {
      return
    }

    console.error(err)

    error.value = 'Failed to load media.'
  } finally {
    if (version === requestVersion) {
      loading.value = false
    }
  }
}

async function resetAndLoad() {
  /*
   * Invalidate requests belonging to the
   * previous Discover state.
   */
  requestVersion++

  items.value = []
  currentPage.value = 1
  hasMore.value = true
  error.value = null
  loading.value = false

  await loadMedia()
}

async function loadGenres() {
  if (activeType.value === 'trending') {
    return
  }

  try {
    genres.value = await getGenres(activeType.value)
  } catch (err) {
    console.error('Failed to load genres:', err)

    genres.value = []
  }
}

async function selectType(type: DiscoverTab) {
  if (activeType.value === type) {
    return
  }

  activeType.value = type
  filtersOpen.value = false

  /*
   * Movie and TV genre IDs are separate lists,
   * so clear the selected genre when switching.
   */
  filterGenreId.value = ''

  appliedFilters.value = {
    ...appliedFilters.value,
    genreId: undefined,
  }

  if (type !== 'trending') {
    await loadGenres()
  }
  await resetAndLoad()
}

async function submitSearch() {
  const query = searchInput.value.trim()

  if (query === searchQuery.value) {
    return
  }

  searchQuery.value = query

  await resetAndLoad()
}

function toggleFilters() {
  filtersOpen.value = !filtersOpen.value
}

async function clearSearch() {
  if (!searchQuery.value && !searchInput.value) {
    return
  }

  searchInput.value = ''
  searchQuery.value = ''

  await resetAndLoad()
}

async function applyFilters() {
  if (searchQuery.value) {
    return
  }

  appliedFilters.value = {
    sortBy: filterSort.value,

    genreId: filterGenreId.value === '' ? undefined : filterGenreId.value,

    year: filterYear.value === '' ? undefined : filterYear.value,
  }

  filtersOpen.value = false
  await resetAndLoad()
}

async function resetFilters() {
  filterGenreId.value = ''
  filterYear.value = ''
  filterSort.value = 'popularity'

  appliedFilters.value = {
    sortBy: 'popularity',
  }

  await resetAndLoad()
}

function setupObserver() {
  if (!loadMoreTrigger.value) {
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]

      if (entry?.isIntersecting) {
        loadMedia()
      }
    },
    {
      rootMargin: '300px',
    },
  )

  observer.observe(loadMoreTrigger.value)
}

function handleScroll() {
  showScrollTop.value = window.scrollY > 600
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node

  if (
    filtersOpen.value &&
    !filtersPanel.value?.contains(target) &&
    !filtersButton.value?.contains(target)
  ) {
    filtersOpen.value = false
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return

  if (filtersOpen.value) {
    filtersOpen.value = false
    filtersButton.value?.focus()
  }
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll)
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  document.addEventListener('keydown', handleKeydown)

  await loadGenres()
  await loadMedia()
  await nextTick()

  setupObserver()
})

onBeforeUnmount(() => {
  requestVersion++

  observer?.disconnect()

  window.removeEventListener('scroll', handleScroll)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <main class="mx-auto max-w-7xl px-4 py-8">
    <h1 class="mb-6 text-3xl font-bold">Discover</h1>

    <!-- Discover toolbar -->

    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg px-4 py-2"
          :class="activeType === 'trending' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
          @click="selectType('trending')"
        >
          Trending
        </button>

        <button
          type="button"
          class="rounded-lg px-4 py-2"
          :class="activeType === 'movie' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
          @click="selectType('movie')"
        >
          Movies
        </button>

        <button
          type="button"
          class="rounded-lg px-4 py-2"
          :class="activeType === 'tv' ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'"
          @click="selectType('tv')"
        >
          Series
        </button>
      </div>

      <div v-if="activeType !== 'trending'" class="relative flex flex-wrap items-center gap-2">
        <form
          class="flex flex-wrap items-center gap-2"
          role="search"
          @submit.prevent="submitSearch"
        >
          <div class="relative">
            <input
              v-model="searchInput"
              type="search"
              aria-label="Search movies or series"
              placeholder="Search..."
              class="h-10 w-48 appearance-none rounded-lg border border-gray-300 bg-white pr-10 pl-3 text-sm outline-none focus:border-black sm:w-56"
            />

            <button
              v-if="searchQuery"
              type="button"
              aria-label="Clear search"
              class="absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-1"
              @click="clearSearch"
            >
              <svg
                aria-hidden="true"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>

            <button
              v-else
              type="submit"
              aria-label="Submit search"
              class="absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-1"
            >
              <svg
                aria-hidden="true"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
            </button>
          </div>
        </form>

        <button
          ref="filtersButton"
          type="button"
          :aria-label="
            activeFilterCount ? `Open filters, ${activeFilterCount} active` : 'Open filters'
          "
          :aria-expanded="filtersOpen"
          aria-controls="discover-filters"
          :disabled="Boolean(searchQuery)"
          class="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          :class="{ 'border-gray-900 text-gray-900': filtersOpen || activeFilterCount }"
          @click="toggleFilters"
        >
          <svg
            aria-hidden="true"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          <span
            >Filters<span v-if="activeFilterCount"> ({{ activeFilterCount }})</span></span
          >
        </button>

        <form
          v-if="filtersOpen"
          id="discover-filters"
          ref="filtersPanel"
          class="absolute top-12 right-0 z-20 grid w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg sm:w-96 sm:grid-cols-2"
          @submit.prevent="applyFilters"
        >
          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Genre</span>
            <select
              v-model="filterGenreId"
              class="rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              <option value="">All genres</option>
              <option v-for="genre in genres" :key="genre.id" :value="genre.id">
                {{ genre.name }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1">
            <span class="text-sm font-medium text-gray-700">Year</span>
            <input
              v-model.number="filterYear"
              type="number"
              min="1900"
              max="2100"
              placeholder="Any year"
              class="rounded-lg border border-gray-300 bg-white px-3 py-2"
            />
          </label>

          <label class="flex flex-col gap-1 sm:col-span-2">
            <span class="text-sm font-medium text-gray-700">Sort by</span>
            <select
              v-model="filterSort"
              class="rounded-lg border border-gray-300 bg-white px-3 py-2"
            >
              <option value="popularity">Popularity</option>
              <option value="rating">Rating</option>
              <option value="date">Release date</option>
            </select>
          </label>

          <div class="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700"
              @click="resetFilters"
            >
              Reset
            </button>
            <button type="submit" class="rounded-lg bg-black px-4 py-2 text-white">Apply</button>
          </div>
        </form>
      </div>
    </div>

    <p v-if="searchQuery && activeType !== 'trending'" class="mb-5 text-sm text-gray-500">
      Results for
      <strong class="text-gray-800"> "{{ searchQuery }}" </strong>

      — clear the search to use Discover filters.
    </p>

    <!-- Results -->

    <p v-if="error && items.length === 0" class="text-red-600">
      {{ error }}
    </p>

    <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <MediaCard v-for="item in items" :key="`${item.mediaType}-${item.id}`" :media="item" />
    </div>

    <p v-if="!loading && !error && items.length === 0" class="py-12 text-center text-gray-500">
      No results found.
    </p>

    <!-- Infinite scroll trigger -->

    <div ref="loadMoreTrigger" class="h-1" />

    <p v-if="loading" class="py-6 text-center text-gray-500">Loading...</p>

    <p v-else-if="error" class="py-6 text-center text-red-600">
      {{ error }}
    </p>

    <p v-else-if="!hasMore && items.length > 0" class="py-6 text-center text-gray-500">
      No more results.
    </p>

    <!-- Scroll to top -->

    <button
      v-if="showScrollTop"
      type="button"
      aria-label="Scroll to top"
      class="fixed right-6 bottom-6 flex h-11 w-11 items-center justify-center rounded-full bg-black text-xl text-white shadow-lg transition hover:scale-105"
      @click="scrollToTop"
    >
      ↑
    </button>
  </main>
</template>
