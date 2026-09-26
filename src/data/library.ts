import type { LibraryEntry, LibraryEntryInput, LibraryStatus } from '@/types/library'
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
): Promise<LibraryEntry> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)
  const store = transaction.objectStore(LIBRARY_STORE)
  const key = createLibraryEntryKey(input.mediaType, input.tmdbId)
  const existingEntry = await requestToPromise<LibraryEntry | undefined>(store.get(key))
  const now = new Date().toISOString()
  const entry: LibraryEntry = {
    ...input,
    key,
    status,
    ...(input.mediaType === 'tv'
      ? {
          watchedEpisodeCount:
            status === 'planned' ? 0 : (existingEntry?.watchedEpisodeCount ?? 0),
        }
      : {}),
    addedAt: existingEntry?.addedAt ?? now,
    updatedAt: now,
  }

  store.put(entry)
  await transactionComplete

  return entry
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

  const normalizedCount = Number.isFinite(watchedEpisodeCount)
    ? Math.max(0, Math.trunc(watchedEpisodeCount))
    : 0
  const entry: LibraryEntry = {
    ...existingEntry,
    status,
    watchedEpisodeCount: status === 'planned' ? 0 : normalizedCount,
    updatedAt: new Date().toISOString(),
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
