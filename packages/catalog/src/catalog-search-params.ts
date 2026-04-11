import {
  defaultCatalogPage,
  defaultCatalogPageSize,
  defaultCatalogPerspective,
  getDefaultCatalogSort,
  normalizeCatalogQuery,
  type CatalogQuery,
  type CatalogQueryInput,
} from './catalog-query'

export type CatalogSearchParamsInput =
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | undefined>>

const filterParamEntries = [
  ['format', 'formatIds'],
  ['era', 'eras'],
  ['nation', 'nations'],
  ['clan', 'clans'],
  ['type', 'cardTypes'],
  ['trigger', 'triggerTypes'],
  ['rarity', 'rarities'],
  ['set', 'productKeys'],
] as const satisfies readonly (readonly [
  string,
  keyof CatalogQuery['filters'],
])[]

export function parseCatalogSearchParams(
  input: CatalogSearchParamsInput,
): CatalogQuery {
  const rawPage = getSingleParamValue(input, 'page')
  const rawPageSize = getSingleParamValue(input, 'pageSize')
  const searchText = getSingleParamValue(input, 'q')
  const perspective = getSingleParamValue(input, 'perspective')
  const sort = getSingleParamValue(input, 'sort')
  const window: CatalogQueryInput['window'] = {}

  if (rawPage) {
    window.page = Number.parseInt(rawPage, 10)
  }

  if (rawPageSize) {
    window.pageSize = Number.parseInt(rawPageSize, 10)
  }

  return normalizeCatalogQuery({
    ...(searchText !== undefined ? { searchText } : {}),
    ...(perspective !== undefined ? { perspective } : {}),
    ...(sort !== undefined ? { sort } : {}),
    filters: {
      formatIds: getMultiParamValues(input, 'format'),
      eras: getMultiParamValues(input, 'era'),
      nations: getMultiParamValues(input, 'nation'),
      clans: getMultiParamValues(input, 'clan'),
      cardTypes: getMultiParamValues(input, 'type'),
      triggerTypes: getMultiParamValues(input, 'trigger'),
      rarities: getMultiParamValues(input, 'rarity'),
      productKeys: getMultiParamValues(input, ['set', 'product']),
    },
    window,
  })
}

export function catalogQueryToSearchParams(
  query: CatalogQuery,
): URLSearchParams {
  const params = new URLSearchParams()
  const defaultSort = getDefaultCatalogSort(query.perspective, query.searchText)

  if (query.searchText) {
    params.set('q', query.searchText)
  }

  if (query.perspective !== defaultCatalogPerspective) {
    params.set('perspective', query.perspective)
  }

  if (query.sort !== defaultSort) {
    params.set('sort', query.sort)
  }

  if (query.window.page !== defaultCatalogPage) {
    params.set('page', String(query.window.page))
  }

  if (query.window.pageSize !== defaultCatalogPageSize) {
    params.set('pageSize', String(query.window.pageSize))
  }

  for (const [param, filterKey] of filterParamEntries) {
    for (const value of query.filters[filterKey]) {
      params.append(param, value)
    }
  }

  params.sort()

  return params
}

function getSingleParamValue(
  input: CatalogSearchParamsInput,
  key: string,
): string | undefined {
  const values = getMultiParamValues(input, key)

  return values[0]
}

function getMultiParamValues(
  input: CatalogSearchParamsInput,
  key: string | readonly string[],
): readonly string[] {
  const keys: readonly string[] = typeof key === 'string' ? [key] : key
  const values = new Set<string>()

  for (const currentKey of keys) {
    const rawValues =
      input instanceof URLSearchParams
        ? input.getAll(currentKey)
        : readRecordParamValue(input[currentKey])

    for (const value of rawValues) {
      for (const part of value.split(',')) {
        const normalized = part.trim()

        if (normalized.length > 0) {
          values.add(normalized)
        }
      }
    }
  }

  return Array.from(values)
}

function readRecordParamValue(
  value: string | readonly string[] | undefined,
): readonly string[] {
  if (value === undefined) {
    return []
  }

  if (typeof value === 'string') {
    return [value]
  }

  return isStringArray(value) ? value : []
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
