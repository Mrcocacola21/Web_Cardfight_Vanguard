import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'
import {
  getCardRestrictionCopyLimit,
  isCardRestrictionRule,
  isChoiceRestrictionRule,
} from './index'
import type { CardRestrictionRule, RestrictionRule } from './index'

const formatId = 'standard' as FormatId
const cardAlphaId = 'card-alpha' as CardId
const cardBetaId = 'card-beta' as CardId

describe('@web-vg/legality restriction helpers', () => {
  it('keeps choice restrictions distinct from card-specific copy restrictions', () => {
    const cardRule: RestrictionRule = {
      kind: 'card',
      type: 'limited',
      formatId,
      cardId: cardAlphaId,
    }
    const choiceRule: RestrictionRule = {
      kind: 'choice',
      formatId,
      optionCardIds: [cardAlphaId, cardBetaId],
      allowedChoices: 1,
    }

    expect(isCardRestrictionRule(cardRule)).toBe(true)
    expect(isChoiceRestrictionRule(cardRule)).toBe(false)
    expect(isCardRestrictionRule(choiceRule)).toBe(false)
    expect(isChoiceRestrictionRule(choiceRule)).toBe(true)
  })

  it('maps named restriction types to explicit copy limits', () => {
    const bannedRule: CardRestrictionRule = {
      kind: 'card',
      type: 'banned',
      formatId,
      cardId: cardAlphaId,
    }
    const limitedRule: CardRestrictionRule = {
      kind: 'card',
      type: 'limited',
      formatId,
      cardId: cardAlphaId,
    }
    const semiLimitedRule: CardRestrictionRule = {
      kind: 'card',
      type: 'semi-limited',
      formatId,
      cardId: cardAlphaId,
    }

    expect(getCardRestrictionCopyLimit(bannedRule)).toBe(0)
    expect(getCardRestrictionCopyLimit(limitedRule)).toBe(1)
    expect(getCardRestrictionCopyLimit(semiLimitedRule)).toBe(2)
  })

  it('requires an explicit limit for maximum-copies restrictions', () => {
    const validRule: CardRestrictionRule = {
      kind: 'card',
      type: 'maximum-copies',
      formatId,
      cardId: cardAlphaId,
      limit: 3,
    }
    const malformedRule: CardRestrictionRule = {
      kind: 'card',
      type: 'maximum-copies',
      formatId,
      cardId: cardAlphaId,
    }

    expect(getCardRestrictionCopyLimit(validRule)).toBe(3)
    expect(() => getCardRestrictionCopyLimit(malformedRule)).toThrow(
      'requires an explicit limit',
    )
  })
})
