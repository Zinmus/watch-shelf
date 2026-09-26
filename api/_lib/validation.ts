import { ApiError } from './http.js'

export type MediaType = 'movie' | 'tv'
export type DiscoverSort = 'popularity' | 'rating' | 'date'

function invalidQuery(message: string): never {
  throw new ApiError(400, 'INVALID_QUERY', message)
}

export function getSearchParams(request: Request, allowedNames: readonly string[]): URLSearchParams {
  const searchParams = new URL(request.url).searchParams
  const allowed = new Set(allowedNames)

  for (const name of new Set(searchParams.keys())) {
    if (!allowed.has(name)) {
      invalidQuery(`Unknown query parameter: ${name}.`)
    }

    if (searchParams.getAll(name).length !== 1) {
      invalidQuery(`The ${name} parameter must be provided at most once.`)
    }
  }

  return searchParams
}

export function parseMediaType(searchParams: URLSearchParams): MediaType {
  const value = searchParams.get('type')

  if (value !== 'movie' && value !== 'tv') {
    invalidQuery('The type parameter must be either movie or tv.')
  }

  return value
}

export function parseDiscoverSort(searchParams: URLSearchParams): DiscoverSort {
  const value = searchParams.get('sort') ?? 'popularity'

  if (value !== 'popularity' && value !== 'rating' && value !== 'date') {
    invalidQuery('The sort parameter must be popularity, rating, or date.')
  }

  return value
}

function parseInteger(
  searchParams: URLSearchParams,
  name: string,
  minimum: number,
  maximum: number,
  required: boolean,
): number | undefined {
  const value = searchParams.get(name)

  if (value === null || value === '') {
    if (required) {
      invalidQuery(`The ${name} parameter is required.`)
    }

    return undefined
  }

  if (!/^\d+$/.test(value)) {
    invalidQuery(`The ${name} parameter must be an integer from ${minimum} to ${maximum}.`)
  }

  const parsed = Number(value)

  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    invalidQuery(`The ${name} parameter must be an integer from ${minimum} to ${maximum}.`)
  }

  return parsed
}

export function parsePage(searchParams: URLSearchParams): number {
  return parseInteger(searchParams, 'page', 1, 500, false) ?? 1
}

export function parseId(searchParams: URLSearchParams): number {
  return parseInteger(searchParams, 'id', 1, 2_147_483_647, true) as number
}

export function parseGenreId(searchParams: URLSearchParams): number | undefined {
  return parseInteger(searchParams, 'genreId', 1, 2_147_483_647, false)
}

export function parseYear(searchParams: URLSearchParams): number | undefined {
  return parseInteger(searchParams, 'year', 1900, 2100, false)
}

export function parseSearchQuery(searchParams: URLSearchParams): string {
  const query = searchParams.get('query')?.trim() ?? ''

  if (query.length === 0 || query.length > 100) {
    invalidQuery('The query parameter must contain from 1 to 100 characters.')
  }

  return query
}
