import type { Genre, MediaDetails, MediaItem } from '@/types/media'

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

interface MovieDetailsResponse extends MovieResponse {
  backdrop_path: string | null

  status: string
  genres: Genre[]
}

interface TvShowDetailsResponse extends TvShowResponse {
  backdrop_path: string | null

  status: string
  genres: Genre[]
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

export async function getMovies(page = 1): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<MovieResponse>>('/discover/movie', {
    page,
  })

  return {
    ...data,
    results: data.results.map(normalizeMovie),
  }
}

export async function getTvShows(page = 1): Promise<PaginatedResponse<MediaItem>> {
  const data = await request<PaginatedResponse<TvShowResponse>>('/discover/tv', {
    page,
  })

  return {
    ...data,
    results: data.results.map(normalizeTvShow),
  }
}

export async function getMovie(id: number): Promise<MediaDetails> {
  const movie = await request<MovieDetailsResponse>(`/movie/${id}`)

  return {
    ...normalizeMovie(movie),

    backdropPath: movie.backdrop_path,
    status: movie.status,
    genres: movie.genres,
  }
}

export async function getTvShow(id: number): Promise<MediaDetails> {
  const show = await request<TvShowDetailsResponse>(`/tv/${id}`)

  return {
    ...normalizeTvShow(show),

    backdropPath: show.backdrop_path,
    status: show.status,
    genres: show.genres,
  }
}
