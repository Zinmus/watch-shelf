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

interface TvLibraryState {
  status: LibraryStatus
  watchedEpisodeCount: number
}

function isTvShowCompleted(watchedEpisodeCount: number, totalEpisodeCount: number) {
  return canSetTvShowCompleted(totalEpisodeCount) && watchedEpisodeCount === totalEpisodeCount
}

export function reconcileTvLibraryState(
  currentStatus: LibraryStatus,
  watchedEpisodeCount: number,
  totalEpisodeCount: number,
): TvLibraryState {
  const normalizedCount = clampWatchedEpisodeCount(watchedEpisodeCount, totalEpisodeCount)

  if (isTvShowCompleted(normalizedCount, totalEpisodeCount)) {
    return { status: 'completed', watchedEpisodeCount: normalizedCount }
  }

  if (currentStatus === 'completed') {
    return { status: 'planned', watchedEpisodeCount: normalizedCount }
  }

  return { status: currentStatus, watchedEpisodeCount: normalizedCount }
}

export function applyTvStatusSelection(
  selectedStatus: LibraryStatus,
  watchedEpisodeCount: number,
  totalEpisodeCount: number,
): TvLibraryState {
  const normalizedCount = clampWatchedEpisodeCount(watchedEpisodeCount, totalEpisodeCount)
  const nextCount =
    selectedStatus === 'completed'
      ? clampWatchedEpisodeCount(totalEpisodeCount, totalEpisodeCount)
      : normalizedCount

  return {
    status: isTvShowCompleted(nextCount, totalEpisodeCount) ? 'completed' : selectedStatus,
    watchedEpisodeCount: nextCount,
  }
}

export function applyTvProgressChange(
  currentStatus: LibraryStatus,
  currentWatchedEpisodeCount: number,
  requestedWatchedEpisodeCount: number,
  totalEpisodeCount: number,
): TvLibraryState {
  const currentCount = clampWatchedEpisodeCount(
    currentWatchedEpisodeCount,
    totalEpisodeCount,
  )
  const nextCount = clampWatchedEpisodeCount(requestedWatchedEpisodeCount, totalEpisodeCount)

  if (isTvShowCompleted(nextCount, totalEpisodeCount)) {
    return { status: 'completed', watchedEpisodeCount: nextCount }
  }

  if (currentStatus === 'completed') {
    return { status: 'planned', watchedEpisodeCount: nextCount }
  }

  if (currentStatus === 'planned' && nextCount > currentCount) {
    return { status: 'watching', watchedEpisodeCount: nextCount }
  }

  return { status: currentStatus, watchedEpisodeCount: nextCount }
}
