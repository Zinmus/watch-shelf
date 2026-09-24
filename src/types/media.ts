export type MediaType = 'movie' | 'tv'

export interface Genre {
  id: number
  name: string
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
