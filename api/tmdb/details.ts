import { cachedJsonResponse, handleGet } from '../_lib/http.js'
import { requestTmdb } from '../_lib/tmdb.js'
import { getSearchParams, parseId, parseMediaType } from '../_lib/validation.js'

export default {
  async fetch(request: Request): Promise<Response> {
    return handleGet(request, async () => {
      const searchParams = getSearchParams(request, ['type', 'id'])
      const mediaType = parseMediaType(searchParams)
      const id = parseId(searchParams)
      const data = await requestTmdb(`/${mediaType}/${id}`)

      return cachedJsonResponse(data, 'medium')
    })
  },
}
