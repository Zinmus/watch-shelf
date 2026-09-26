import type {
  DiscoverFilters,
  Genre,
  MediaItem,
  MediaType,
  MovieDetails,
  TvShowDetails,
} from '@/types/media'
import type { TvSeasonSummary } from '@/types/tv'

const BASE_URL = '/api/tmdb'

interface PaginatedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

interface GenreListResponse {
  genres: Genre[]
}

interface MovieResponse {
  id: number
  title: string
  overview: string

  poster_path: string | null
  release_date: string
}

interface TvShowResponse {
  id: number
  name: string
  overview: string

  poster_path: string | null
  first_air_date: string
}

type TrendingResponse =
  | (MovieResponse & { media_type: 'movie' })
  | (TvShowResponse & { media_type: 'tv' })
  | { media_type: 'person' }

interface MovieDetailsResponse extends MovieResponse {
  backdrop_path: string | null

  status: string
  genres: Genre[]
}

interface TvShowDetailsResponse extends TvShowResponse {
  backdrop_path: string | null

  status: string
  genres: Genre[]
  seasons: TvSeasonSummaryResponse[]
}

interface TvSeasonSummaryResponse {
  id: number
  name: string
  air_date: string | null
  episode_count: number
  season_number: number
}

async function request<T>(
  endpoint: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`, window.location.origin)

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value))
  })

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Media request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

function normalizeMovie(movie: MovieResponse): MediaItem {
  return {
    id: movie.id,
    mediaType: 'movie',

    title: movie.title,
    overview: movie.overview,

    posterPath: movie.poster_path,
    date: movie.release_date,
  }
}

function normalizeTvShow(show: TvShowResponse): MediaItem {
  return {
    id: show.id,
    mediaType: 'tv',

    title: show.name,
    overview: show.overview,

    posterPath: show.poster_path,
    date: show.first_air_date,
  }
}

function normalizeTvSeasonSummary(season: TvSeasonSummaryResponse): TvSeasonSummary {
  return {
    id: season.id,
    name: season.name,
    airDate: season.air_date,
    episodeCount: season.episode_count,
    seasonNumber: season.season_number,
  }
}

function buildDiscoverParams(
  mediaType: MediaType,
  page: number,
  filters: DiscoverFilters,
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page,
    sort: filters.sortBy,
    type: mediaType,
  }

  if (filters.genreId) {
    params.genreId = filters.genreId
  }

  if (filters.year) {
    params.year = filters.year
  }

  return params
}

export async function getGenres(mediaType: MediaType): Promise<Genre[]> {
  const data = await request<GenreListResponse>('/genres', {
    type: mediaType,
  })

  return data.genres
}

export async function getMovies(
  page = 1,
  filters: DiscoverFilters = {
    sortBy: 'popularity',
  },
): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<MovieResponse>>(
    '/discover',
    buildDiscoverParams('movie', page, filters),
  )

  return {
    ...data,
    results: data.results.map(normalizeMovie),
  }
}

export async function getTvShows(
  page = 1,
  filters: DiscoverFilters = {
    sortBy: 'popularity',
  },
): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<TvShowResponse>>(
    '/discover',
    buildDiscoverParams('tv', page, filters),
  )

  return {
    ...data,
    results: data.results.map(normalizeTvShow),
  }
}

export async function getTrending(page = 1): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<TrendingResponse>>('/trending', {
    page,
  })

  const results = data.results.flatMap((item) => {
    if (item.media_type === 'movie') {
      return [normalizeMovie(item)]
    }

    if (item.media_type === 'tv') {
      return [normalizeTvShow(item)]
    }

    return []
  })

  return {
    ...data,
    results,
  }
}

export async function searchMovies(query: string, page = 1): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<MovieResponse>>('/search', {
    type: 'movie',
    query,
    page,
  })

  return {
    ...data,
    results: data.results.map(normalizeMovie),
  }
}

export async function searchTvShows(
  query: string,
  page = 1,
): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<TvShowResponse>>('/search', {
    type: 'tv',
    query,
    page,
  })

  return {
    ...data,
    results: data.results.map(normalizeTvShow),
  }
}

export async function getMovie(id: number): Promise<MovieDetails> {
  const movie = await request<MovieDetailsResponse>('/details', {
    id,
    type: 'movie',
  })

  return {
    ...normalizeMovie(movie),
    mediaType: 'movie',

    backdropPath: movie.backdrop_path,
    status: movie.status,
    genres: movie.genres,
  }
}

export async function getTvShow(id: number): Promise<TvShowDetails> {
  const show = await request<TvShowDetailsResponse>('/details', {
    id,
    type: 'tv',
  })

  return {
    ...normalizeTvShow(show),
    mediaType: 'tv',

    backdropPath: show.backdrop_path,
    status: show.status,
    genres: show.genres,
    seasons: show.seasons.map(normalizeTvSeasonSummary),
  }
}
