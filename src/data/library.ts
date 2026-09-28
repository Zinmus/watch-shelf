import type {
  LibraryEntry,
  LibraryEntryInput,
  LibraryStatus,
  TvLibraryEntry,
} from '@/types/library'
import type { MediaType } from '@/types/media'

import {
  createLibraryEntryKey,
  LIBRARY_STORE,
  openDatabase,
  requestToPromise,
  transactionToPromise,
} from '@/data/database'

export async function getLibraryEntry(
  mediaType: MediaType,
  tmdbId: number,
): Promise<LibraryEntry | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readonly')
  const request = transaction
    .objectStore(LIBRARY_STORE)
    .get(createLibraryEntryKey(mediaType, tmdbId))

  return requestToPromise<LibraryEntry | undefined>(request)
}

export async function getLibraryEntries(): Promise<LibraryEntry[]> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readonly')
  const request = transaction.objectStore(LIBRARY_STORE).getAll()

  return requestToPromise<LibraryEntry[]>(request)
}

export async function saveLibraryEntry(
  input: LibraryEntryInput,
  status: LibraryStatus,
  watchedEpisodeCount?: number,
): Promise<LibraryEntry> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)
  const store = transaction.objectStore(LIBRARY_STORE)
  const key = createLibraryEntryKey(input.mediaType, input.tmdbId)
  const existingEntry = await requestToPromise<LibraryEntry | undefined>(store.get(key))
  const now = new Date().toISOString()
  const sharedEntry = {
    key,
    tmdbId: input.tmdbId,
    title: input.title,
    status,
    addedAt: existingEntry?.addedAt ?? now,
    updatedAt: now,
  }
  const entry: LibraryEntry =
    input.mediaType === 'tv'
      ? {
          ...sharedEntry,
          mediaType: 'tv',
          watchedEpisodeCount: clampStoredEpisodeCount(
            watchedEpisodeCount ??
              (existingEntry?.mediaType === 'tv' ? existingEntry.watchedEpisodeCount : 0),
          ),
          totalEpisodeCount: normalizeTotalEpisodeCount(input.totalEpisodeCount),
        }
      : {
          ...sharedEntry,
          mediaType: 'movie',
        }

  store.put(entry)
  await transactionComplete

  return entry
}

function clampStoredEpisodeCount(watchedEpisodeCount: number) {
  return Number.isFinite(watchedEpisodeCount)
    ? Math.max(0, Math.trunc(watchedEpisodeCount))
    : 0
}

function normalizeTotalEpisodeCount(totalEpisodeCount: number) {
  return Number.isFinite(totalEpisodeCount)
    ? Math.max(0, Math.trunc(totalEpisodeCount))
    : 0
}

export async function updateTvLibraryState(
  tmdbId: number,
  status: LibraryStatus,
  watchedEpisodeCount: number,
): Promise<LibraryEntry> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)
  const store = transaction.objectStore(LIBRARY_STORE)
  const key = createLibraryEntryKey('tv', tmdbId)
  const existingEntry = await requestToPromise<LibraryEntry | undefined>(store.get(key))

  if (!existingEntry || existingEntry.mediaType !== 'tv') {
    transaction.abort()
    await transactionComplete.catch(() => undefined)
    throw new Error('TV library entry not found.')
  }

  const normalizedCount = clampStoredEpisodeCount(watchedEpisodeCount)
  const entry: LibraryEntry = {
    ...existingEntry,
    status,
    watchedEpisodeCount: normalizedCount,
    updatedAt: new Date().toISOString(),
  }

  store.put(entry)
  await transactionComplete

  return entry
}

export async function refreshTvLibraryMetadata(
  tmdbId: number,
  totalEpisodeCount: number,
): Promise<TvLibraryEntry | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)
  const store = transaction.objectStore(LIBRARY_STORE)
  const key = createLibraryEntryKey('tv', tmdbId)
  const existingEntry = await requestToPromise<LibraryEntry | undefined>(store.get(key))

  if (!existingEntry || existingEntry.mediaType !== 'tv') {
    await transactionComplete
    return undefined
  }

  const normalizedTotal = normalizeTotalEpisodeCount(totalEpisodeCount)

  if (existingEntry.totalEpisodeCount === normalizedTotal) {
    await transactionComplete
    return existingEntry
  }

  const entry: TvLibraryEntry = {
    ...existingEntry,
    totalEpisodeCount: normalizedTotal,
  }

  store.put(entry)
  await transactionComplete

  return entry
}

export async function removeLibraryEntry(mediaType: MediaType, tmdbId: number): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)

  transaction.objectStore(LIBRARY_STORE).delete(createLibraryEntryKey(mediaType, tmdbId))

  await transactionComplete
}
