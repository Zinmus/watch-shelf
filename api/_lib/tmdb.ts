import { ApiError } from './http.js'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const UPSTREAM_TIMEOUT_MS = 8_000

export async function requestTmdb(
  path: string,
  params: Record<string, string | number | boolean> = {},
): Promise<unknown> {
  const accessToken = process.env.TMDB_ACCESS_TOKEN

  if (!accessToken) {
    throw new ApiError(500, 'SERVER_MISCONFIGURED', 'The media service is not configured.')
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`)

  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, String(value))
  }

  let response: Response

  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'TimeoutError') {
      throw new ApiError(504, 'UPSTREAM_TIMEOUT', 'The media service took too long to respond.')
    }

    throw new ApiError(502, 'UPSTREAM_UNAVAILABLE', 'The media service is unavailable.')
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiError(404, 'NOT_FOUND', 'The requested media resource was not found.')
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')

      throw new ApiError(
        429,
        'UPSTREAM_RATE_LIMITED',
        'The media service is temporarily rate limited.',
        retryAfter ? { 'Retry-After': retryAfter } : {},
      )
    }

    throw new ApiError(502, 'UPSTREAM_ERROR', 'The media service could not complete the request.')
  }

  try {
    return await response.json()
  } catch {
    throw new ApiError(502, 'UPSTREAM_INVALID_RESPONSE', 'The media service returned invalid data.')
  }
}
