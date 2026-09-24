const BASE_URL = 'https://api.themoviedb.org/3'
const ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN

if (!ACCESS_TOKEN) {
  throw new Error('Missing VITE_TMDB_ACCESS_TOKEN environment variable')
}

export interface Movie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  release_date: string
}

export interface TvShow {
  id: number
  name: string
  overview: string
  poster_path: string | null
  first_air_date: string
}

export type MediaType = 'movie' | 'tv'

export interface MediaItem {
  id: number
  mediaType: MediaType
  title: string
  overview: string
  posterPath: string | null
  date: string
}

interface PaginatedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
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
    throw new Error(`TMDB request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function getMovies(page = 1): Promise<MediaItem[]> {
  const data = await request<PaginatedResponse<Movie>>('/discover/movie', {
    page,
  })

  return data.results.map((movie) => ({
    id: movie.id,
    mediaType: 'movie',
    title: movie.title,
    overview: movie.overview,
    posterPath: movie.poster_path,
    date: movie.release_date,
  }))
}

export async function getTvShows(page = 1): Promise<MediaItem[]> {
  const data = await request<PaginatedResponse<TvShow>>('/discover/tv', {
    page,
  })

  return data.results.map((show) => ({
    id: show.id,
    mediaType: 'tv',
    title: show.name,
    overview: show.overview,
    posterPath: show.poster_path,
    date: show.first_air_date,
  }))
}
