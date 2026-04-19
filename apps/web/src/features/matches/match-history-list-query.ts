import { isSupportedDeckFormatId } from '@/features/decks/deck-format-options'

export type MatchHistoryResultFilter = 'all' | 'win' | 'loss' | 'draw'
export type MatchHistoryFormatFilter =
  | 'all'
  | 'standard'
  | 'v-premium'
  | 'premium'

export interface MatchHistoryListQuery {
  readonly result: MatchHistoryResultFilter
  readonly deckId: string | null
  readonly opponent: string
  readonly formatId: MatchHistoryFormatFilter
  readonly playedFrom: string | null
  readonly playedTo: string | null
}

const matchHistoryOpponentMaxLength = 64
const matchHistoryResultFilters = new Set<string>([
  'all',
  'win',
  'loss',
  'draw',
])

export function resolveMatchHistoryListQuery(
  searchParams: Record<string, string | readonly string[] | undefined>,
): MatchHistoryListQuery {
  const result = normalizeSingleValue(searchParams.result)
  const deckId = normalizeIdentifier(searchParams.deck)
  const opponent = normalizeOpponentQuery(searchParams.opponent)
  const formatId = normalizeSingleValue(searchParams.format)
  const playedFrom = normalizeDateInput(searchParams.from)
  const playedTo = normalizeDateInput(searchParams.to)

  return {
    result: isMatchHistoryResultFilter(result) ? result : 'all',
    deckId,
    opponent,
    formatId:
      typeof formatId === 'string' && isSupportedDeckFormatId(formatId)
        ? formatId
        : 'all',
    playedFrom,
    playedTo,
  }
}

export function hasActiveMatchHistoryListFilters(
  query: MatchHistoryListQuery,
): boolean {
  return (
    query.result !== 'all' ||
    query.deckId !== null ||
    query.opponent.length > 0 ||
    query.formatId !== 'all' ||
    query.playedFrom !== null ||
    query.playedTo !== null
  )
}

export function buildMatchHistoryListHref(
  query: MatchHistoryListQuery,
): string {
  const params = new URLSearchParams()

  if (query.result !== 'all') {
    params.set('result', query.result)
  }

  if (query.deckId) {
    params.set('deck', query.deckId)
  }

  if (query.opponent.length > 0) {
    params.set('opponent', query.opponent)
  }

  if (query.formatId !== 'all') {
    params.set('format', query.formatId)
  }

  if (query.playedFrom) {
    params.set('from', query.playedFrom)
  }

  if (query.playedTo) {
    params.set('to', query.playedTo)
  }

  const search = params.toString()

  return search.length > 0 ? `/matches?${search}` : '/matches'
}

function normalizeSingleValue(
  value: string | readonly string[] | undefined,
): string | null {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0].trim() : null
  }

  return null
}

function normalizeIdentifier(
  value: string | readonly string[] | undefined,
): string | null {
  const normalized = normalizeSingleValue(value)

  return normalized && normalized.length > 0 ? normalized : null
}

function normalizeOpponentQuery(
  value: string | readonly string[] | undefined,
): string {
  const normalized = normalizeSingleValue(value)

  if (!normalized) {
    return ''
  }

  return normalized
    .replace(/\s+/gu, ' ')
    .slice(0, matchHistoryOpponentMaxLength)
    .trim()
}

function normalizeDateInput(
  value: string | readonly string[] | undefined,
): string | null {
  const normalized = normalizeSingleValue(value)

  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    return null
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10) === normalized ? normalized : null
}

function isMatchHistoryResultFilter(
  value: string | null,
): value is MatchHistoryResultFilter {
  return typeof value === 'string' && matchHistoryResultFilters.has(value)
}
