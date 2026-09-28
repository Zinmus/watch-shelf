import type { MediaType } from '@/types/media'

export const DATABASE_NAME = 'watch-shelf'
export const DATABASE_VERSION = 4
export const LIBRARY_STORE = 'library'

const LEGACY_WATCHED_EPISODES_STORE = 'watchedEpisodes'

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

      if (event.oldVersion === 1 && transaction) {
        const library = transaction.objectStore(LIBRARY_STORE)
        const cursorRequest = library.openCursor()

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result

          if (!cursor) {
            return
          }

          const entry = cursor.value as { mediaType?: string; status?: string }

          if (entry.mediaType === 'tv') {
            cursor.update({
              ...cursor.value,
              status: entry.status === 'completed' ? 'watching' : entry.status,
              watchedEpisodeCount: 0,
            })
          }

          cursor.continue()
        }
      }

      if (
        event.oldVersion === 2 &&
        transaction &&
        database.objectStoreNames.contains(LEGACY_WATCHED_EPISODES_STORE)
      ) {
        const watchedEpisodes = transaction.objectStore(LEGACY_WATCHED_EPISODES_STORE)
        const watchedRequest = watchedEpisodes.getAll()

        watchedRequest.onsuccess = () => {
          const watchedCounts = new Map<number, number>()

          for (const record of watchedRequest.result as Array<{
            showTmdbId?: number
            seasonNumber?: number
          }>) {
            if (
              typeof record.showTmdbId === 'number' &&
              typeof record.seasonNumber === 'number' &&
              record.seasonNumber > 0
            ) {
              watchedCounts.set(
                record.showTmdbId,
                (watchedCounts.get(record.showTmdbId) ?? 0) + 1,
              )
            }
          }

          const library = transaction.objectStore(LIBRARY_STORE)
          const cursorRequest = library.openCursor()

          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result

            if (!cursor) {
              database.deleteObjectStore(LEGACY_WATCHED_EPISODES_STORE)
              return
            }

            const entry = cursor.value as {
              mediaType?: string
              status?: string
              tmdbId?: number
            }

            if (entry.mediaType === 'tv' && typeof entry.tmdbId === 'number') {
              const watchedEpisodeCount = watchedCounts.get(entry.tmdbId) ?? 0

              cursor.update({
                ...cursor.value,
                status: entry.status,
                watchedEpisodeCount,
              })
            }

            cursor.continue()
          }
        }
      }

      if (event.oldVersion < 4 && transaction) {
        const library = transaction.objectStore(LIBRARY_STORE)
        const cursorRequest = library.openCursor()

        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result

          if (!cursor) {
            return
          }

          const entry = cursor.value as {
            mediaType?: string
            watchedEpisodeCount?: number
            posterPath?: unknown
            date?: unknown
          }
          const { posterPath: _posterPath, date: _date, ...persistedEntry } = entry

          cursor.update(
            entry.mediaType === 'tv'
              ? {
                  ...persistedEntry,
                  watchedEpisodeCount:
                    typeof entry.watchedEpisodeCount === 'number'
                      ? entry.watchedEpisodeCount
                      : 0,
                  totalEpisodeCount: null,
                }
              : persistedEntry,
          )
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
