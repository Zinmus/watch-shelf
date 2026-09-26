export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
}

export type CachePolicy = 'short' | 'medium' | 'long'

const CACHE_CONTROL: Record<CachePolicy, string> = {
  short: 'public, max-age=300, stale-while-revalidate=1800, stale-if-error=86400',
  medium: 'public, max-age=1800, stale-while-revalidate=3600, stale-if-error=86400',
  long: 'public, max-age=86400, stale-while-revalidate=604800, stale-if-error=604800',
}

export function jsonResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return Response.json(data, {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  })
}

export function cachedJsonResponse(data: unknown, cachePolicy: CachePolicy): Response {
  return jsonResponse(data, 200, {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vercel-CDN-Cache-Control': CACHE_CONTROL[cachePolicy],
  })
}

function errorResponse(error: ApiError): Response {
  return jsonResponse(
    {
      error: {
        code: error.code,
        message: error.message,
      },
    },
    error.status,
    {
      'Cache-Control': 'no-store',
      ...error.headers,
    },
  )
}

export async function handleGet(
  request: Request,
  handler: (request: Request) => Promise<Response>,
): Promise<Response> {
  if (request.method !== 'GET') {
    return errorResponse(
      new ApiError(405, 'METHOD_NOT_ALLOWED', 'Only GET requests are supported.', {
        Allow: 'GET',
      }),
    )
  }

  try {
    return await handler(request)
  } catch (cause) {
    if (cause instanceof ApiError) {
      return errorResponse(cause)
    }

    console.error('Unhandled API error', cause instanceof Error ? cause.message : 'Unknown error')

    return errorResponse(
      new ApiError(500, 'INTERNAL_ERROR', 'The request could not be completed.'),
    )
  }
}
