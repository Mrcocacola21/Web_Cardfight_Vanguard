import { describe, expect, expectTypeOf, it } from 'vitest'

import type { CardId, CardPrintingId, FormatId, Keyword } from '@web-vg/shared'

import { RulesInvariantError } from '../errors'
import type { PieceId, PlayerId, ZoneId, ZoneSlotId } from '../index'
import { assertGameStateInvariant, assertZoneStateInvariant } from '../index'
import type {
  GamePieceState,
  GameState,
  PlayerState,
  VisibilityPolicy,
  ZoneOccupancy,
  ZoneState,
} from '../index'

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue
  ? true
  : false

function makePlayerState(): PlayerState {
  return {
    playerId: 'player-1' as PlayerId,
    seat: 0,
    status: 'ready',
    ownedZoneIds: ['zone-deck' as ZoneId, 'zone-field' as ZoneId],
    counters: [
      {
        key: 'damage-count',
        amount: 0,
        visibility: 'public',
      },
    ],
    flags: [
      {
        key: 'can-mulligan',
        enabled: true,
        visibility: 'owner-private',
      },
    ],
  }
}

function makeGameState(): GameState {
  return {
    gameId: 'game-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'setup',
    revision: 0,
    turn: {
      turnNumber: 0,
      turnPlayerId: 'player-1' as PlayerId,
      priorityPlayerId: 'player-1' as PlayerId,
      phase: 'pregame',
      step: 'zone-setup',
    },
    players: [makePlayerState()],
    zones: [
      {
        zoneId: 'zone-deck' as ZoneId,
        kind: 'deck',
        scope: 'player',
        ownerPlayerId: 'player-1' as PlayerId,
        visibility: 'owner-private',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: 'piece-1' as PieceId,
          },
        ],
      },
      {
        zoneId: 'zone-field' as ZoneId,
        kind: 'field',
        scope: 'player',
        ownerPlayerId: 'player-1' as PlayerId,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: [
            'slot-vanguard' as ZoneSlotId,
            'slot-left' as ZoneSlotId,
            'slot-right' as ZoneSlotId,
          ],
        },
        occupants: [],
      },
    ],
    pieces: [
      {
        pieceId: 'piece-1' as PieceId,
        kind: 'card',
        cardDefinitionId: 'card-1' as CardId,
        ownerPlayerId: 'player-1' as PlayerId,
        controllerPlayerId: 'player-1' as PlayerId,
      },
    ],
    pieceStates: [],
    flags: [
      {
        key: 'mulligan-open',
        enabled: true,
      },
    ],
    pendingRequests: [],
  }
}

describe('@web-vg/rules-core state model', () => {
  it('keeps runtime piece identity separate from canonical card identity and collection printings', () => {
    expectTypeOf<GameState['formatId']>().toEqualTypeOf<FormatId>()
    expectTypeOf<GamePieceState['cardDefinitionId']>().toEqualTypeOf<
      CardId | undefined
    >()
    expectTypeOf<GamePieceState['keywords']>().toEqualTypeOf<
      readonly Keyword[] | undefined
    >()
    expectTypeOf<
      HasKey<GamePieceState, 'cardPrintingId'>
    >().toEqualTypeOf<false>()
    expectTypeOf<CardPrintingId>().toMatchTypeOf<string>()
  })

  it('keeps zone semantics and visibility as generic metadata instead of format-specific fields', () => {
    expectTypeOf<
      ZoneState['layout']['occupancy']
    >().toEqualTypeOf<ZoneOccupancy>()
    expectTypeOf<ZoneState['visibility']>().toEqualTypeOf<VisibilityPolicy>()
    expectTypeOf<HasKey<GameState, 'rideDeck'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameState, 'gZone'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<PlayerState, 'rideDeckZoneId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<ZoneState, 'standardOnly'>>().toEqualTypeOf<false>()
  })

  it('accepts a coherent serializable gameplay state foundation', () => {
    const state = makeGameState()

    expect(() => assertGameStateInvariant(state)).not.toThrow()
  })

  it('rejects slotted zones that do not assign slot ids to occupants', () => {
    const zone: ZoneState = {
      zoneId: 'zone-field' as ZoneId,
      kind: 'field',
      scope: 'player',
      ownerPlayerId: 'player-1' as PlayerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'slotted',
        slotIds: ['slot-vanguard' as ZoneSlotId],
      },
      occupants: [
        {
          pieceId: 'piece-1' as PieceId,
        },
      ],
    }

    expect(() => assertZoneStateInvariant(zone)).toThrow(RulesInvariantError)
  })

  it('rejects game states that place the same piece in multiple zones', () => {
    const state = makeGameState()
    const deckZone = state.zones[0]
    const fieldZone = state.zones[1]

    if (deckZone === undefined) {
      throw new Error('Expected deck zone in the state fixture.')
    }

    if (fieldZone === undefined) {
      throw new Error('Expected field zone in the state fixture.')
    }

    const duplicatedState: GameState = {
      ...state,
      zones: [
        deckZone,
        {
          ...fieldZone,
          occupants: [
            {
              pieceId: 'piece-1' as PieceId,
              slotId: 'slot-vanguard' as ZoneSlotId,
            },
          ],
        },
      ],
    }

    expect(() => assertGameStateInvariant(duplicatedState)).toThrow(
      RulesInvariantError,
    )
  })

  it('rejects drift between zone ownership and player-owned zone collections', () => {
    const state = makeGameState()
    const player = state.players[0]

    if (player === undefined) {
      throw new Error('Expected player fixture in the state.')
    }

    const driftedState: GameState = {
      ...state,
      players: [
        {
          ...player,
          ownedZoneIds: ['zone-deck' as ZoneId],
        },
      ],
    }

    expect(() => assertGameStateInvariant(driftedState)).toThrow(
      RulesInvariantError,
    )
  })
})
