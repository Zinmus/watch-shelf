import type { MediaType } from '@/types/media'

export const DEFAULT_DOCUMENT_TITLE = 'WatchShelf'

export function setDocumentTitle(title = DEFAULT_DOCUMENT_TITLE) {
  document.title = title
}

export function setMediaDocumentTitle(title: string, mediaType: MediaType) {
  const mediaLabel = mediaType === 'movie' ? 'Movie' : 'Series'

  setDocumentTitle(`${title} / ${mediaLabel}`)
}
