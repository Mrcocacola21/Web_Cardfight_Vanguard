import { render, screen } from '@testing-library/react'
import type { CatalogQuery } from '@web-vg/catalog'
import type { CatalogCardEntityListRecord, RepositoryResult } from '@web-vg/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listCatalogCards:
    vi.fn<
      (
        query: CatalogQuery,
      ) => Promise<RepositoryResult<CatalogCardEntityListRecord>>
    >(),
  redirect: vi.fn(),
}))

vi.mock('@/features/catalog/server/catalog-read', () => ({
  listCatalogCards: mocks.listCatalogCards,
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('@/components/catalog/catalog-list-view', () => ({
  CatalogListView: ({
    query,
    listing,
  }: {
    query: {
      searchText: string | null
      filters: {
        formatIds: readonly string[]
        eras: readonly string[]
        nations: readonly string[]
        clans: readonly string[]
        rarities: readonly string[]
        productKeys: readonly string[]
      }
      sort: string
      perspective: string
      window: {
        page: number
      }
    }
    listing: {
      totalCount: number
    }
  }) => (
    <div>
      <span data-testid="catalog-search">{query.searchText}</span>
      <span data-testid="catalog-format">{query.filters.formatIds[0]}</span>
      <span data-testid="catalog-era">{query.filters.eras[0]}</span>
      <span data-testid="catalog-nation">{query.filters.nations[0]}</span>
      <span data-testid="catalog-clan">{query.filters.clans[0]}</span>
      <span data-testid="catalog-rarity">{query.filters.rarities[0]}</span>
      <span data-testid="catalog-set">{query.filters.productKeys[0]}</span>
      <span data-testid="catalog-sort">{query.sort}</span>
      <span data-testid="catalog-perspective">{query.perspective}</span>
      <span data-testid="catalog-page">{listing.totalCount}</span>
    </div>
  ),
}))

import CatalogPage from './page'

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses URL search params through the catalog query module before loading data', async () => {
    mocks.listCatalogCards.mockResolvedValueOnce({
      ok: true,
      data: {
        items: [],
        totalCount: 0,
        page: 2,
        pageSize: 24,
        pageCount: 1,
        hasPreviousPage: true,
        hasNextPage: false,
      },
    })

    render(
      await CatalogPage({
        searchParams: Promise.resolve({
          q: 'Blaster',
          format: 'premium',
          era: 'v',
          nation: 'Dragon Empire',
          clan: 'Royal Paladin',
          rarity: 'SP',
          set: 'product.v-bt01.crimson-vanguard',
          sort: 'grade-asc',
          perspective: 'card-printing',
          page: '2',
        }),
      }),
    )

    const query = mocks.listCatalogCards.mock.calls[0]?.[0]

    expect(query).toMatchObject({
      searchText: 'Blaster',
      perspective: 'card-entity',
      sort: 'grade-asc',
      filters: {
        formatIds: ['premium'],
        eras: ['v'],
        nations: [],
        clans: ['royal paladin'],
        rarities: ['sp'],
        productKeys: ['product.v-bt01.crimson-vanguard'],
      },
      window: {
        page: 2,
        pageSize: 24,
      },
    })
    expect(screen.getByTestId('catalog-search')).toHaveTextContent('Blaster')
  })

  it('redirects oversized page numbers back to the last available catalog page', async () => {
    mocks.listCatalogCards.mockResolvedValueOnce({
      ok: true,
      data: {
        items: [],
        totalCount: 40,
        page: 4,
        pageSize: 24,
        pageCount: 2,
        hasPreviousPage: true,
        hasNextPage: false,
      },
    })

    await CatalogPage({
      searchParams: Promise.resolve({
        q: 'Blaster',
        page: '4',
      }),
    })

    expect(mocks.redirect).toHaveBeenCalledWith('/catalog?page=2&q=Blaster')
  })
})
