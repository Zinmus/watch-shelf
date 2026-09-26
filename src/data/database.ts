import type { MediaType } from '@/types/media'

export const DATABASE_NAME = 'watch-shelf'
export const DATABASE_VERSION = 2
export const LIBRARY_STORE = 'library'
export const WATCHED_EPISODES_STORE = 'watchedEpisodes'
export const WATCHED_EPISODES_SHOW_INDEX = 'showTmdbId'

let databasePromise: Promise<IDBDatabase> | null = null

export function createLibraryEntryKey(mediaType: MediaType, tmdbId: number) {
  return `${mediaType}:${tmdbId}`
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

export function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
  })
}

export function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = (event) => {
      const database = request.result
      const transaction = request.transaction

      if (!database.objectStoreNames.contains(LIBRARY_STORE)) {
        database.createObjectStore(LIBRARY_STORE, { keyPath: 'key' })
      }

      if (!database.objectStoreNames.contains(WATCHED_EPISODES_STORE)) {
        const watchedEpisodes = database.createObjectStore(WATCHED_EPISODES_STORE, {
          keyPath: ['showTmdbId', 'seasonNumber', 'episodeNumber'],
        })
        watchedEpisodes.createIndex(WATCHED_EPISODES_SHOW_INDEX, 'showTmdbId')
      }

      if (event.oldVersion === 1 && transaction) {
        const library = transaction.objectStore(LIBRARY_STORE)
        const cursorRequest = library.openCursor()

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result

          if (!cursor) {
            return
          }

          const entry = cursor.value as { mediaType?: string; status?: string }

          if (entry.mediaType === 'tv' && entry.status === 'completed') {
            cursor.update({ ...cursor.value, status: 'watching' })
          }

          cursor.continue()
        }
      }
    }

    request.onsuccess = () => {
      const database = request.result

      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }

    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('Failed to open the library database.'))
    }
  })

  return databasePromise
}
