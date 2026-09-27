import type { TvSeasonSummary } from '@/types/tv'

export type SeasonProgressState = 'completed' | 'current' | 'unwatched'

export interface SeasonProgress {
  id: number
  name: string
  seasonNumber: number
  episodeCount: number
  watchedEpisodeCount: number
  state: SeasonProgressState
}

function normalizeEpisodeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

function getMainSeasons(seasons: TvSeasonSummary[]) {
  return seasons
    .filter(
      (season) =>
        Number.isFinite(season.seasonNumber) &&
        Math.trunc(season.seasonNumber) > 0,
    )
    .map((season) => ({
      ...season,
      seasonNumber: Math.trunc(season.seasonNumber),
      episodeCount: normalizeEpisodeCount(season.episodeCount),
    }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
}

export function getTotalMainEpisodeCount(seasons: TvSeasonSummary[]) {
  return getMainSeasons(seasons).reduce(
    (total, season) => total + season.episodeCount,
    0,
  )
}

export function clampWatchedEpisodeCount(value: number, totalEpisodeCount: number) {
  const normalizedTotal = normalizeEpisodeCount(totalEpisodeCount)
  const normalizedValue = Number.isFinite(value) ? Math.trunc(value) : 0

  return Math.min(Math.max(normalizedValue, 0), normalizedTotal)
}

export function deriveSeasonProgress(
  watchedEpisodeCount: number,
  seasons: TvSeasonSummary[],
): SeasonProgress[] {
  const mainSeasons = getMainSeasons(seasons)
  let remainingWatched = clampWatchedEpisodeCount(
    watchedEpisodeCount,
    getTotalMainEpisodeCount(mainSeasons),
  )

  return mainSeasons.map((season) => {
    const watched = Math.min(remainingWatched, season.episodeCount)
    remainingWatched -= watched

    return {
      id: season.id,
      name: season.name,
      seasonNumber: season.seasonNumber,
      episodeCount: season.episodeCount,
      watchedEpisodeCount: watched,
      state:
        season.episodeCount > 0 && watched === season.episodeCount
          ? 'completed'
          : watched > 0
            ? 'current'
            : 'unwatched',
    }
  })
}

export function getGlobalProgressForSeason(
  seasons: TvSeasonSummary[],
  seasonNumber: number,
  desiredWatchedCount: number,
) {
  const mainSeasons = getMainSeasons(seasons)
  const targetIndex = mainSeasons.findIndex(
    (season) => season.seasonNumber === seasonNumber,
  )

  if (targetIndex === -1) {
    return 0
  }

  const previousEpisodeCount = mainSeasons
    .slice(0, targetIndex)
    .reduce((total, season) => total + season.episodeCount, 0)
  const targetSeason = mainSeasons[targetIndex]

  return (
    previousEpisodeCount +
    clampWatchedEpisodeCount(
      desiredWatchedCount,
      targetSeason?.episodeCount ?? 0,
    )
  )
}
