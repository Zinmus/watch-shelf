export const DATABASE_NAME = 'watch-shelf'
export const DATABASE_VERSION = 4
export const LIBRARY_STORE = 'library'
export const LEGACY_TV_LIBRARY_STORE = 'legacyTvLibrary'
export const LIBRARY_SHOW_TMDB_ID_INDEX = 'showTmdbId'

const LEGACY_WATCHED_EPISODES_STORE = 'watchedEpisodes'

let databasePromise: Promise<IDBDatabase> | null = null

export function createMovieLibraryEntryKey(tmdbId: number) {
  return `movie:${tmdbId}`
}

export function createTvSeasonLibraryEntryKey(showTmdbId: number, seasonNumber: number) {
  return `tv:${showTmdbId}:season:${seasonNumber}`
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

function normalizeStoredCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0
}

function stageLegacyTvEntries(
  database: IDBDatabase,
  transaction: IDBTransaction,
  watchedCounts: Map<number, number>,
  watchedShowIds: Set<number>,
) {
  const library = transaction.objectStore(LIBRARY_STORE)
  const legacyLibrary = transaction.objectStore(LEGACY_TV_LIBRARY_STORE)
  const stagedShowIds = new Set<number>()
  const cursorRequest = library.openCursor()

  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result

    if (!cursor) {
      const allWatchedShowsWereStaged = [...watchedShowIds].every((showTmdbId) =>
        stagedShowIds.has(showTmdbId),
      )

      if (
        allWatchedShowsWereStaged &&
        database.objectStoreNames.contains(LEGACY_WATCHED_EPISODES_STORE)
      ) {
        database.deleteObjectStore(LEGACY_WATCHED_EPISODES_STORE)
      }

      return
    }

    const entry = cursor.value as Record<string, unknown>
    const showTmdbId = entry.tmdbId
    const isShowLevelTvEntry =
      entry.mediaType === 'tv' &&
      typeof showTmdbId === 'number' &&
      typeof entry.seasonNumber !== 'number'

    if (isShowLevelTvEntry) {
      const now = new Date().toISOString()
      const watchedEpisodeCount = watchedCounts.has(showTmdbId)
        ? (watchedCounts.get(showTmdbId) ?? 0)
        : normalizeStoredCount(entry.watchedEpisodeCount)

      legacyLibrary.put({
        showTmdbId,
        showTitle: typeof entry.title === 'string' ? entry.title : `TV show ${showTmdbId}`,
        posterPath: typeof entry.posterPath === 'string' ? entry.posterPath : null,
        date: typeof entry.date === 'string' ? entry.date : '',
        status:
          entry.status === 'watching' || entry.status === 'completed'
            ? entry.status
            : 'planned',
        watchedEpisodeCount,
        addedAt: typeof entry.addedAt === 'string' ? entry.addedAt : now,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : now,
      })

      stagedShowIds.add(showTmdbId)
      cursor.delete()
    }

    cursor.continue()
  }
}

function upgradeDatabase(database: IDBDatabase, transaction: IDBTransaction) {
  const library = database.objectStoreNames.contains(LIBRARY_STORE)
    ? transaction.objectStore(LIBRARY_STORE)
    : database.createObjectStore(LIBRARY_STORE, { keyPath: 'key' })

  if (!library.indexNames.contains(LIBRARY_SHOW_TMDB_ID_INDEX)) {
    library.createIndex(LIBRARY_SHOW_TMDB_ID_INDEX, 'showTmdbId')
  }

  if (!database.objectStoreNames.contains(LEGACY_TV_LIBRARY_STORE)) {
    database.createObjectStore(LEGACY_TV_LIBRARY_STORE, { keyPath: 'showTmdbId' })
  }

  if (!database.objectStoreNames.contains(LEGACY_WATCHED_EPISODES_STORE)) {
    stageLegacyTvEntries(database, transaction, new Map(), new Set())
    return
  }

  const watchedRequest = transaction.objectStore(LEGACY_WATCHED_EPISODES_STORE).getAll()

  watchedRequest.onsuccess = () => {
    const watchedCounts = new Map<number, number>()
    const watchedShowIds = new Set<number>()

    for (const record of watchedRequest.result as Array<{
      showTmdbId?: number
      seasonNumber?: number
    }>) {
      if (
        typeof record.showTmdbId === 'number' &&
        typeof record.seasonNumber === 'number' &&
        record.seasonNumber > 0
      ) {
        watchedShowIds.add(record.showTmdbId)
        watchedCounts.set(
          record.showTmdbId,
          (watchedCounts.get(record.showTmdbId) ?? 0) + 1,
        )
      }
    }

    stageLegacyTvEntries(database, transaction, watchedCounts, watchedShowIds)
  }
}

export function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const transaction = request.transaction

      if (transaction) {
        upgradeDatabase(request.result, transaction)
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
