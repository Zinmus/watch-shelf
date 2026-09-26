import type { MediaType } from '@/types/media'

export type LibraryStatus = 'planned' | 'watching' | 'completed'

export interface LibraryEntry {
  key: string
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  date: string
  status: LibraryStatus
  addedAt: string
  updatedAt: string
}

export type LibraryEntryInput = Pick<
  LibraryEntry,
  'tmdbId' | 'mediaType' | 'title' | 'posterPath' | 'date'
>
