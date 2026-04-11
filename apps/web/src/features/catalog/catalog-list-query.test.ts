import { describe, expect, it } from 'vitest'

import {
  buildCatalogCardListHref,
  hasActiveCatalogCardListQuery,
  resolveCatalogCardListQuery,
} from './catalog-list-query'

describe('catalog list query helpers', () => {
  it('forces the entity perspective while parsing search params', () => {
    const query = resolveCatalogCardListQuery({
      q: 'Vanguard',
      format: 'premium',
      era: 'v',
      perspective: 'card-printing',
      nation: ['Dragon Empire'],
      clan: ['Royal Paladin'],
      rarity: ['SP'],
      set: ['product.v-bt01.crimson-vanguard'],
      sort: 'release-date-desc',
      page: '2',
    })

    expect(query).toMatchObject({
      searchText: 'Vanguard',
      perspective: 'card-entity',
      sort: 'relevance',
      window: {
        page: 2,
        pageSize: 24,
      },
      filters: {
        formatIds: ['premium'],
        eras: ['v'],
        nations: [],
        clans: ['royal paladin'],
        rarities: ['sp'],
        productKeys: ['product.v-bt01.crimson-vanguard'],
      },
    })
  })

  it('builds a stable catalog href from the normalized query', () => {
    const href = buildCatalogCardListHref(
      resolveCatalogCardListQuery({
        q: 'Blaster',
        format: 'standard',
        era: 'd',
        nation: 'Keter Sanctuary',
        clan: 'Royal Paladin',
        rarity: 'RRR',
        set: 'product.d-bt01.genesis-of-azure',
        type: 'normal-unit',
        sort: 'grade-asc',
        page: '3',
      }),
    )

    expect(href).toBe(
      '/catalog?era=d&format=standard&nation=keter+sanctuary&page=3&q=Blaster&rarity=rrr&set=product.d-bt01.genesis-of-azure&sort=grade-asc&type=normal-unit',
    )
  })

  it('detects active query state for resettable catalog searches', () => {
    const inactiveQuery = resolveCatalogCardListQuery({})
    const activeQuery = resolveCatalogCardListQuery({
      format: 'v-premium',
      era: 'v',
      clan: 'Royal Paladin',
      set: 'product.v-bt01.crimson-vanguard',
    })

    expect(hasActiveCatalogCardListQuery(inactiveQuery)).toBe(false)
    expect(hasActiveCatalogCardListQuery(activeQuery)).toBe(true)
  })

  it('keeps multi-value canonical filters while stripping printing-list semantics from the main route', () => {
    const href = buildCatalogCardListHref(
      resolveCatalogCardListQuery({
        perspective: 'card-printing',
        sort: 'release-date-desc',
        format: ['premium', 'v-premium'],
        clan: ['Royal Paladin', 'Gear Chronicle'],
        rarity: ['SP', 'RRR'],
        set: [
          'product.v-bt01.crimson-vanguard',
          'product.pr-g01.premium-anniversary-pack',
        ],
      }),
    )

    expect(href).toBe(
      '/catalog?clan=gear+chronicle&clan=royal+paladin&format=premium&format=v-premium&rarity=rrr&rarity=sp&set=product.pr-g01.premium-anniversary-pack&set=product.v-bt01.crimson-vanguard',
    )
  })
})
