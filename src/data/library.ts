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
import {
  applyTvProgressChange,
  applyTvStatusChange,
  createTvLibraryState,
  reconcileTvEpisodeTotal,
} from '@/domain/tvLibraryState'

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
  let entry: LibraryEntry

  if (input.mediaType === 'tv') {
    const tvState = createTvLibraryState(
      status,
      watchedEpisodeCount ??
        (existingEntry?.mediaType === 'tv' ? existingEntry.watchedEpisodeCount : 0),
      input.totalEpisodeCount,
    )

    if (!tvState) {
      transaction.abort()
      await transactionComplete.catch(() => undefined)
      throw new Error('A TV title cannot be completed without a known episode total.')
    }

    entry = {
      ...sharedEntry,
      ...tvState,
      mediaType: 'tv',
    }
  } else {
    entry = {
      ...sharedEntry,
      mediaType: 'movie',
    }
  }

  store.put(entry)
  await transactionComplete

  return entry
}

async function updateTvLibraryState(
  tmdbId: number,
  transition: (entry: TvLibraryEntry) => TvLibraryEntry | null,
): Promise<TvLibraryEntry> {
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

  const nextEntry = transition(existingEntry)

  if (!nextEntry) {
    transaction.abort()
    await transactionComplete.catch(() => undefined)
    throw new Error('This TV library transition is not available.')
  }

  const entry: TvLibraryEntry = {
    ...nextEntry,
    updatedAt: new Date().toISOString(),
  }

  store.put(entry)
  await transactionComplete

  return entry
}

export function updateTvLibraryStatus(tmdbId: number, status: LibraryStatus) {
  return updateTvLibraryState(tmdbId, (entry) => {
    const nextState = applyTvStatusChange(entry, status)
    return nextState ? { ...entry, ...nextState } : null
  })
}

export function updateTvLibraryProgress(tmdbId: number, watchedEpisodeCount: number) {
  return updateTvLibraryState(tmdbId, (entry) => ({
    ...entry,
    ...applyTvProgressChange(entry, watchedEpisodeCount),
  }))
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

  const nextState = reconcileTvEpisodeTotal(existingEntry, totalEpisodeCount)

  if (
    existingEntry.status === nextState.status &&
    existingEntry.watchedEpisodeCount === nextState.watchedEpisodeCount &&
    existingEntry.totalEpisodeCount === nextState.totalEpisodeCount
  ) {
    await transactionComplete
    return existingEntry
  }

  const entry: TvLibraryEntry = {
    ...existingEntry,
    ...nextState,
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
