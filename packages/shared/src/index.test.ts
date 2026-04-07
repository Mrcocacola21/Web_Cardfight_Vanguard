import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import * as entry from './index'
import type {
  DeckSnapshot,
  FormatId,
  FormatProfile,
  FormatSupportMatrix,
  LegalityResult,
} from './index'

describe('@web-vg/shared', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(entry.formatHasSection).toBeTypeOf('function')
  })

  it('keeps published contracts type-safe', () => {
    expectTypeOf<DeckSnapshot['formatId']>().toEqualTypeOf<FormatId>()
    expectTypeOf<LegalityResult['status']>().toEqualTypeOf<
      'valid' | 'invalid' | 'unsupported' | 'partially_supported'
    >()
    expectTypeOf<FormatProfile['formatId']>().toEqualTypeOf<FormatId>()
    expectTypeOf<
      FormatProfile['capabilities']['supportsRideDeck']
    >().toEqualTypeOf<boolean>()
    expectTypeOf<
      FormatProfile['constructionRules']['duplicateConstraint']['defaultMaxCopiesPerCard']
    >().toEqualTypeOf<number>()
    expectTypeOf<
      FormatProfile['constructionRules']['triggerConstraint']
    >().toEqualTypeOf<
      | {
          readonly appliesToSection: 'main'
          readonly maxTotalTriggers: number
          readonly perTypeLimits: readonly {
            readonly triggerType:
              | 'critical'
              | 'draw'
              | 'front'
              | 'heal'
              | 'stand'
              | 'over'
            readonly maxCopies: number
          }[]
        }
      | undefined
    >()
    expectTypeOf<FormatSupportMatrix['deckBuilding']>().toEqualTypeOf<
      'supported' | 'partially_supported' | 'unsupported'
    >()
    expectTypeOf<LegalityResult['checkedStages']>().toEqualTypeOf<
      readonly (
        | 'format-eligibility'
        | 'restriction-validation'
        | 'deck-structure-validation'
      )[]
    >()
  })
})
