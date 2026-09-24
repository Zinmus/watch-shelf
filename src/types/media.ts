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

export interface MediaDetails extends MediaItem {
  backdropPath: string | null

  status: string
  genres: Genre[]
}
