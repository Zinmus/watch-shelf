<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

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

const activeType = ref<DiscoverTab>('movie')

const items = ref<MediaItem[]>([])
const genres = ref<Genre[]>([])

const currentPage = ref(1)
const hasMore = ref(true)

const loading = ref(false)
const error = ref<string | null>(null)

const searchInput = ref('')
const searchQuery = ref('')

const filterGenreId = ref<number | ''>('')
const filterYear = ref<number | ''>('')
const filterSort = ref<DiscoverSort>('popularity')

const appliedFilters = ref<DiscoverFilters>({
  sortBy: 'popularity',
})

const loadMoreTrigger = ref<HTMLElement | null>(null)

const showScrollTop = ref(false)

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

onMounted(async () => {
  window.addEventListener('scroll', handleScroll)

  await loadGenres()
  await loadMedia()
  await nextTick()

  setupObserver()
})

onBeforeUnmount(() => {
  requestVersion++

  observer?.disconnect()

  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <main class="mx-auto max-w-7xl px-4 py-8">
    <h1 class="mb-6 text-3xl font-bold">Discover</h1>

    <!-- Search -->

    <form class="mb-6 flex gap-2" @submit.prevent="submitSearch">
      <input
        v-model="searchInput"
        :disabled="activeType === 'trending'"
        type="search"
        placeholder="Search..."
        class="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-black"
      />

      <button
        type="submit"
        :disabled="activeType === 'trending'"
        class="rounded-lg bg-black px-4 py-2 text-white disabled:cursor-not-allowed"
      >
        Search
      </button>

      <button
        v-if="searchQuery && activeType !== 'trending'"
        type="button"
        class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700"
        @click="clearSearch"
      >
        Clear
      </button>
    </form>

    <!-- Media type -->

    <div class="mb-6 flex gap-2">
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

    <!-- Discover filters -->

    <form
      class="mb-8 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-4"
      :class="{
        'opacity-50': searchQuery || activeType === 'trending',
      }"
      @submit.prevent="applyFilters"
    >
      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium text-gray-700"> Genre </span>

        <select
          v-model="filterGenreId"
          :disabled="Boolean(searchQuery) || activeType === 'trending'"
          class="rounded-lg border border-gray-300 bg-white px-3 py-2"
        >
          <option value="">All genres</option>

          <option v-for="genre in genres" :key="genre.id" :value="genre.id">
            {{ genre.name }}
          </option>
        </select>
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium text-gray-700"> Year </span>

        <input
          v-model.number="filterYear"
          :disabled="Boolean(searchQuery) || activeType === 'trending'"
          type="number"
          min="1900"
          max="2100"
          placeholder="Any year"
          class="rounded-lg border border-gray-300 bg-white px-3 py-2"
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-sm font-medium text-gray-700"> Sort by </span>

        <select
          v-model="filterSort"
          :disabled="Boolean(searchQuery) || activeType === 'trending'"
          class="rounded-lg border border-gray-300 bg-white px-3 py-2"
        >
          <option value="popularity">Popularity</option>

          <option value="rating">Rating</option>

          <option value="date">Release date</option>
        </select>
      </label>

      <div class="flex items-end gap-2">
        <button
          type="submit"
          :disabled="Boolean(searchQuery) || activeType === 'trending'"
          class="rounded-lg bg-black px-4 py-2 text-white disabled:cursor-not-allowed"
        >
          Apply
        </button>

        <button
          type="button"
          :disabled="Boolean(searchQuery) || activeType === 'trending'"
          class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 disabled:cursor-not-allowed"
          @click="resetFilters"
        >
          Reset
        </button>
      </div>
    </form>

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
