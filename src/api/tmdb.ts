const BASE_URL = 'https://api.themoviedb.org/3'
const ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN

if (!ACCESS_TOKEN) {
  throw new Error('Missing VITE_TMDB_ACCESS_TOKEN environment variable')
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

interface PaginatedResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

interface Movie {
  id: number
  title: string
  overview: string
  poster_path: string | null
  release_date: string
}

export function getMovies(page = 1) {
  return request<PaginatedResponse<Movie>>('/discover/movie', {
    page,
  })
}

interface TvShow {
  id: number
  name: string
  overview: string
  poster_path: string | null
  first_air_date: string
}

export function getTvShows(page = 1) {
  return request<PaginatedResponse<TvShow>>('/discover/tv', {
    page,
  })
}
