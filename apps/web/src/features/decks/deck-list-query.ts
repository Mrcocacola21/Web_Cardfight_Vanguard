import type { DeckListItemRecord } from '@web-vg/db/repositories/decks'
import { isSupportedDeckFormatId } from '@/features/decks/deck-format-options'

export type DeckListFormatFilter = 'all' | 'standard' | 'v-premium' | 'premium'

export interface DeckListQuery {
  readonly formatId: DeckListFormatFilter
}

export function resolveDeckListQuery(
  searchParams: Record<string, string | readonly string[] | undefined>,
): DeckListQuery {
  const formatId = normalizeSingleValue(searchParams.format)

  if (formatId && isSupportedDeckFormatId(formatId)) {
    return {
      formatId,
    }
  }

  return {
    formatId: 'all',
  }
}

export function filterDeckListItems(
  decks: readonly DeckListItemRecord[],
  query: DeckListQuery,
): readonly DeckListItemRecord[] {
  if (query.formatId === 'all') {
    return decks
  }

  return decks.filter((deck) => deck.format.id === query.formatId)
}

export function buildDeckListHref(query: DeckListQuery): string {
  if (query.formatId === 'all') {
    return '/decks'
  }

  const params = new URLSearchParams({
    format: query.formatId,
  })

  return `/decks?${params.toString()}`
}

function normalizeSingleValue(
  value: string | readonly string[] | undefined,
): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (isStringArray(value)) {
    return value[0] ?? null
  }

  return null
}
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value)
}
