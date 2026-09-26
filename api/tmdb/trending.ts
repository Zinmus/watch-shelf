import { cachedJsonResponse, handleGet } from '../_lib/http.js'
import { requestTmdb } from '../_lib/tmdb.js'
import { getSearchParams, parsePage } from '../_lib/validation.js'

export default {
  async fetch(request: Request): Promise<Response> {
    return handleGet(request, async () => {
      const searchParams = getSearchParams(request, ['page'])
      const data = await requestTmdb('/trending/all/week', {
        page: parsePage(searchParams),
      })

      return cachedJsonResponse(data, 'short')
    })
  },
}
