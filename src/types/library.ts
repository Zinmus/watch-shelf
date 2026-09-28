export type LibraryStatus = 'planned' | 'watching' | 'completed'

export interface LibraryEntryBase {
  key: string
  tmdbId: number
  title: string
  status: LibraryStatus
  addedAt: string
  updatedAt: string
}

export interface MovieLibraryEntry extends LibraryEntryBase {
  mediaType: 'movie'
}

export interface TvLibraryEntry extends LibraryEntryBase {
  mediaType: 'tv'
  watchedEpisodeCount: number
  totalEpisodeCount: number | null
}

export type LibraryEntry = MovieLibraryEntry | TvLibraryEntry

interface LibraryEntryInputBase {
  tmdbId: number
  title: string
}

export interface MovieLibraryEntryInput extends LibraryEntryInputBase {
  mediaType: 'movie'
}

export interface TvLibraryEntryInput extends LibraryEntryInputBase {
  mediaType: 'tv'
  totalEpisodeCount: number
}

export type LibraryEntryInput = MovieLibraryEntryInput | TvLibraryEntryInput
