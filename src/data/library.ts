import type { LibraryEntry, LibraryEntryInput, LibraryStatus } from '@/types/library'
import type { MediaType } from '@/types/media'

const DATABASE_NAME = 'watch-shelf'
const DATABASE_VERSION = 1
const LIBRARY_STORE = 'library'

let databasePromise: Promise<IDBDatabase> | null = null

function createEntryKey(mediaType: MediaType, tmdbId: number) {
  return `${mediaType}:${tmdbId}`
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(LIBRARY_STORE)) {
        database.createObjectStore(LIBRARY_STORE, { keyPath: 'key' })
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

export async function getLibraryEntry(
  mediaType: MediaType,
  tmdbId: number,
): Promise<LibraryEntry | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(LIBRARY_STORE, 'readonly')
  const request = transaction.objectStore(LIBRARY_STORE).get(createEntryKey(mediaType, tmdbId))

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
  const key = createEntryKey(input.mediaType, input.tmdbId)
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
  const transaction = database.transaction(LIBRARY_STORE, 'readwrite')
  const transactionComplete = transactionToPromise(transaction)

  transaction.objectStore(LIBRARY_STORE).delete(createEntryKey(mediaType, tmdbId))
  await transactionComplete
}
