import { describe, expect, it } from 'vitest'

import type { CardId, DeckId, DeckSnapshot, FormatId } from '@web-vg/shared'
import { countCardCopies, countCardsInSection, getDeckSection } from './index'

const deckId = 'deck-alpha' as DeckId
const standardFormatId = 'standard' as FormatId
const cardAlphaId = 'card-alpha' as CardId
const cardBetaId = 'card-beta' as CardId
const cardGammaId = 'card-gamma' as CardId

const snapshot: DeckSnapshot = {
  deckId,
  formatId: standardFormatId,
  revision: 1,
  completeness: 'complete',
  sections: [
    {
      section: 'main',
      entries: [
        { cardId: cardAlphaId, count: 2 },
        { cardId: cardBetaId, count: 3 },
      ],
    },
    {
      section: 'ride',
      entries: [
        { cardId: cardAlphaId, count: 1 },
        { cardId: cardGammaId, count: 3 },
      ],
    },
  ],
}

describe('@web-vg/decks snapshot helpers', () => {
  it('keeps deck sections distinct instead of flattening the snapshot', () => {
    expect(getDeckSection(snapshot, 'main')).toMatchObject({ section: 'main' })
    expect(getDeckSection(snapshot, 'ride')).toMatchObject({ section: 'ride' })
    expect(getDeckSection(snapshot, 'g')).toBeUndefined()
  })

  it('counts section size independently per zone', () => {
    expect(countCardsInSection(snapshot, 'main')).toBe(5)
    expect(countCardsInSection(snapshot, 'ride')).toBe(4)
    expect(countCardsInSection(snapshot, 'g')).toBe(0)
  })

  it('counts duplicates by canonical card identity within the requested scope', () => {
    expect(countCardCopies(snapshot, cardAlphaId, ['main'])).toBe(2)
    expect(countCardCopies(snapshot, cardAlphaId, ['ride'])).toBe(1)
    expect(countCardCopies(snapshot, cardAlphaId, ['main', 'ride'])).toBe(3)
  })
})
