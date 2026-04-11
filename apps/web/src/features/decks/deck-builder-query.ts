export interface DeckBuilderQuery {
  readonly searchText: string | null
}

export function resolveDeckBuilderQuery(
  searchParams: Record<string, string | readonly string[] | undefined>,
): DeckBuilderQuery {
  const searchText = normalizeSingleValue(searchParams.q)?.trim() ?? null

  return {
    searchText: searchText && searchText.length > 0 ? searchText : null,
  }
}

export function buildDeckBuilderHref(
  deckId: string,
  query?: Partial<DeckBuilderQuery>,
): string {
  const params = new URLSearchParams()
  const searchText = query?.searchText?.trim()

  if (searchText) {
    params.set('q', searchText)
  }

  const href = params.toString()
  const basePath = `/decks/${encodeURIComponent(deckId)}`

  return href.length > 0 ? `${basePath}?${href}` : basePath
}

function normalizeSingleValue(
  value: string | readonly string[] | undefined,
): string | null {
  if (typeof value === 'string') {
    return value
  }

  if (isReadonlyStringArray(value)) {
    const firstValue = value[0]
    return typeof firstValue === 'string' ? firstValue : null
  }

  return null
}

function isReadonlyStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'string')
  )
}
