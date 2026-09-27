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
