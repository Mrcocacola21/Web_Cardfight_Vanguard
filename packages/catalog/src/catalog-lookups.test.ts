import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import type { CardId, CardPrintingId, ProductId } from '@web-vg/shared'

import type {
  CanonicalCardKey,
  CardPrintingKey,
  ProductCanonicalKey,
} from './catalog-identifiers'
import {
  cardEntityLookupByCanonicalKey,
  cardEntityLookupById,
  cardPrintingLookupById,
  cardPrintingLookupByPrintingKey,
  isCardEntityLookup,
  isCardPrintingLookup,
  isProductLookup,
  productLookupByCanonicalKey,
  productLookupById,
} from './catalog-lookups'

describe('@web-vg/catalog lookup contracts', () => {
  it('keeps entity, printing, and product lookup contracts distinct', () => {
    const entityLookup = cardEntityLookupByCanonicalKey(
      'card.azure-vanguard-dragon' as CanonicalCardKey,
    )
    const printingLookup = cardPrintingLookupByPrintingKey(
      'printing.azure-vanguard-dragon.d-sd01.004.en' as CardPrintingKey,
    )
    const productLookup = productLookupByCanonicalKey(
      'product.d-bt01.genesis-of-azure' as ProductCanonicalKey,
    )

    expect(entityLookup.target).toBe('card-entity')
    expect(printingLookup.target).toBe('card-printing')
    expect(productLookup.target).toBe('product')
    expect(isCardEntityLookup(entityLookup)).toBe(true)
    expect(isCardEntityLookup(printingLookup)).toBe(false)
    expect(isCardPrintingLookup(printingLookup)).toBe(true)
    expect(isProductLookup(productLookup)).toBe(true)
  })

  it('supports stable-key and internal-id lookup variants without merging semantics', () => {
    const entityById = cardEntityLookupById('card-1' as CardId)
    const printingById = cardPrintingLookupById('printing-1' as CardPrintingId)
    const productById = productLookupById('product-1' as ProductId)

    expect(entityById.by).toBe('id')
    expect(printingById.by).toBe('id')
    expect(productById.by).toBe('id')
    expect(entityById.target).not.toBe(printingById.target)
  })

  it('keeps lookup value types narrow', () => {
    expectTypeOf<
      ReturnType<typeof cardEntityLookupById>['value']
    >().toEqualTypeOf<CardId>()
    expectTypeOf<
      ReturnType<typeof cardPrintingLookupById>['value']
    >().toEqualTypeOf<CardPrintingId>()
    expectTypeOf<
      ReturnType<typeof productLookupById>['value']
    >().toEqualTypeOf<ProductId>()
  })
})
