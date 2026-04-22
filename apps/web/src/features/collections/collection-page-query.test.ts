import { describe, expect, it } from 'vitest'

import {
  buildCollectionPageHref,
  resolveCollectionPageQuery,
} from './collection-page-query'

describe('resolveCollectionPageQuery', () => {
  it('accepts supported view and sort modes', () => {
    expect(
      resolveCollectionPageQuery({
        view: 'list',
        sort: 'quantity',
      }),
    ).toEqual({
      view: 'list',
      sort: 'quantity',
    })
  })

  it('falls back to safe defaults for unsupported query values', () => {
    expect(
      resolveCollectionPageQuery({
        view: 'grid',
        sort: 'rarity',
      }),
    ).toEqual({
      view: 'binder',
      sort: 'recent',
    })
  })
})

describe('buildCollectionPageHref', () => {
  it('omits default query values from the collection route', () => {
    expect(
      buildCollectionPageHref({
        view: 'binder',
        sort: 'recent',
      }),
    ).toBe('/collection')
  })

  it('includes non-default view and sort values', () => {
    expect(
      buildCollectionPageHref({
        view: 'list',
        sort: 'product',
      }),
    ).toBe('/collection?view=list&sort=product')
  })
})
