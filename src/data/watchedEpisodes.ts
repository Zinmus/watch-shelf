import {
  createLibraryEntryKey,
  LIBRARY_STORE,
  openDatabase,
  requestToPromise,
  transactionToPromise,
  WATCHED_EPISODES_SHOW_INDEX,
  WATCHED_EPISODES_STORE,
} from '@/data/database'

import type { WatchedEpisode, WatchedEpisodeKey } from '@/types/episodes'
import type { LibraryEntry } from '@/types/library'

export async function getWatchedEpisodes(showTmdbId: number): Promise<WatchedEpisode[]> {
  const database = await openDatabase()
  const transaction = database.transaction(WATCHED_EPISODES_STORE, 'readonly')
  const request = transaction
    .objectStore(WATCHED_EPISODES_STORE)
    .index(WATCHED_EPISODES_SHOW_INDEX)
    .getAll(showTmdbId)

  return requestToPromise<WatchedEpisode[]>(request)
}

export async function getAllWatchedEpisodes(): Promise<WatchedEpisode[]> {
  const database = await openDatabase()
  const transaction = database.transaction(WATCHED_EPISODES_STORE, 'readonly')
  const request = transaction.objectStore(WATCHED_EPISODES_STORE).getAll()

  return requestToPromise<WatchedEpisode[]>(request)
}

export async function setEpisodeWatched(
  episode: WatchedEpisode,
  watched: boolean,
  downgradeCompletedShow = false,
): Promise<LibraryEntry | undefined> {
  const database = await openDatabase()
  const storeNames = downgradeCompletedShow
    ? [WATCHED_EPISODES_STORE, LIBRARY_STORE]
    : [WATCHED_EPISODES_STORE]
  const transaction = database.transaction(storeNames, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)
  const watchedEpisodes = transaction.objectStore(WATCHED_EPISODES_STORE)
  const key: WatchedEpisodeKey = [
    episode.showTmdbId,
    episode.seasonNumber,
    episode.episodeNumber,
  ]

  if (watched) {
    watchedEpisodes.put(episode)
  } else {
    watchedEpisodes.delete(key)
  }

  let updatedLibraryEntry: LibraryEntry | undefined

  if (!watched && downgradeCompletedShow) {
    const library = transaction.objectStore(LIBRARY_STORE)
    const libraryKey = createLibraryEntryKey('tv', episode.showTmdbId)
    const entry = await requestToPromise<LibraryEntry | undefined>(library.get(libraryKey))

    if (entry?.status === 'completed') {
      updatedLibraryEntry = {
        ...entry,
        status: 'watching',
        updatedAt: new Date().toISOString(),
      }
      library.put(updatedLibraryEntry)
    }
  }

  await transactionComplete
  return updatedLibraryEntry
}
