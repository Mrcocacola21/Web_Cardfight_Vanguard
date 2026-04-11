import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import {
  areCatalogQueriesEquivalent,
  catalogEraFilterProfiles,
  catalogFormatFilterProfiles,
  createEmptyCatalogFilters,
  getCatalogWindowOffset,
  getCatalogEraFilterProfile,
  getCatalogActiveFormatFilterProfile,
  getCatalogApplicableFilterKeys,
  normalizeCatalogPerspective,
  normalizeCatalogQuery,
  normalizeCatalogSort,
  resolveCatalogEraProductLineages,
  shouldResetCatalogPagination,
  type CatalogFacetResult,
} from './catalog-query'
import type { FormatId, Nation } from '@web-vg/shared'
import type { CatalogEraKey } from './catalog-identifiers'

describe('@web-vg/catalog query model', () => {
  it('builds a stable default query model', () => {
    const query = normalizeCatalogQuery()

    expect(query.searchText).toBeNull()
    expect(query.perspective).toBe('card-entity')
    expect(query.sort).toBe('name-asc')
    expect(query.window).toEqual({
      page: 1,
      pageSize: 24,
    })
    expect(query.filters).toEqual(createEmptyCatalogFilters())
  })

  it('keeps printing perspective defaults distinct from canonical entity browsing', () => {
    const query = normalizeCatalogQuery({
      perspective: 'card-printing',
    })

    expect(query.perspective).toBe('card-printing')
    expect(query.sort).toBe('release-date-desc')
    expect(query.filters).toEqual(createEmptyCatalogFilters())
  })

  it('normalizes search text, filters, sorting, and paging', () => {
    const query = normalizeCatalogQuery({
      searchText: '  Azure   Vanguard  ',
      perspective: 'card-printing',
      sort: 'relevance',
      window: {
        page: -4,
        pageSize: 200,
      },
      filters: {
        formatIds: ['standard', 'standard', 'premium'],
        eras: [' D ', 'v'],
        nations: ['Dragon Empire', 'dragon empire', 'Dark States'],
        clans: ['kagero', '  '],
        cardTypes: ['normal-unit', 'invalid', 'trigger-unit'],
        triggerTypes: ['draw', 'heal', 'other'],
        rarities: ['RRR', 'rrr', 'SP'],
        productKeys: [' product.d-bt01.azure ', 'product.d-bt01.azure'],
      },
    })

    expect(query.searchText).toBe('Azure Vanguard')
    expect(query.perspective).toBe('card-printing')
    expect(query.sort).toBe('relevance')
    expect(query.window).toEqual({
      page: 1,
      pageSize: 96,
    })
    expect(query.filters).toEqual({
      formatIds: ['premium', 'standard'],
      eras: ['d', 'v'],
      nations: ['dark states', 'dragon empire'],
      clans: ['kagero'],
      cardTypes: ['normal-unit', 'trigger-unit'],
      triggerTypes: ['draw', 'heal'],
      rarities: ['rrr', 'sp'],
      productKeys: ['product.d-bt01.azure'],
    })
  })

  it('applies format-aware filter behavior when a single format owns the identity axis', () => {
    const standardQuery = normalizeCatalogQuery({
      filters: {
        formatIds: ['standard'],
        nations: ['Dragon Empire'],
        clans: ['royal paladin'],
      },
    })
    const premiumQuery = normalizeCatalogQuery({
      filters: {
        formatIds: ['premium'],
        nations: ['Dragon Empire'],
        clans: ['royal paladin'],
      },
    })

    expect(standardQuery.filters.nations).toEqual(['dragon empire'])
    expect(standardQuery.filters.clans).toEqual([])
    expect(premiumQuery.filters.nations).toEqual([])
    expect(premiumQuery.filters.clans).toEqual(['royal paladin'])
  })

  it('keeps format filtering metadata explicit and query-safe', () => {
    expect(catalogFormatFilterProfiles.map((profile) => profile.id)).toEqual([
      'standard',
      'v-premium',
      'premium',
    ])
    expect(
      getCatalogActiveFormatFilterProfile(['standard' as FormatId]),
    )?.toMatchObject({
      preferredIdentityFilter: 'nation',
    })
    expect(getCatalogApplicableFilterKeys(['premium' as FormatId])).toContain(
      'clan',
    )
    expect(
      getCatalogApplicableFilterKeys(['premium' as FormatId]),
    ).not.toContain('nation')
  })

  it('treats era filters as explicit product-lineage selectors', () => {
    const query = normalizeCatalogQuery({
      filters: {
        eras: ['D', 'v', 'unknown'],
      },
    })

    expect(catalogEraFilterProfiles.map((profile) => profile.id)).toEqual([
      'd',
      'v',
      'premium',
      'cross',
    ])
    expect(getCatalogEraFilterProfile('d' as CatalogEraKey)?.label).toBe(
      'D Era',
    )
    expect(query.filters.eras).toEqual(['d', 'v'])
    expect(resolveCatalogEraProductLineages(query.filters.eras)).toEqual([
      'standard-lineage',
      'v-lineage',
    ])
  })

  it('falls back to safe defaults for invalid perspective and sort input', () => {
    const defaultEntitySort = normalizeCatalogSort(
      'invalid',
      'card-entity',
      null,
    )
    const defaultPrintingSort = normalizeCatalogSort(
      'relevance',
      'card-printing',
      null,
    )

    expect(normalizeCatalogPerspective('invalid')).toBe('card-entity')
    expect(defaultEntitySort).toBe('name-asc')
    expect(defaultPrintingSort).toBe('release-date-desc')
  })

  it('computes offset from the normalized window', () => {
    const query = normalizeCatalogQuery({
      window: {
        page: 3,
        pageSize: 24,
      },
    })

    expect(getCatalogWindowOffset(query.window)).toBe(48)
  })

  it('treats non-window query changes as pagination reset triggers', () => {
    const baseQuery = normalizeCatalogQuery({
      searchText: 'Azure',
      filters: {
        formatIds: ['standard'],
        nations: ['dragon empire'],
      },
      window: {
        page: 3,
        pageSize: 24,
      },
    })
    const sameQueryDifferentPage = normalizeCatalogQuery({
      searchText: 'Azure',
      filters: {
        formatIds: ['standard'],
        nations: ['dragon empire'],
      },
      window: {
        page: 1,
        pageSize: 24,
      },
    })
    const changedQuery = normalizeCatalogQuery({
      searchText: 'Azure',
      filters: {
        formatIds: ['premium'],
        clans: ['royal paladin'],
      },
      window: {
        page: 3,
        pageSize: 24,
      },
    })

    expect(
      areCatalogQueriesEquivalent(baseQuery, sameQueryDifferentPage, {
        ignoreWindow: true,
      }),
    ).toBe(true)
    expect(
      shouldResetCatalogPagination(baseQuery, sameQueryDifferentPage),
    ).toBe(false)
    expect(shouldResetCatalogPagination(baseQuery, changedQuery)).toBe(true)
  })

  it('keeps faceting contracts typed separately from active filters', () => {
    expectTypeOf<
      CatalogFacetResult['facets'][number]['values'][number]['count']
    >().toEqualTypeOf<number>()
    expectTypeOf<
      CatalogFacetResult['facets'][number]['values'][number]['selected']
    >().toEqualTypeOf<boolean>()
    expectTypeOf<
      CatalogFacetResult['facets'][number]['values'][number]['value']
    >().toEqualTypeOf<string>()
    expectTypeOf<readonly FormatId[] | readonly Nation[]>().not.toBeAny()
  })
})
