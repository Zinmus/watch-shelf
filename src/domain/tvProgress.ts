import type { LibraryStatus } from '@/types/library'
import type { TvSeasonSummary } from '@/types/tv'

export function getTotalMainEpisodeCount(seasons: TvSeasonSummary[]) {
  return seasons
    .filter((season) => season.seasonNumber > 0)
    .reduce((total, season) => total + season.episodeCount, 0)
}

export function clampWatchedEpisodeCount(value: number, totalEpisodeCount: number) {
  const normalizedTotal = Math.max(0, Math.trunc(totalEpisodeCount))
  const normalizedValue = Number.isFinite(value) ? Math.trunc(value) : 0

  return Math.min(Math.max(normalizedValue, 0), normalizedTotal)
}

export function isFinishedTvShow(status: string) {
  return status === 'Ended' || status === 'Canceled'
}

export function canCompleteTvShow(
  releaseStatus: string,
  watchedEpisodeCount: number,
  totalEpisodeCount: number,
) {
  return (
    isFinishedTvShow(releaseStatus) &&
    totalEpisodeCount > 0 &&
    watchedEpisodeCount === totalEpisodeCount
  )
}

export function getStatusAfterTvProgressChange(
  currentStatus: LibraryStatus,
  releaseStatus: string,
  watchedEpisodeCount: number,
  totalEpisodeCount: number,
): LibraryStatus {
  if (canCompleteTvShow(releaseStatus, watchedEpisodeCount, totalEpisodeCount)) {
    return 'completed'
  }

  if (
    currentStatus === 'completed' ||
    (currentStatus === 'planned' && watchedEpisodeCount > 0)
  ) {
    return 'watching'
  }

  return currentStatus
}
