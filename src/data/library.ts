import type {
  LegacyTvLibraryEntry,
  LibraryEntry,
  LibraryStatus,
  MovieLibraryEntry,
  MovieLibraryEntryInput,
  MovieLibraryStatus,
  TvSeasonLibraryEntry,
  TvSeasonLibraryEntryInput,
} from '@/types/library'

import {
  createMovieLibraryEntryKey,
  createTvSeasonLibraryEntryKey,
  LEGACY_TV_LIBRARY_STORE,
  LIBRARY_SHOW_TMDB_ID_INDEX,
  LIBRARY_STORE,
  openDatabase,
  requestToPromise,
  transactionToPromise,
} from '@/data/database'

export type LegacyTvMigrationCommitResult =
  | 'migrated'
  | 'already-migrated'
  | 'stale'
  | 'conflict'

export async function getLibraryEntries(): Promise<LibraryEntry[]> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readonly')
  const request = transaction.objectStore(LIBRARY_STORE).getAll()

  return requestToPromise<LibraryEntry[]>(request)
}

export async function getMovieLibraryEntry(
  tmdbId: number,
): Promise<MovieLibraryEntry | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readonly')
  const request = transaction.objectStore(LIBRARY_STORE).get(createMovieLibraryEntryKey(tmdbId))

  return requestToPromise<MovieLibraryEntry | undefined>(request)
}

export async function getTvSeasonLibraryEntries(
  showTmdbId: number,
): Promise<TvSeasonLibraryEntry[]> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readonly')
  const request = transaction
    .objectStore(LIBRARY_STORE)
    .index(LIBRARY_SHOW_TMDB_ID_INDEX)
    .getAll(showTmdbId)

  return requestToPromise<TvSeasonLibraryEntry[]>(request)
}

export async function getLegacyTvLibraryEntry(
  showTmdbId: number,
): Promise<LegacyTvLibraryEntry | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(LEGACY_TV_LIBRARY_STORE, 'readonly')
  const request = transaction.objectStore(LEGACY_TV_LIBRARY_STORE).get(showTmdbId)

  return requestToPromise<LegacyTvLibraryEntry | undefined>(request)
}

export async function getLegacyTvLibraryEntries(): Promise<LegacyTvLibraryEntry[]> {
  const database = await openDatabase()
  const transaction = database.transaction(LEGACY_TV_LIBRARY_STORE, 'readonly')
  const request = transaction.objectStore(LEGACY_TV_LIBRARY_STORE).getAll()

  return requestToPromise<LegacyTvLibraryEntry[]>(request)
}

export async function saveMovieLibraryEntry(
  input: MovieLibraryEntryInput,
  status: MovieLibraryStatus,
): Promise<MovieLibraryEntry> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)
  const store = transaction.objectStore(LIBRARY_STORE)
  const key = createMovieLibraryEntryKey(input.tmdbId)
  const existingEntry = await requestToPromise<MovieLibraryEntry | undefined>(store.get(key))
  const now = new Date().toISOString()
  const entry: MovieLibraryEntry = {
    ...input,
    key,
    mediaType: 'movie',
    status,
    addedAt: existingEntry?.addedAt ?? now,
    updatedAt: now,
  }

  store.put(entry)
  await transactionComplete

  return entry
}

function normalizeStoredEpisodeCount(watchedEpisodeCount: number) {
  return Number.isFinite(watchedEpisodeCount)
    ? Math.max(0, Math.trunc(watchedEpisodeCount))
    : 0
}

export async function saveTvSeasonLibraryEntry(
  input: TvSeasonLibraryEntryInput,
  status: LibraryStatus,
  watchedEpisodeCount: number,
): Promise<TvSeasonLibraryEntry> {
  if (input.seasonNumber <= 0) {
    throw new Error('Only main TV seasons can be saved to the library.')
  }

  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)
  const store = transaction.objectStore(LIBRARY_STORE)
  const key = createTvSeasonLibraryEntryKey(input.showTmdbId, input.seasonNumber)
  const existingEntry = await requestToPromise<TvSeasonLibraryEntry | undefined>(store.get(key))
  const now = new Date().toISOString()
  const entry: TvSeasonLibraryEntry = {
    ...input,
    key,
    mediaType: 'tv',
    status,
    watchedEpisodeCount: normalizeStoredEpisodeCount(watchedEpisodeCount),
    addedAt: existingEntry?.addedAt ?? now,
    updatedAt: now,
  }

  store.put(entry)
  await transactionComplete

  return entry
}

export async function removeMovieLibraryEntry(tmdbId: number): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)

  transaction.objectStore(LIBRARY_STORE).delete(createMovieLibraryEntryKey(tmdbId))
  await transactionComplete
}

export async function removeTvSeasonLibraryEntry(
  showTmdbId: number,
  seasonNumber: number,
): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)

  transaction
    .objectStore(LIBRARY_STORE)
    .delete(createTvSeasonLibraryEntryKey(showTmdbId, seasonNumber))
  await transactionComplete
}

export async function commitLegacyTvMigration(
  expectedLegacyEntry: LegacyTvLibraryEntry,
  targetEntries: TvSeasonLibraryEntry[],
): Promise<LegacyTvMigrationCommitResult> {
  const database = await openDatabase()
  const transaction = database.transaction(
    [LIBRARY_STORE, LEGACY_TV_LIBRARY_STORE],
    'readwrite',
  )
  const transactionComplete = transactionToPromise(transaction)
  const library = transaction.objectStore(LIBRARY_STORE)
  const legacyLibrary = transaction.objectStore(LEGACY_TV_LIBRARY_STORE)
  const legacyRequest = legacyLibrary.get(expectedLegacyEntry.showTmdbId)
  const targetRequests = targetEntries.map((entry) => library.get(entry.key))
  const [currentLegacyEntry, existingTargets] = await Promise.all([
    requestToPromise<LegacyTvLibraryEntry | undefined>(legacyRequest),
    Promise.all(
      targetRequests.map((request) =>
        requestToPromise<TvSeasonLibraryEntry | undefined>(request),
      ),
    ),
  ])

  if (!currentLegacyEntry) {
    await transactionComplete
    return 'already-migrated'
  }

  if (
    currentLegacyEntry.updatedAt !== expectedLegacyEntry.updatedAt ||
    currentLegacyEntry.status !== expectedLegacyEntry.status ||
    currentLegacyEntry.watchedEpisodeCount !== expectedLegacyEntry.watchedEpisodeCount
  ) {
    await transactionComplete
    return 'stale'
  }

  if (existingTargets.some(Boolean)) {
    await transactionComplete
    return 'conflict'
  }

  targetEntries.forEach((entry) => library.add(entry))
  legacyLibrary.delete(expectedLegacyEntry.showTmdbId)
  await transactionComplete

  return 'migrated'
}
