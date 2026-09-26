import type { LibraryEntry, LibraryEntryInput, LibraryStatus } from '@/types/library'
import type { MediaType } from '@/types/media'

import {
  createLibraryEntryKey,
  LIBRARY_STORE,
  openDatabase,
  requestToPromise,
  transactionToPromise,
  WATCHED_EPISODES_SHOW_INDEX,
  WATCHED_EPISODES_STORE,
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
    addedAt: existingEntry?.addedAt ?? now,
    updatedAt: now,
  }

  store.put(entry)
  await transactionComplete

  return entry
}

export async function removeLibraryEntry(mediaType: MediaType, tmdbId: number): Promise<void> {
  const database = await openDatabase()
  const storeNames =
    mediaType === 'tv' ? [LIBRARY_STORE, WATCHED_EPISODES_STORE] : [LIBRARY_STORE]
  const transaction = database.transaction(storeNames, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)

  transaction.objectStore(LIBRARY_STORE).delete(createLibraryEntryKey(mediaType, tmdbId))

  if (mediaType === 'tv') {
    const watchedEpisodes = transaction.objectStore(WATCHED_EPISODES_STORE)
    const watchedKeys = await requestToPromise(
      watchedEpisodes.index(WATCHED_EPISODES_SHOW_INDEX).getAllKeys(tmdbId),
    )

    watchedKeys.forEach((key) => watchedEpisodes.delete(key))
  }

  await transactionComplete
}
