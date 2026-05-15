import { describe, expect, it } from 'vitest'

import type { CardId } from '@web-vg/shared'

import type {
  BattleId,
  EventId,
  GameEvent,
  GameId,
  GameState,
  PieceId,
  PlayerId,
  RequestId,
  VisibleGameState,
  ZoneId,
} from '../index'
import {
  STANDARD_FORMAT_ID,
  buildEngineCardStatsSnapshot,
  projectGameEventsForPlayer,
  projectGameStateForOmniscientViewer,
  projectGameStateForPlayer,
} from '../index'

const PLAYER_A = 'projection-player-a' as PlayerId
const PLAYER_B = 'projection-player-b' as PlayerId

describe('@web-vg/rules-core hidden information projection', () => {
  it('separates canonical state from a player-visible hand and deck view', () => {
    const state = makeProjectionState()
    const canonicalBefore = JSON.stringify(state)
    const playerAResult = projectGameStateForPlayer(state, PLAYER_A)
    const playerBResult = projectGameStateForPlayer(state, PLAYER_B)

    expect(playerAResult.ok).toBe(true)
    expect(playerBResult.ok).toBe(true)
    expect(JSON.stringify(state)).toBe(canonicalBefore)

    if (!playerAResult.ok || !playerBResult.ok) {
      throw new Error('Expected player projections to succeed.')
    }

    const playerAHand = findZone(playerAResult.state, 'zone-a-hand')
    const playerADeck = findZone(playerAResult.state, 'zone-a-deck')
    const playerBHandFromA = findZone(playerAResult.state, 'zone-b-hand')
    const publicVanguard = findZone(playerAResult.state, 'zone-a-vanguard')

    expect(playerAHand?.contentsVisibility).toBe('full')
    expect(playerAHand?.occupants[0]).toMatchObject({
      pieceId: 'piece-a-hand-secret',
      visibility: 'visible',
    })
    expect(playerADeck?.contentsVisibility).toBe('masked')
    expect(playerADeck?.occupants[0]).toMatchObject({
      visibility: 'masked',
      refId: 'masked:projection-player-a:zone-a-deck:0',
    })
    expect(playerADeck?.occupants[0]).not.toHaveProperty('pieceId')
    expect(playerBHandFromA?.contentsVisibility).toBe('masked')
    expect(playerBHandFromA?.occupants[0]).not.toHaveProperty('pieceId')
    expect(publicVanguard?.occupants[0]).toMatchObject({
      pieceId: 'piece-a-vanguard',
      visibility: 'visible',
    })

    expect(JSON.stringify(playerAResult.state)).not.toContain(
      'card-a-deck-secret',
    )
    expect(JSON.stringify(playerAResult.state)).not.toContain(
      'piece-a-deck-secret',
    )
    expect(JSON.stringify(playerAResult.state)).not.toContain(
      'card-b-hand-secret',
    )
    expect(JSON.stringify(playerBResult.state)).not.toContain(
      'card-a-hand-secret',
    )
    expect(
      playerAResult.state.cardStats?.cards.map((card) => card.cardDefinitionId),
    ).toEqual([
      'card-a-hand-secret',
      'card-a-ride-private',
      'card-a-vanguard-public',
      'card-b-vanguard-public',
    ])
  })

  it('keeps deck contents masked even to the owner while preserving counts', () => {
    const state = makeProjectionState()
    const projection = projectGameStateForPlayer(state, PLAYER_A)

    expect(projection.ok).toBe(true)

    if (!projection.ok) {
      throw new Error(projection.message)
    }

    const deck = findZone(projection.state, 'zone-a-deck')

    expect(deck?.occupantCount).toBe(2)
    expect(deck?.occupants).toEqual([
      {
        refId: 'masked:projection-player-a:zone-a-deck:0',
        visibility: 'masked',
        position: 0,
      },
      {
        refId: 'masked:projection-player-a:zone-a-deck:1',
        visibility: 'masked',
        position: 1,
      },
    ])
  })

  it('redacts responder-only requests for other players', () => {
    const state = makeProjectionState()
    const playerAProjection = projectGameStateForPlayer(state, PLAYER_A)
    const playerBProjection = projectGameStateForPlayer(state, PLAYER_B)

    expect(playerAProjection.ok).toBe(true)
    expect(playerBProjection.ok).toBe(true)

    if (!playerAProjection.ok || !playerBProjection.ok) {
      throw new Error('Expected projections to succeed.')
    }

    expect(playerAProjection.state.pendingRequests[0]).toMatchObject({
      requestId: 'request-mulligan-a',
      visibilityToViewer: 'full',
    })
    expect(playerBProjection.state.pendingRequests[0]).toEqual({
      requestId: 'request-mulligan-a',
      type: 'mulligan.select_cards',
      responderPlayerId: PLAYER_A,
      purpose: 'rule',
      visibility: 'responder-only',
      visibilityToViewer: 'redacted',
    })
    expect(
      JSON.stringify(playerBProjection.state.pendingRequests[0]),
    ).not.toContain('piece-a-hand-secret')
  })

  it('projects reveal aftermath without exposing hidden deck order events', () => {
    const state = makeProjectionState()
    const events = projectGameEventsForPlayer(state, PLAYER_B, [
      {
        eventId: 'event-shuffle-a' as EventId,
        type: 'zone.shuffled',
        sequence: 1,
        origin: {
          kind: 'system',
          system: 'rules-engine',
        },
        zoneId: 'zone-a-deck' as ZoneId,
        orderedPieceIds: [
          'piece-a-deck-secret' as PieceId,
          'piece-a-deck-second-secret' as PieceId,
        ],
      },
      {
        eventId: 'event-trigger-a' as EventId,
        type: 'trigger.revealed',
        sequence: 2,
        origin: {
          kind: 'system',
          system: 'rules-engine',
        },
        battleId: 'battle-projection-1' as BattleId,
        checkKind: 'drive',
        playerId: PLAYER_A,
        revealedPieceId: 'piece-a-deck-secret' as PieceId,
        cardDefinitionId: 'card-a-deck-secret' as CardId,
        triggerType: 'critical',
        sourceCheckEventSequence: 1,
      },
    ] satisfies readonly GameEvent[])

    expect(events.ok).toBe(true)

    if (!events.ok) {
      throw new Error(events.message)
    }

    expect(events.events[0]).toMatchObject({
      type: 'zone.shuffled',
      visibility: 'redacted',
      redactedFields: ['orderedPieceIds'],
    })
    expect(JSON.stringify(events.events[0])).not.toContain(
      'piece-a-deck-secret',
    )
    expect(events.events[1]).toMatchObject({
      type: 'trigger.revealed',
      visibility: 'public',
    })
    expect(events.events[1]?.details).toContainEqual({
      label: 'Card',
      value: 'card-a-deck-secret',
    })
  })

  it('provides an explicit omniscient projection for local/dev inspection', () => {
    const state = makeProjectionState()
    const projection = projectGameStateForOmniscientViewer(state)

    expect(projection.projectionMode).toBe('omniscient')
    expect(JSON.stringify(projection)).toContain('card-a-deck-secret')
    expect(JSON.stringify(projection)).toContain('piece-b-hand-secret')
  })

  it('rejects projection for an unknown viewer instead of falling back to full state', () => {
    const result = projectGameStateForPlayer(
      makeProjectionState(),
      'projection-unknown-player' as PlayerId,
    )

    expect(result).toMatchObject({
      ok: false,
      code: 'unknown_viewer',
    })
  })
})

function findZone(state: VisibleGameState, zoneId: string) {
  return state.zones.find((zone) => zone.zoneId === zoneId)
}

function makeProjectionState(): GameState {
  return {
    gameId: 'game-hidden-projection' as GameId,
    formatId: STANDARD_FORMAT_ID,
    status: 'awaiting_choice',
    revision: 8,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_A,
      phase: 'pregame',
      step: 'mulligan',
    },
    players: [
      {
        playerId: PLAYER_A,
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          'zone-a-hand',
          'zone-a-deck',
          'zone-a-ride',
          'zone-a-vanguard',
        ].map((zoneId) => zoneId as ZoneId),
        counters: [
          {
            key: 'public-counter',
            amount: 1,
            visibility: 'public',
          },
          {
            key: 'private-counter',
            amount: 2,
            visibility: 'owner-private',
          },
        ],
        flags: [],
      },
      {
        playerId: PLAYER_B,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: ['zone-b-hand', 'zone-b-deck', 'zone-b-vanguard'].map(
          (zoneId) => zoneId as ZoneId,
        ),
        counters: [],
        flags: [],
      },
    ],
    zones: [
      zone('zone-a-hand', 'hand', PLAYER_A, 'owner-private', [
        'piece-a-hand-secret',
      ]),
      zone('zone-a-deck', 'deck', PLAYER_A, 'owner-private', [
        'piece-a-deck-secret',
        'piece-a-deck-second-secret',
      ]),
      zone('zone-a-ride', 'ride_deck', PLAYER_A, 'owner-private', [
        'piece-a-ride-private',
      ]),
      zone('zone-a-vanguard', 'vanguard_circle', PLAYER_A, 'public', [
        'piece-a-vanguard',
      ]),
      zone('zone-b-hand', 'hand', PLAYER_B, 'owner-private', [
        'piece-b-hand-secret',
      ]),
      zone('zone-b-deck', 'deck', PLAYER_B, 'owner-private', [
        'piece-b-deck-secret',
      ]),
      zone('zone-b-vanguard', 'vanguard_circle', PLAYER_B, 'public', [
        'piece-b-vanguard',
      ]),
    ],
    pieces: [
      piece('piece-a-hand-secret', 'card-a-hand-secret', PLAYER_A),
      piece('piece-a-deck-secret', 'card-a-deck-secret', PLAYER_A),
      piece(
        'piece-a-deck-second-secret',
        'card-a-deck-second-secret',
        PLAYER_A,
      ),
      piece('piece-a-ride-private', 'card-a-ride-private', PLAYER_A),
      piece('piece-a-vanguard', 'card-a-vanguard-public', PLAYER_A),
      piece('piece-b-hand-secret', 'card-b-hand-secret', PLAYER_B),
      piece('piece-b-deck-secret', 'card-b-deck-secret', PLAYER_B),
      piece('piece-b-vanguard', 'card-b-vanguard-public', PLAYER_B),
    ],
    cardStats: buildEngineCardStatsSnapshot(
      [
        'card-a-hand-secret',
        'card-a-deck-secret',
        'card-a-deck-second-secret',
        'card-a-ride-private',
        'card-a-vanguard-public',
        'card-b-hand-secret',
        'card-b-deck-secret',
        'card-b-vanguard-public',
      ].map((cardId) => ({
        cardDefinitionId: cardId as CardId,
        cardType: 'normal-unit',
        grade: 1,
        power: 8000,
        shield: 5000,
        critical: 1,
        triggerType: null,
        keywords: [],
      })),
    ),
    pieceStates: [],
    flags: [],
    pendingRequests: [
      {
        requestId: 'request-mulligan-a' as RequestId,
        type: 'mulligan.select_cards',
        responderPlayerId: PLAYER_A,
        purpose: 'rule',
        visibility: 'responder-only',
        handZoneId: 'zone-a-hand' as ZoneId,
        deckZoneId: 'zone-a-deck' as ZoneId,
        minSelections: 0,
        maxSelections: 1,
        eligiblePieceIds: ['piece-a-hand-secret' as PieceId],
        currentDeckPieceIds: [
          'piece-a-deck-secret' as PieceId,
          'piece-a-deck-second-secret' as PieceId,
        ],
      },
    ],
  }
}

function zone(
  zoneId: string,
  kind: string,
  ownerPlayerId: PlayerId,
  visibility: GameState['zones'][number]['visibility'],
  pieceIds: readonly string[],
): GameState['zones'][number] {
  return {
    zoneId: zoneId as ZoneId,
    kind,
    scope: 'player',
    ownerPlayerId,
    visibility,
    layout: {
      ordering: kind === 'hand' ? 'unordered' : 'ordered',
      occupancy: kind === 'vanguard_circle' ? 'single' : 'multi',
    },
    occupants: pieceIds.map((pieceId) => ({
      pieceId: pieceId as PieceId,
    })),
  }
}

function piece(
  pieceId: string,
  cardDefinitionId: string,
  playerId: PlayerId,
): GameState['pieces'][number] {
  return {
    pieceId: pieceId as PieceId,
    kind: 'card',
    cardDefinitionId: cardDefinitionId as CardId,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
  }
}
