import { describe, expect, it } from 'vitest'

import type { CardId, DeckId, FormatId, UserId } from '@web-vg/shared'
import type { DeckVersionId } from './index'
import {
  DeckDomainError,
  addCard,
  clearDeck,
  createDeck,
  decrementCard,
  getDeckCardQuantity,
  getDeckSectionCounts,
  getDeckTotalCards,
  incrementCard,
  removeCard,
  setCardCount,
  setDeckDescription,
  setDeckFavorite,
  setDeckTags,
  toDeckSnapshot,
} from './index'

const deckId = 'deck-1' as DeckId
const ownerId = 'user-1' as UserId
const formatId = 'standard' as FormatId
const versionId = 'version-1' as DeckVersionId
const cardAlphaId = 'card-alpha' as CardId
const cardBetaId = 'card-beta' as CardId

function buildDeck() {
  return createDeck({
    id: deckId,
    ownerId,
    formatId,
    name: '  Bastion Tempo  ',
    description: '  ',
    tags: [' tempo ', 'bastion', 'tempo'],
    isFavorite: true,
    createdAt: '2026-04-10T10:00:00.000Z',
    updatedAt: '2026-04-10T10:00:00.000Z',
    currentVersionId: versionId,
  })
}

describe('@web-vg/decks domain operations', () => {
  it('creates a normalized aggregate root with empty initial composition', () => {
    const deck = buildDeck()

    expect(deck).toMatchObject({
      id: deckId,
      ownerId,
      formatId,
      name: 'Bastion Tempo',
      description: null,
      tags: ['tempo', 'bastion'],
      isFavorite: true,
    })
    expect(deck.currentVersion.snapshot.sections).toEqual([])
    expect(deck.currentVersion.cards).toEqual([])
  })

  it('adds cards without creating duplicate entries in the same section', () => {
    const baseDeck = buildDeck()
    const nextDeck = addCard(baseDeck, cardAlphaId, 2)
    const dedupedDeck = addCard(nextDeck, cardAlphaId, 1)

    expect(dedupedDeck.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: cardAlphaId,
        quantity: 3,
      },
    ])
    expect(getDeckCardQuantity(dedupedDeck, cardAlphaId, 'main')).toBe(3)
  })

  it('keeps section identity explicit for the same canonical card', () => {
    const deck = addCard(addCard(buildDeck(), cardAlphaId, 2), cardAlphaId, 1, {
      section: 'ride',
    })

    expect(deck.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: cardAlphaId,
        quantity: 2,
      },
      {
        section: 'ride',
        cardEntityId: cardAlphaId,
        quantity: 1,
      },
    ])
    expect(getDeckCardQuantity(deck, cardAlphaId)).toBe(3)
    expect(getDeckSectionCounts(deck)).toEqual({
      main: 2,
      ride: 1,
      g: 0,
    })
  })

  it('supports set, increment, decrement, and remove flows without zero-count residue', () => {
    const baseDeck = addCard(buildDeck(), cardAlphaId, 2)
    const changedDeck = incrementCard(baseDeck, cardAlphaId)
    const decrementedDeck = decrementCard(changedDeck, cardAlphaId)
    const resizedDeck = setCardCount(decrementedDeck, cardAlphaId, 1)
    const clearedEntryDeck = setCardCount(resizedDeck, cardAlphaId, 0)
    const removedDeck = removeCard(
      addCard(clearedEntryDeck, cardBetaId, 2, { section: 'ride' }),
      cardBetaId,
      { section: 'ride' },
    )

    expect(getDeckCardQuantity(changedDeck, cardAlphaId)).toBe(3)
    expect(getDeckCardQuantity(decrementedDeck, cardAlphaId)).toBe(2)
    expect(getDeckCardQuantity(resizedDeck, cardAlphaId)).toBe(1)
    expect(clearedEntryDeck.currentVersion.cards).toEqual([])
    expect(removedDeck.currentVersion.cards).toEqual([])
  })

  it('clears the full deck state and keeps a serializable snapshot', () => {
    const deck = clearDeck(
      addCard(addCard(buildDeck(), cardAlphaId, 3), cardBetaId, 1, {
        section: 'ride',
      }),
    )

    expect(getDeckTotalCards(deck)).toBe(0)
    expect(toDeckSnapshot(deck)).toEqual({
      deckId,
      formatId,
      revision: 1,
      completeness: 'complete',
      sections: [],
    })
  })

  it('updates metadata without touching canonical composition', () => {
    const deck = setDeckFavorite(
      setDeckTags(setDeckDescription(buildDeck(), '  Updated Bastion list  '), [
        'ranked',
        ' bastion ',
        'ranked',
      ]),
      false,
    )

    expect(deck.description).toBe('Updated Bastion list')
    expect(deck.tags).toEqual(['ranked', 'bastion'])
    expect(deck.isFavorite).toBe(false)
    expect(deck.currentVersion.cards).toEqual([])
  })

  it('rejects invalid quantities before the aggregate can enter an inconsistent state', () => {
    expect(() => addCard(buildDeck(), cardAlphaId, 0)).toThrowError(
      DeckDomainError,
    )
    expect(() => setCardCount(buildDeck(), cardAlphaId, -1)).toThrowError(
      DeckDomainError,
    )
  })

  it('supports an optional builder-level max quantity guard without creating duplicate rows', () => {
    const cappedDeck = addCard(buildDeck(), cardAlphaId, 4, {
      maxQuantity: 4,
    })

    expect(cappedDeck.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: cardAlphaId,
        quantity: 4,
      },
    ])

    expect(() =>
      addCard(cappedDeck, cardAlphaId, 1, {
        maxQuantity: 4,
      }),
    ).toThrowError(DeckDomainError)

    expect(() =>
      setCardCount(buildDeck(), cardAlphaId, 5, {
        maxQuantity: 4,
      }),
    ).toThrowError(DeckDomainError)
  })
})
