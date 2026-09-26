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

export function canSetTvShowCompleted(totalEpisodeCount: number) {
  return totalEpisodeCount > 0
}

interface ReconciledTvLibraryState {
  status: LibraryStatus
  watchedEpisodeCount: number
}

export function reconcileTvLibraryState(
  currentStatus: LibraryStatus,
  watchedEpisodeCount: number,
  totalEpisodeCount: number,
): ReconciledTvLibraryState {
  const normalizedCount = clampWatchedEpisodeCount(watchedEpisodeCount, totalEpisodeCount)

  if (canSetTvShowCompleted(totalEpisodeCount) && normalizedCount === totalEpisodeCount) {
    return { status: 'completed', watchedEpisodeCount: normalizedCount }
  }

  if (
    currentStatus === 'completed' ||
    (currentStatus === 'planned' && normalizedCount > 0)
  ) {
    return { status: 'watching', watchedEpisodeCount: normalizedCount }
  }

  return { status: currentStatus, watchedEpisodeCount: normalizedCount }
}
