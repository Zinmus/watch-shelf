import { cachedJsonResponse, handleGet } from '../_lib/http.js'
import { requestTmdb } from '../_lib/tmdb.js'
import { getSearchParams, parseMediaType } from '../_lib/validation.js'

export default {
  async fetch(request: Request): Promise<Response> {
    return handleGet(request, async () => {
      const searchParams = getSearchParams(request, ['type'])
      const mediaType = parseMediaType(searchParams)
      const data = await requestTmdb(`/genre/${mediaType}/list`)

      return cachedJsonResponse(data, 'long')
    })
  },
}
