export type CollectionViewMode = 'binder' | 'list'
export type CollectionSortMode = 'recent' | 'name' | 'product' | 'quantity'

export interface CollectionPageQuery {
  readonly view: CollectionViewMode
  readonly sort: CollectionSortMode
}

export const collectionSortOptions = [
  {
    value: 'recent',
    label: 'Recently updated',
  },
  {
    value: 'name',
    label: 'Card name',
  },
  {
    value: 'product',
    label: 'Release / set',
  },
  {
    value: 'quantity',
    label: 'Quantity',
  },
] as const

const collectionViewModes = new Set<CollectionViewMode>(['binder', 'list'])
const collectionSortModes = new Set<CollectionSortMode>([
  'recent',
  'name',
  'product',
  'quantity',
])

export function resolveCollectionPageQuery(
  searchParams: Record<string, string | readonly string[] | undefined>,
): CollectionPageQuery {
  const view = normalizeSingleValue(searchParams.view)
  const sort = normalizeSingleValue(searchParams.sort)

  return {
    view: isCollectionViewMode(view) ? view : 'binder',
    sort: isCollectionSortMode(sort) ? sort : 'recent',
  }
}

export function buildCollectionPageHref(query: CollectionPageQuery): string {
  const params = new URLSearchParams()

  if (query.view !== 'binder') {
    params.set('view', query.view)
  }

  if (query.sort !== 'recent') {
    params.set('sort', query.sort)
  }

  const search = params.toString()

  return search.length > 0 ? `/collection?${search}` : '/collection'
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

function isCollectionViewMode(
  value: string | null,
): value is CollectionViewMode {
  return typeof value === 'string' && collectionViewModes.has(value as never)
}

function isCollectionSortMode(
  value: string | null,
): value is CollectionSortMode {
  return typeof value === 'string' && collectionSortModes.has(value as never)
}
