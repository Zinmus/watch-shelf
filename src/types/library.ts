export type LibraryStatus = 'planned' | 'watching' | 'completed'
export type MovieLibraryStatus = Exclude<LibraryStatus, 'watching'>

interface LibraryEntryBase {
  key: string
  addedAt: string
  updatedAt: string
}

export interface MovieLibraryEntry extends LibraryEntryBase {
  mediaType: 'movie'
  tmdbId: number
  title: string
  posterPath: string | null
  date: string
  status: MovieLibraryStatus
}

export interface TvSeasonLibraryEntry extends LibraryEntryBase {
  mediaType: 'tv'
  showTmdbId: number
  seasonNumber: number
  showTitle: string
  seasonName?: string
  status: LibraryStatus
  watchedEpisodeCount: number
}

export type LibraryEntry = MovieLibraryEntry | TvSeasonLibraryEntry

export type MovieLibraryEntryInput = Pick<
  MovieLibraryEntry,
  'tmdbId' | 'title' | 'posterPath' | 'date'
>

export type TvSeasonLibraryEntryInput = Pick<
  TvSeasonLibraryEntry,
  'showTmdbId' | 'seasonNumber' | 'showTitle' | 'seasonName'
>

export interface LegacyTvLibraryEntry {
  showTmdbId: number
  showTitle: string
  posterPath: string | null
  date: string
  status: LibraryStatus
  watchedEpisodeCount: number
  addedAt: string
  updatedAt: string
}
