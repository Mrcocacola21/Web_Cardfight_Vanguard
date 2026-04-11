import { describe, expect, it } from 'vitest'

import {
  catalogQueryToSearchParams,
  parseCatalogSearchParams,
} from './catalog-search-params'

describe('@web-vg/catalog search params', () => {
  it('parses search params into a normalized catalog query', () => {
    const params = new URLSearchParams([
      ['q', '  Azure   Vanguard  '],
      ['perspective', 'card-printing'],
      ['sort', 'release-date-desc'],
      ['page', '2'],
      ['pageSize', '48'],
      ['format', 'standard,premium'],
      ['format', 'standard'],
      ['nation', 'Dragon Empire'],
      ['era', 'D'],
      ['type', 'normal-unit'],
      ['type', 'invalid'],
      ['trigger', 'draw'],
      ['rarity', 'RRR'],
      ['set', 'product.d-bt01.azure'],
    ])

    const query = parseCatalogSearchParams(params)

    expect(query).toEqual({
      searchText: 'Azure Vanguard',
      perspective: 'card-printing',
      sort: 'release-date-desc',
      window: {
        page: 2,
        pageSize: 48,
      },
      filters: {
        formatIds: ['premium', 'standard'],
        eras: ['d'],
        nations: ['dragon empire'],
        clans: [],
        cardTypes: ['normal-unit'],
        triggerTypes: ['draw'],
        rarities: ['rrr'],
        productKeys: ['product.d-bt01.azure'],
      },
    })
  })

  it('ignores unknown and malformed params predictably', () => {
    const query = parseCatalogSearchParams({
      q: '   ',
      perspective: 'other',
      sort: 'unknown',
      page: 'zero',
      pageSize: '-1',
      unknown: 'value',
      type: ['token', 'unsupported'],
      trigger: 'invalid',
    })

    expect(query.searchText).toBeNull()
    expect(query.perspective).toBe('card-entity')
    expect(query.sort).toBe('name-asc')
    expect(query.window).toEqual({
      page: 1,
      pageSize: 24,
    })
    expect(query.filters.cardTypes).toEqual(['token'])
    expect(query.filters.triggerTypes).toEqual([])
  })

  it('applies format-aware normalization while parsing URL params', () => {
    const query = parseCatalogSearchParams({
      format: 'premium',
      nation: 'Dragon Empire',
      clan: 'Royal Paladin',
    })

    expect(query.filters.formatIds).toEqual(['premium'])
    expect(query.filters.nations).toEqual([])
    expect(query.filters.clans).toEqual(['royal paladin'])
  })

  it('serializes a normalized catalog query back into stable search params', () => {
    const params = catalogQueryToSearchParams(
      parseCatalogSearchParams({
        q: 'Azure Vanguard',
        perspective: 'card-printing',
        page: '2',
        format: ['premium', 'standard'],
        era: 'v',
        rarity: 'SP',
        set: 'product.v-bt01.crimson-vanguard',
      }),
    )

    expect(params.toString()).toBe(
      'era=v&format=premium&format=standard&page=2&perspective=card-printing&q=Azure+Vanguard&rarity=sp&set=product.v-bt01.crimson-vanguard',
    )
  })

  it('accepts the legacy product param while serializing back to canonical set params', () => {
    const params = catalogQueryToSearchParams(
      parseCatalogSearchParams({
        product: 'product.d-sd01.azure-vanguard-start-deck',
      }),
    )

    expect(params.toString()).toBe(
      'set=product.d-sd01.azure-vanguard-start-deck',
    )
  })

  it('preserves multi-value filter state through parse and serialize round-trips', () => {
    const params = catalogQueryToSearchParams(
      parseCatalogSearchParams({
        format: ['premium', 'v-premium'],
        clan: ['Royal Paladin', 'Gear Chronicle'],
        rarity: ['SP', 'RRR'],
        set: [
          'product.v-bt01.crimson-vanguard',
          'product.pr-g01.premium-anniversary-pack',
        ],
      }),
    )

    expect(params.toString()).toBe(
      'clan=gear+chronicle&clan=royal+paladin&format=premium&format=v-premium&rarity=rrr&rarity=sp&set=product.pr-g01.premium-anniversary-pack&set=product.v-bt01.crimson-vanguard',
    )
  })
})
