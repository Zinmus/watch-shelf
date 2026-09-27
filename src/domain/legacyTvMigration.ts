import { createTvSeasonLibraryEntryKey } from '@/data/database'

import type { LegacyTvLibraryEntry, TvSeasonLibraryEntry } from '@/types/library'
import type { TvSeasonSummary } from '@/types/tv'

export type LegacyTvMigrationFailure =
  | 'no-main-seasons'
  | 'progress-exceeds-known-total'

export type LegacyTvMigrationPlan =
  | { ok: true; entries: TvSeasonLibraryEntry[] }
  | { ok: false; reason: LegacyTvMigrationFailure }

export function getMainSeasonSummaries(seasons: TvSeasonSummary[]) {
  const seasonsByNumber = new Map<number, TvSeasonSummary>()

  for (const season of seasons) {
    const seasonNumber = Number.isFinite(season.seasonNumber)
      ? Math.trunc(season.seasonNumber)
      : 0

    if (seasonNumber > 0 && !seasonsByNumber.has(seasonNumber)) {
      seasonsByNumber.set(seasonNumber, {
        ...season,
        seasonNumber,
        episodeCount: Number.isFinite(season.episodeCount)
          ? Math.max(0, Math.trunc(season.episodeCount))
          : 0,
      })
    }
  }

  return [...seasonsByNumber.values()].sort(
    (a, b) => a.seasonNumber - b.seasonNumber,
  )
}

export function createLegacyTvMigrationPlan(
  legacyEntry: LegacyTvLibraryEntry,
  showTitle: string,
  seasons: TvSeasonSummary[],
): LegacyTvMigrationPlan {
  const mainSeasons = getMainSeasonSummaries(seasons)

  if (mainSeasons.length === 0) {
    return { ok: false, reason: 'no-main-seasons' }
  }

  const watchedEpisodeCount = Number.isFinite(legacyEntry.watchedEpisodeCount)
    ? Math.max(0, Math.trunc(legacyEntry.watchedEpisodeCount))
    : 0
  const knownTotal = mainSeasons.reduce(
    (total, season) => total + season.episodeCount,
    0,
  )

  if (watchedEpisodeCount > knownTotal) {
    return { ok: false, reason: 'progress-exceeds-known-total' }
  }

  if (watchedEpisodeCount === 0) {
    const anchorSeason = mainSeasons[0]!

    return {
      ok: true,
      entries: [
        {
          key: createTvSeasonLibraryEntryKey(
            legacyEntry.showTmdbId,
            anchorSeason.seasonNumber,
          ),
          mediaType: 'tv',
          showTmdbId: legacyEntry.showTmdbId,
          seasonNumber: anchorSeason.seasonNumber,
          showTitle,
          seasonName: anchorSeason.name || undefined,
          status: legacyEntry.status,
          watchedEpisodeCount: 0,
          addedAt: legacyEntry.addedAt,
          updatedAt: legacyEntry.updatedAt,
        },
      ],
    }
  }

  let remaining = watchedEpisodeCount
  const allocations: Array<{ season: TvSeasonSummary; watchedEpisodeCount: number }> = []

  for (const season of mainSeasons) {
    if (remaining === 0) {
      break
    }

    const allocatedCount = Math.min(remaining, season.episodeCount)

    if (allocatedCount > 0) {
      allocations.push({ season, watchedEpisodeCount: allocatedCount })
      remaining -= allocatedCount
    }
  }

  if (remaining > 0 || allocations.length === 0) {
    return { ok: false, reason: 'progress-exceeds-known-total' }
  }

  return {
    ok: true,
    entries: allocations.map(({ season, watchedEpisodeCount }, index) => ({
      key: createTvSeasonLibraryEntryKey(
        legacyEntry.showTmdbId,
        season.seasonNumber,
      ),
      mediaType: 'tv',
      showTmdbId: legacyEntry.showTmdbId,
      seasonNumber: season.seasonNumber,
      showTitle,
      seasonName: season.name || undefined,
      status:
        index < allocations.length - 1 && watchedEpisodeCount === season.episodeCount
          ? 'completed'
          : legacyEntry.status,
      watchedEpisodeCount,
      addedAt: legacyEntry.addedAt,
      updatedAt: legacyEntry.updatedAt,
    })),
  }
}
