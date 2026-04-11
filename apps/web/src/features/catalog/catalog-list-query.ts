import {
  catalogQueryToSearchParams,
  getDefaultCatalogSort,
  hasActiveCatalogFilters,
  normalizeCatalogQuery,
  parseCatalogSearchParams,
  type CatalogQuery,
  type CatalogSearchParamsInput,
} from '@web-vg/catalog'

export function resolveCatalogCardListQuery(
  input: CatalogSearchParamsInput,
): CatalogQuery {
  const parsedQuery = parseCatalogSearchParams(input)

  return normalizeCatalogCardListRouteQuery(parsedQuery)
}

export function buildCatalogCardListHref(query: CatalogQuery): string {
  const params = catalogQueryToSearchParams(
    normalizeCatalogCardListRouteQuery(query),
  )
  const href = params.toString()

  return href.length > 0 ? `/catalog?${href}` : '/catalog'
}

export function hasActiveCatalogCardListQuery(query: CatalogQuery): boolean {
  return (
    query.searchText !== null ||
    hasActiveCatalogFilters(query.filters) ||
    query.sort !== getDefaultCatalogSort('card-entity', query.searchText)
  )
}

function normalizeCatalogCardListRouteQuery(query: CatalogQuery): CatalogQuery {
  return normalizeCatalogQuery({
    ...query,
    perspective: 'card-entity',
    sort: query.sort === 'release-date-desc' ? null : query.sort,
  })
}
