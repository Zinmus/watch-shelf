import type { LibraryStatus } from '@/types/library'

export interface TvLibraryState {
  status: LibraryStatus
  watchedEpisodeCount: number
  totalEpisodeCount: number | null
}

function normalizeWatchedEpisodeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

export function normalizeTotalEpisodeCount(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null
  }

  const normalizedValue = Math.trunc(value)
  return normalizedValue > 0 ? normalizedValue : null
}

export function hasKnownEpisodeTotal(totalEpisodeCount: number | null) {
  return normalizeTotalEpisodeCount(totalEpisodeCount) !== null
}

export function createTvLibraryState(
  status: LibraryStatus,
  watchedEpisodeCount: number,
  totalEpisodeCount: number | null,
): TvLibraryState | null {
  const normalizedTotal = normalizeTotalEpisodeCount(totalEpisodeCount)
  const normalizedWatched = normalizeWatchedEpisodeCount(watchedEpisodeCount)

  if (status === 'completed') {
    return normalizedTotal === null
      ? null
      : {
          status: 'completed',
          watchedEpisodeCount: normalizedTotal,
          totalEpisodeCount: normalizedTotal,
        }
  }

  if (normalizedTotal !== null) {
    const clampedWatched = Math.min(normalizedWatched, normalizedTotal)

    return {
      status: clampedWatched === normalizedTotal ? 'completed' : status,
      watchedEpisodeCount: clampedWatched,
      totalEpisodeCount: normalizedTotal,
    }
  }

  return {
    status,
    watchedEpisodeCount: normalizedWatched,
    totalEpisodeCount: null,
  }
}

export function applyTvProgressChange(
  current: TvLibraryState,
  watchedEpisodeCount: number,
): TvLibraryState {
  const totalEpisodeCount = normalizeTotalEpisodeCount(current.totalEpisodeCount)
  const normalizedWatched = normalizeWatchedEpisodeCount(watchedEpisodeCount)

  if (totalEpisodeCount === null) {
    return {
      ...current,
      watchedEpisodeCount: normalizedWatched,
      totalEpisodeCount,
    }
  }

  const clampedWatched = Math.min(normalizedWatched, totalEpisodeCount)

  return {
    status:
      clampedWatched === totalEpisodeCount
        ? 'completed'
        : current.status === 'completed'
          ? 'planned'
          : current.status,
    watchedEpisodeCount: clampedWatched,
    totalEpisodeCount,
  }
}

export function applyTvStatusChange(
  current: TvLibraryState,
  status: LibraryStatus,
): TvLibraryState | null {
  const totalEpisodeCount = normalizeTotalEpisodeCount(current.totalEpisodeCount)

  if (status === 'completed') {
    return totalEpisodeCount === null
      ? null
      : {
          status: 'completed',
          watchedEpisodeCount: totalEpisodeCount,
          totalEpisodeCount,
        }
  }

  if (current.status === 'completed') {
    return {
      status,
      watchedEpisodeCount: 0,
      totalEpisodeCount,
    }
  }

  return applyTvProgressChange(
    { ...current, status, totalEpisodeCount },
    current.watchedEpisodeCount,
  )
}

export function reconcileTvEpisodeTotal(
  current: TvLibraryState,
  totalEpisodeCount: number | null,
): TvLibraryState {
  const normalizedTotal = normalizeTotalEpisodeCount(totalEpisodeCount)

  if (normalizedTotal === null) {
    return {
      ...current,
      totalEpisodeCount: normalizedTotal,
    }
  }

  const watchedEpisodeCount = Math.min(
    normalizeWatchedEpisodeCount(current.watchedEpisodeCount),
    normalizedTotal,
  )

  return {
    status:
      watchedEpisodeCount === normalizedTotal
        ? 'completed'
        : current.status === 'completed'
          ? 'planned'
          : current.status,
    watchedEpisodeCount,
    totalEpisodeCount: normalizedTotal,
  }
}
