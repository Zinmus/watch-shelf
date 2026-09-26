import type { DiscoverSort, MediaType } from '@/types/media'

export type DiscoverTab = MediaType | 'trending'

export interface DiscoverSessionState {
  activeType: DiscoverTab
  filterType: MediaType | null
  genreId: number | null
  year: number | null
  sortBy: DiscoverSort
  searchQuery: string
  searchInput: string
}

const STORAGE_KEY = 'watch-shelf:discover-state'
const VALID_TABS: DiscoverTab[] = ['trending', 'movie', 'tv']
const VALID_MEDIA_TYPES: MediaType[] = ['movie', 'tv']
const VALID_SORTS: DiscoverSort[] = ['popularity', 'rating', 'date']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function readDiscoverSession(): DiscoverSessionState | null {
  try {
    const rawState = sessionStorage.getItem(STORAGE_KEY)

    if (!rawState) return null

    const state: unknown = JSON.parse(rawState)

    if (
      !isRecord(state) ||
      !VALID_TABS.includes(state.activeType as DiscoverTab) ||
      !(state.filterType === null || VALID_MEDIA_TYPES.includes(state.filterType as MediaType)) ||
      !(
        state.genreId === null ||
        (typeof state.genreId === 'number' && Number.isInteger(state.genreId) && state.genreId > 0)
      ) ||
      !(
        state.year === null ||
        (typeof state.year === 'number' &&
          Number.isInteger(state.year) &&
          state.year >= 1900 &&
          state.year <= 2100)
      ) ||
      !VALID_SORTS.includes(state.sortBy as DiscoverSort) ||
      typeof state.searchQuery !== 'string' ||
      state.searchQuery !== state.searchQuery.trim() ||
      typeof state.searchInput !== 'string' ||
      (state.activeType !== 'trending' && state.filterType !== state.activeType) ||
      (state.genreId !== null && state.filterType === null)
    ) {
      return null
    }

    return state as unknown as DiscoverSessionState
  } catch {
    return null
  }
}

export function writeDiscoverSession(state: DiscoverSessionState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Discover remains usable when storage is unavailable or full.
  }
}
