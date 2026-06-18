import { describe, expect, it } from 'vitest'

import {
  HEARTLURU_ATTACK_THRESHOLDS_EFFECT,
  KAIRI_ATTACK_SEQUENCE_EFFECT,
  PRISON_CAPTURE_EFFECT,
  REGUREGNUS_BATTLE_REPLACE_EFFECT,
  VYRGILLA_REWRITE_EFFECT,
  YOUTHBERK_REVOLDRESS_EFFECT,
} from '@web-vg/rules-core'

import {
  listStandardSliceQaCardPrintings,
  listStandardSliceQaCatalogCards,
  STANDARD_SLICE_QA_DECKS,
  STANDARD_SLICE_QA_PRODUCT,
} from './standard-slice-qa-decks'

describe('STANDARD_SLICE_QA_DECKS', () => {
  it('provides the six target Standard slice decks as deck-builder-ready saved decks', () => {
    expect(STANDARD_SLICE_QA_DECKS.map((deck) => deck.displayName)).toEqual([
      'Reguregnus',
      'Heartluru',
      'Youthberk',
      'Prison',
      'Vyrgilla',
      'Kairi',
    ])

    const catalogCards = listStandardSliceQaCatalogCards()
    const cardById = new Map(catalogCards.map((card) => [card.id, card]))

    for (const deck of STANDARD_SLICE_QA_DECKS) {
      const mainCount = deck.entries
        .filter((entry) => entry.section === 'main')
        .reduce((total, entry) => total + entry.quantity, 0)
      const rideCount = deck.entries
        .filter((entry) => entry.section === 'ride')
        .reduce((total, entry) => total + entry.quantity, 0)
      const triggerCount = deck.entries
        .filter((entry) => entry.section === 'main')
        .filter(
          (entry) =>
            cardById.get(entry.cardEntityId)?.cardType === 'trigger-unit',
        )
        .reduce((total, entry) => total + entry.quantity, 0)

      expect(deck.title).toMatch(/^\[QA\] Standard Slice - /)
      expect(mainCount).toBe(50)
      expect(rideCount).toBe(4)
      expect(triggerCount).toBe(16)
      expect(
        deck.entries.every((entry) => cardById.has(entry.cardEntityId)),
      ).toBe(true)
    }
  })

  it('publishes Standard-visible catalog cards and printings for the QA product', () => {
    const catalogCards = listStandardSliceQaCatalogCards()
    const printings = listStandardSliceQaCardPrintings()

    expect(STANDARD_SLICE_QA_PRODUCT.familyId).toBe('family-standard')
    expect(catalogCards).toHaveLength(printings.length)
    expect(
      printings.every(
        (printing) => printing.productId === STANDARD_SLICE_QA_PRODUCT.id,
      ),
    ).toBe(true)
  })

  it('keeps signature cards bound to real Standard slice effect definition ids', () => {
    const cards = listStandardSliceQaCatalogCards()
    const effectRefs = new Set(cards.flatMap((card) => card.effectRefs))

    for (const effectId of [
      REGUREGNUS_BATTLE_REPLACE_EFFECT.id,
      HEARTLURU_ATTACK_THRESHOLDS_EFFECT.id,
      YOUTHBERK_REVOLDRESS_EFFECT.id,
      PRISON_CAPTURE_EFFECT.id,
      VYRGILLA_REWRITE_EFFECT.id,
      KAIRI_ATTACK_SEQUENCE_EFFECT.id,
    ]) {
      expect(effectRefs.has(effectId)).toBe(true)
    }
  })
})
