import type { WatchedEpisode } from '@/types/episodes'
import type { TvShowDetails } from '@/types/media'
import type { TvEpisode, TvSeasonDetails } from '@/types/tv'

export interface TvProgress {
  totalMainEpisodeCount: number
  releasedMainEpisodeCount: number
  watchedReleasedEpisodeCount: number
  allMainEpisodesWatched: boolean
  canComplete: boolean
}

export function getEpisodeIdentity(seasonNumber: number, episodeNumber: number) {
  return `${seasonNumber}:${episodeNumber}`
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function isEpisodeReleased(episode: TvEpisode, today = getLocalDateString()) {
  return Boolean(episode.airDate && /^\d{4}-\d{2}-\d{2}$/.test(episode.airDate) && episode.airDate <= today)
}

export function isFinishedTvShow(status: string) {
  return status === 'Ended' || status === 'Canceled'
}

export function deriveTvProgress(
  show: TvShowDetails,
  seasons: TvSeasonDetails[],
  watchedEpisodes: WatchedEpisode[],
  mainSeasonDetailsComplete: boolean,
  today = getLocalDateString(),
): TvProgress {
  const totalMainEpisodeCount = show.seasons
    .filter((season) => season.seasonNumber > 0)
    .reduce((total, season) => total + season.episodeCount, 0)
  const mainEpisodesByIdentity = new Map<string, TvEpisode>()

  seasons.forEach((season) => {
    if (season.seasonNumber <= 0) {
      return
    }

    season.episodes.forEach((episode) => {
      if (episode.episodeNumber > 0) {
        mainEpisodesByIdentity.set(
          getEpisodeIdentity(episode.seasonNumber, episode.episodeNumber),
          episode,
        )
      }
    })
  })

  const watchedIdentities = new Set(
    watchedEpisodes
      .filter((episode) => episode.seasonNumber > 0)
      .map((episode) => getEpisodeIdentity(episode.seasonNumber, episode.episodeNumber)),
  )
  const mainEpisodes = [...mainEpisodesByIdentity.values()]
  const releasedEpisodes = mainEpisodes.filter((episode) => isEpisodeReleased(episode, today))
  const watchedReleasedEpisodeCount = releasedEpisodes.filter((episode) =>
    watchedIdentities.has(getEpisodeIdentity(episode.seasonNumber, episode.episodeNumber)),
  ).length
  const episodeDetailsMatchSummary = mainEpisodes.length === totalMainEpisodeCount
  const allMainEpisodesWatched =
    mainSeasonDetailsComplete &&
    totalMainEpisodeCount > 0 &&
    episodeDetailsMatchSummary &&
    mainEpisodes.every((episode) =>
      watchedIdentities.has(getEpisodeIdentity(episode.seasonNumber, episode.episodeNumber)),
    )

  return {
    totalMainEpisodeCount,
    releasedMainEpisodeCount: releasedEpisodes.length,
    watchedReleasedEpisodeCount,
    allMainEpisodesWatched,
    canComplete: isFinishedTvShow(show.status) && allMainEpisodesWatched,
  }
}
