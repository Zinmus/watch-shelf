import { cachedJsonResponse, handleGet } from '../_lib/http.js'
import { requestTmdb } from '../_lib/tmdb.js'
import {
  getSearchParams,
  parseDiscoverSort,
  parseGenreId,
  parseMediaType,
  parsePage,
  parseYear,
} from '../_lib/validation.js'

export default {
  async fetch(request: Request): Promise<Response> {
    return handleGet(request, async () => {
      const searchParams = getSearchParams(request, ['type', 'page', 'sort', 'genreId', 'year'])
      const mediaType = parseMediaType(searchParams)
      const page = parsePage(searchParams)
      const sort = parseDiscoverSort(searchParams)
      const genreId = parseGenreId(searchParams)
      const year = parseYear(searchParams)
      const tmdbParams: Record<string, string | number | boolean> = {
        include_adult: false,
        page,
        sort_by:
          sort === 'rating'
            ? 'vote_average.desc'
            : sort === 'date'
              ? mediaType === 'movie'
                ? 'primary_release_date.desc'
                : 'first_air_date.desc'
              : 'popularity.desc',
      }

      if (genreId !== undefined) {
        tmdbParams.with_genres = genreId
      }

      if (year !== undefined) {
        tmdbParams[mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = year
      }

      if (sort === 'rating') {
        tmdbParams['vote_count.gte'] = 200
      }

      const data = await requestTmdb(`/discover/${mediaType}`, tmdbParams)

      return cachedJsonResponse(data, 'short')
    })
  },
}
