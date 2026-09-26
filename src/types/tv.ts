export interface TvSeasonSummary {
  id: number
  name: string
  airDate: string | null
  episodeCount: number
  seasonNumber: number
}

export interface TvEpisode {
  id: number
  name: string
  overview: string
  airDate: string | null
  episodeNumber: number
  seasonNumber: number
  stillPath: string | null
}

export interface TvSeasonDetails {
  id: number
  name: string
  seasonNumber: number
  episodes: TvEpisode[]
}
