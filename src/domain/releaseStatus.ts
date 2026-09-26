import type { MediaType } from '@/types/media'

export type ReleaseStatus =
  | 'announced'
  | 'upcoming'
  | 'on-air'
  | 'finished'
  | 'released'
  | 'canceled'

const TV_RELEASE_STATUSES: Partial<Record<string, ReleaseStatus>> = {
  Planned: 'announced',
  'In Production': 'upcoming',
  'Returning Series': 'on-air',
  Ended: 'finished',
  Canceled: 'canceled',
}

const MOVIE_RELEASE_STATUSES: Partial<Record<string, ReleaseStatus>> = {
  Rumored: 'announced',
  Planned: 'announced',
  'In Production': 'upcoming',
  'Post Production': 'upcoming',
  Released: 'released',
  Canceled: 'canceled',
}

export function normalizeReleaseStatus(
  mediaType: MediaType,
  status: string,
): ReleaseStatus | null {
  return (mediaType === 'tv' ? TV_RELEASE_STATUSES[status] : MOVIE_RELEASE_STATUSES[status]) ?? null
}

export function getReleaseStatusLabel(status: ReleaseStatus) {
  const labels: Record<ReleaseStatus, string> = {
    announced: 'Announced',
    upcoming: 'Upcoming',
    'on-air': 'On Air',
    finished: 'Finished',
    released: 'Released',
    canceled: 'Canceled',
  }

  return labels[status]
}
