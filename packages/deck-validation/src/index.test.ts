import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import type { Deck } from '@web-vg/decks'
import * as entry from './index'
import type {
  DeckValidationInput,
  DeckValidationIssue,
  DeckValidationPlan,
  DeckValidationResult,
  DeckValidationValidatorRegistry,
} from './index'

describe('@web-vg/deck-validation', () => {
  it('exposes validation contracts and entrypoints', () => {
    expect(entry).toBeDefined()
    expect(entry.validateDeck).toBeTypeOf('function')
    expect(entry.createDeckValidationPipeline).toBeTypeOf('function')
    expect(Array.isArray(entry.commonDeckValidators)).toBe(true)
    expect(Array.isArray(entry.standardValidators)).toBe(true)
    expect(Array.isArray(entry.vPremiumValidators)).toBe(true)
    expect(Array.isArray(entry.premiumValidators)).toBe(true)
    expect(entry.isSupportedDeckValidationFormatId('standard')).toBe(true)
  })

  it('keeps validation bound to the canonical deck aggregate', () => {
    expectTypeOf<DeckValidationInput['deck']>().toEqualTypeOf<Deck>()
    expectTypeOf<
      DeckValidationResult['issues'][number]
    >().toEqualTypeOf<DeckValidationIssue>()
    expectTypeOf<DeckValidationPipelineShape>().toEqualTypeOf<{
      readonly registry: DeckValidationValidatorRegistry
      createPlan(input: DeckValidationInput): DeckValidationPlan
      validate(input: DeckValidationInput): DeckValidationResult
    }>()
  })
})

type DeckValidationPipelineShape = ReturnType<
  typeof entry.createDeckValidationPipeline
>
