import type {
  DiscoverFilters,
  DiscoverSort,
  Genre,
  MediaItem,
  MediaType,
  MovieDetails,
  TvShowDetails,
} from '@/types/media'
import type { TvSeasonSummary } from '@/types/tv'

const BASE_URL = 'https://api.themoviedb.org/3'
const ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN

if (!ACCESS_TOKEN) {
  throw new Error('Missing VITE_TMDB_ACCESS_TOKEN environment variable')
}

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
  const url = new URL(`${BASE_URL}${endpoint}`)

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value))
  })

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status} ${response.statusText}`)
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

function getSortValue(mediaType: MediaType, sort: DiscoverSort) {
  if (sort === 'rating') {
    return 'vote_average.desc'
  }

  if (sort === 'date') {
    return mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc'
  }

  return 'popularity.desc'
}

function buildDiscoverParams(
  mediaType: MediaType,
  page: number,
  filters: DiscoverFilters,
): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page,
    sort_by: getSortValue(mediaType, filters.sortBy),
  }

  if (filters.genreId) {
    params.with_genres = filters.genreId
  }

  if (filters.year) {
    if (mediaType === 'movie') {
      params.primary_release_year = filters.year
    } else {
      params.first_air_date_year = filters.year
    }
  }

  // Without this, "rating" can be dominated by
  // titles that have a 10/10 from only a few votes.
  if (filters.sortBy === 'rating') {
    params['vote_count.gte'] = 200
  }

  return params
}

export async function getGenres(mediaType: MediaType): Promise<Genre[]> {
  const endpoint = mediaType === 'movie' ? '/genre/movie/list' : '/genre/tv/list'

  const data = await request<GenreListResponse>(endpoint)

  return data.genres
}

export async function getMovies(
  page = 1,
  filters: DiscoverFilters = {
    sortBy: 'popularity',
  },
): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<MovieResponse>>(
    '/discover/movie',
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
    '/discover/tv',
    buildDiscoverParams('tv', page, filters),
  )

  return {
    ...data,
    results: data.results.map(normalizeTvShow),
  }
}

export async function getTrending(page = 1): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<TrendingResponse>>('/trending/all/week', {
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
  const data = await request<PaginatedResponse<MovieResponse>>('/search/movie', {
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
  const data = await request<PaginatedResponse<TvShowResponse>>('/search/tv', {
    query,
    page,
  })

  return {
    ...data,
    results: data.results.map(normalizeTvShow),
  }
}

export async function getMovie(id: number): Promise<MovieDetails> {
  const movie = await request<MovieDetailsResponse>(`/movie/${id}`)

  return {
    ...normalizeMovie(movie),
    mediaType: 'movie',

    backdropPath: movie.backdrop_path,
    status: movie.status,
    genres: movie.genres,
  }
}

export async function getTvShow(id: number): Promise<TvShowDetails> {
  const show = await request<TvShowDetailsResponse>(`/tv/${id}`)

  return {
    ...normalizeTvShow(show),
    mediaType: 'tv',

    backdropPath: show.backdrop_path,
    status: show.status,
    genres: show.genres,
    seasons: show.seasons.map(normalizeTvSeasonSummary),
  }
}
