import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import * as entry from './index'
import type {
  BoosterProductType,
  Card,
  CardId,
  CardPrinting,
  Product,
  ProductFamily,
  ProductType,
} from './index'
import type { EffectRef } from '@web-vg/shared'

describe('@web-vg/catalog', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(entry.groupPrintingsByCardId).toBeTypeOf('function')
  })

  it('keeps catalog entities keyed by domain identifiers', () => {
    expectTypeOf<Card['id']>().toEqualTypeOf<CardId>()
    expectTypeOf<CardPrinting['cardId']>().toEqualTypeOf<CardId>()
    expectTypeOf<Card['effectRefs']>().toEqualTypeOf<readonly EffectRef[]>()
  })

  it('models product taxonomy as structured types instead of flat strings', () => {
    expectTypeOf<Product['type']>().toEqualTypeOf<ProductType>()
    expectTypeOf<BoosterProductType['boosterKind']>().toEqualTypeOf<
      'main' | 'extra' | 'title' | 'lyrical'
    >()
    expectTypeOf<ProductFamily['lineage']>().toEqualTypeOf<
      'standard-lineage' | 'v-lineage' | 'premium-lineage' | 'cross-lineage'
    >()
  })
})
