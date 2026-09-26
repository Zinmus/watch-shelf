export interface WatchedEpisode {
  showTmdbId: number
  seasonNumber: number
  episodeNumber: number
}

export type WatchedEpisodeKey = [
  showTmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
]
