import { cachedJsonResponse, handleGet } from '../_lib/http.js'
import { requestTmdb } from '../_lib/tmdb.js'
import {
  getSearchParams,
  parseMediaType,
  parsePage,
  parseSearchQuery,
} from '../_lib/validation.js'

export default {
  async fetch(request: Request): Promise<Response> {
    return handleGet(request, async () => {
      const searchParams = getSearchParams(request, ['type', 'query', 'page'])
      const mediaType = parseMediaType(searchParams)
      const data = await requestTmdb(`/search/${mediaType}`, {
        include_adult: false,
        page: parsePage(searchParams),
        query: parseSearchQuery(searchParams),
      })

      return cachedJsonResponse(data, 'short')
    })
  },
}
