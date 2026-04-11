import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import * as entry from './index'
import type { CardId, DeckId, FormatId, UserId } from '@web-vg/shared'
import type { Deck, DeckCard, DeckSnapshot, DeckVersion } from './index'

describe('@web-vg/decks', () => {
  it('exposes deck aggregate and mutation entrypoints', () => {
    expect(entry).toBeDefined()
    expect(entry.createDeck).toBeTypeOf('function')
    expect(entry.addCard).toBeTypeOf('function')
    expect(entry.setCardCount).toBeTypeOf('function')
    expect(entry.removeCard).toBeTypeOf('function')
    expect(entry.clearDeck).toBeTypeOf('function')
    expect(entry.toDeckSnapshot).toBeTypeOf('function')
  })

  it('keeps deck identity canonical-card based', () => {
    expectTypeOf<Deck['id']>().toEqualTypeOf<DeckId>()
    expectTypeOf<Deck['ownerId']>().toEqualTypeOf<UserId>()
    expectTypeOf<Deck['formatId']>().toEqualTypeOf<FormatId>()
    expectTypeOf<DeckVersion['snapshot']>().toEqualTypeOf<DeckSnapshot>()
    expectTypeOf<DeckCard['cardEntityId']>().toEqualTypeOf<CardId>()
    expectTypeOf<
      'printingId' extends keyof DeckCard ? true : false
    >().toEqualTypeOf<false>()
  })
})
