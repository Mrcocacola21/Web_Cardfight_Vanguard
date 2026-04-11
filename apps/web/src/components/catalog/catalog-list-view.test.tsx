import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveCatalogCardListQuery } from '@/features/catalog/catalog-list-query'

import { CatalogListView } from './catalog-list-view'

afterEach(() => {
  cleanup()
})

describe('CatalogListView', () => {
  it('renders catalog controls and detail links from the canonical query state', () => {
    render(
      <CatalogListView
        query={resolveCatalogCardListQuery({
          q: 'Azure',
          format: 'standard',
          era: 'd',
          nation: 'Dragon Empire',
          clan: 'Royal Paladin',
          rarity: 'RRR',
          set: 'product.d-bt01.genesis-of-azure',
          sort: 'grade-asc',
          page: '2',
        })}
        listing={{
          items: [
            {
              id: 'card-1',
              canonicalKey: 'card.azure-vanguard-dragon',
              name: 'Azure Vanguard Dragon',
              normalizedName: 'azure vanguard dragon',
              grade: 3,
              cardType: 'normal-unit',
              nation: 'Dragon Empire',
              clan: null,
              race: 'Cosmo Dragon',
              triggerType: null,
              basePower: 13000,
              baseCritical: 1,
              baseShield: 0,
              keywords: ['twin-drive'],
              effectRefs: ['effect.ref.dev.dragon'],
            },
          ],
          totalCount: 26,
          page: 2,
          pageSize: 24,
          pageCount: 2,
          hasPreviousPage: true,
          hasNextPage: false,
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /card catalog/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('searchbox', { name: /search cards/i }),
    ).toHaveValue('Azure')
    expect(screen.getByLabelText(/format/i)).toHaveValue('standard')
    expect(screen.getByLabelText(/era/i)).toHaveValue('d')
    expect(screen.getByLabelText(/nation/i)).toHaveValue('dragon empire')
    expect(screen.getByLabelText(/clan/i)).toBeDisabled()
    expect(screen.getByLabelText(/rarity/i)).toHaveValue('rrr')
    expect(screen.getByLabelText(/set/i)).toHaveValue(
      'product.d-bt01.genesis-of-azure',
    )
    expect(screen.getByRole('link', { name: /view card/i })).toHaveAttribute(
      'href',
      '/catalog/card.azure-vanguard-dragon',
    )
    expect(screen.getByRole('link', { name: /previous/i })).toHaveAttribute(
      'href',
      '/catalog?era=d&format=standard&nation=dragon+empire&q=Azure&rarity=rrr&set=product.d-bt01.genesis-of-azure&sort=grade-asc',
    )
  })

  it('switches the identity filter surface to clan-aware mode for clan-based formats', () => {
    render(
      <CatalogListView
        query={resolveCatalogCardListQuery({
          format: 'premium',
          era: 'v',
          nation: 'Dragon Empire',
          clan: 'Royal Paladin',
          set: 'product.v-bt01.crimson-vanguard',
        })}
        listing={{
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 24,
          pageCount: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        }}
      />,
    )

    expect(screen.getByLabelText(/nation/i)).toBeDisabled()
    expect(screen.getByLabelText(/clan/i)).not.toBeDisabled()
    expect(screen.getByLabelText(/clan/i)).toHaveValue('royal paladin')
    expect(screen.getByLabelText(/format/i)).toHaveValue('premium')
    expect(screen.getByLabelText(/era/i)).toHaveValue('v')
    expect(screen.getByLabelText(/set/i)).toHaveValue(
      'product.v-bt01.crimson-vanguard',
    )
  })

  it('renders a resettable empty state when active filters return no matches', () => {
    render(
      <CatalogListView
        query={resolveCatalogCardListQuery({
          format: 'v-premium',
          era: 'v',
          clan: 'Royal Paladin',
          rarity: 'sp',
        })}
        listing={{
          items: [],
          totalCount: 0,
          page: 1,
          pageSize: 24,
          pageCount: 1,
          hasPreviousPage: false,
          hasNextPage: false,
        }}
      />,
    )

    expect(screen.getByText(/no cards match this query/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /clear filters/i }),
    ).toHaveAttribute('href', '/catalog')
  })
})
