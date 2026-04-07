import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import * as entry from './index'
import type { Deck, DeckSnapshot, DeckVersion } from './index'
import type { DeckId, FormatId } from '@web-vg/shared'

describe('@web-vg/decks', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(entry.getDeckSection).toBeTypeOf('function')
  })

  it('keeps decks aligned with format-bound snapshots', () => {
    expectTypeOf<Deck['id']>().toEqualTypeOf<DeckId>()
    expectTypeOf<DeckVersion['formatId']>().toEqualTypeOf<FormatId>()
    expectTypeOf<DeckVersion['snapshot']>().toEqualTypeOf<DeckSnapshot>()
  })
})
