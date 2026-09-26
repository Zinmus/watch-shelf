import type { TvSeasonSummary } from '@/types/tv'

export type MediaType = 'movie' | 'tv'

export type DiscoverSort = 'popularity' | 'rating' | 'date'

export interface Genre {
  id: number
  name: string
}

export interface DiscoverFilters {
  genreId?: number
  year?: number
  sortBy: DiscoverSort
}

export interface MediaItem {
  id: number
  mediaType: MediaType

  title: string
  overview: string

  posterPath: string | null
  date: string
}

interface MediaDetailsBase extends MediaItem {
  backdropPath: string | null

  status: string
  genres: Genre[]
}

export interface MovieDetails extends MediaDetailsBase {
  mediaType: 'movie'
}

export interface TvShowDetails extends MediaDetailsBase {
  mediaType: 'tv'
  seasons: TvSeasonSummary[]
}

export type MediaDetails = MovieDetails | TvShowDetails
