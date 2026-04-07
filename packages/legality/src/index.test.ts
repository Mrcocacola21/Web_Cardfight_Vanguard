import { describe, expect, expectTypeOf, it } from 'vitest'

import * as entry from './index'
import type {
  CardRestrictionRule,
  ChoiceRestrictionRule,
  RestrictionList,
  RestrictionRule,
  ValidationContext,
} from './index'
import type { DeckSnapshot } from '@web-vg/shared'

describe('@web-vg/legality', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(entry.getCardRestrictionCopyLimit).toBeTypeOf('function')
  })

  it('keeps legality context explicit', () => {
    expectTypeOf<ValidationContext['deck']>().toEqualTypeOf<DeckSnapshot>()
    expectTypeOf<RestrictionList['rules']>().toEqualTypeOf<
      readonly RestrictionRule[]
    >()
    expectTypeOf<CardRestrictionRule['kind']>().toEqualTypeOf<'card'>()
    expectTypeOf<ChoiceRestrictionRule['kind']>().toEqualTypeOf<'choice'>()
  })
})
