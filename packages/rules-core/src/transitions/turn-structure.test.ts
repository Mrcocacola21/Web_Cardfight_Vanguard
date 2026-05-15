import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameChoiceRequest,
  GamePieceStatusState,
  GameState,
  PhaseId,
  PieceId,
  PlayerId,
  RequestId,
  TransitionResult,
  ZoneId,
} from '../index'
import { PERSONA_RIDE_POWER_FLAG } from '../effects/first-effects'
import {
  applyGameAction,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

const PLAYER_1 = 'player-1' as PlayerId
const PLAYER_2 = 'player-2' as PlayerId
const PIECE_P1_DECK = 'piece-p1-deck' as PieceId
const PIECE_P1_HAND = 'piece-p1-hand' as PieceId
const PIECE_P1_REARGUARD = 'piece-p1-rearguard' as PieceId
const PIECE_P1_VANGUARD = 'piece-p1-vanguard' as PieceId
const PIECE_P2_VANGUARD = 'piece-p2-vanguard' as PieceId
const ZONE_P1_DECK = 'zone-p1-deck' as ZoneId
const ZONE_P1_HAND = 'zone-p1-hand' as ZoneId
const ZONE_P1_REARGUARD = 'zone-p1-rearguard' as ZoneId
const ZONE_P1_VANGUARD = 'zone-p1-vanguard' as ZoneId
const ZONE_P2_VANGUARD = 'zone-p2-vanguard' as ZoneId

interface TurnFixtureOptions {
  readonly status?: GameState['status']
  readonly phase?: PhaseId
  readonly turnNumber?: number
  readonly pendingRequests?: readonly GameChoiceRequest[]
  readonly pieceStates?: readonly GamePieceStatusState[]
}

function makeTurnState(options: TurnFixtureOptions = {}): GameState {
  const status = options.status ?? 'in_progress'
  const pendingRequests = options.pendingRequests ?? []

  return {
    gameId: 'game-turn-structure' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status,
    revision: 10,
    turn: {
      turnNumber: options.turnNumber ?? 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: options.phase ?? ('stand' as PhaseId),
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: status === 'completed' ? 'defeated' : 'active',
        ownedZoneIds: [
          ZONE_P1_DECK,
          ZONE_P1_HAND,
          ZONE_P1_VANGUARD,
          ZONE_P1_REARGUARD,
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: status === 'completed' ? 'active' : 'waiting',
        ownedZoneIds: [ZONE_P2_VANGUARD],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: ZONE_P1_DECK,
        kind: 'deck',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'owner-private',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: PIECE_P1_DECK,
          },
        ],
      },
      {
        zoneId: ZONE_P1_HAND,
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: PIECE_P1_HAND,
          },
        ],
      },
      {
        zoneId: ZONE_P1_VANGUARD,
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId: PIECE_P1_VANGUARD,
          },
        ],
      },
      {
        zoneId: ZONE_P1_REARGUARD,
        kind: 'rear_guard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId: PIECE_P1_REARGUARD,
          },
        ],
      },
      {
        zoneId: ZONE_P2_VANGUARD,
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId: PIECE_P2_VANGUARD,
          },
        ],
      },
    ],
    pieces: [
      makeCardPiece(PIECE_P1_DECK, 'card-p1-deck' as CardId, PLAYER_1),
      makeCardPiece(PIECE_P1_HAND, 'card-p1-hand' as CardId, PLAYER_1),
      makeCardPiece(
        PIECE_P1_REARGUARD,
        'card-p1-rearguard' as CardId,
        PLAYER_1,
      ),
      makeCardPiece(PIECE_P1_VANGUARD, 'card-p1-vanguard' as CardId, PLAYER_1),
      makeCardPiece(PIECE_P2_VANGUARD, 'card-p2-vanguard' as CardId, PLAYER_2),
    ],
    pieceStates: options.pieceStates ?? [],
    flags: [],
    pendingRequests,
  }
}

function makeCardPiece(
  pieceId: PieceId,
  cardDefinitionId: CardId,
  playerId: PlayerId,
): GameState['pieces'][number] {
  return {
    pieceId,
    kind: 'card',
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    cardDefinitionId,
  }
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-turn-1' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: PLAYER_1,
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

function expectApplied(result: TransitionResult) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error(`Expected applied transition, received ${result.status}.`)
  }

  return result
}

function expectInvalid(result: TransitionResult) {
  expect(isInvalidTransitionResult(result)).toBe(true)

  if (!isInvalidTransitionResult(result)) {
    throw new Error(`Expected invalid transition, received ${result.status}.`)
  }

  return result
}

function expectBlocked(result: TransitionResult) {
  expect(isBlockedTransitionResult(result)).toBe(true)

  if (!isBlockedTransitionResult(result)) {
    throw new Error(`Expected blocked transition, received ${result.status}.`)
  }

  return result
}

function advancePhase(
  currentState: GameState,
  nextPhase: string,
  actionId: string,
): TransitionResult {
  return applyGameAction(currentState, {
    action: {
      actionId: actionId as ActionId,
      type: 'system.advance_phase',
      actor: {
        kind: 'system',
        system: 'rules-engine',
      },
      nextPhase: nextPhase as PhaseId,
    },
    expectedRevision: currentState.revision,
  })
}

function endPhase(currentState: GameState, playerId = PLAYER_1) {
  return applyGameAction(currentState, {
    action: {
      actionId: 'action-end-phase' as ActionId,
      type: 'turn.end_phase',
      actor: {
        kind: 'player',
        playerId,
      },
    },
    expectedRevision: currentState.revision,
  })
}

function endTurn(currentState: GameState, playerId = PLAYER_1) {
  return applyGameAction(currentState, {
    action: {
      actionId: 'action-end-turn' as ActionId,
      type: 'turn.end_turn',
      actor: {
        kind: 'player',
        playerId,
      },
    },
    expectedRevision: currentState.revision,
  })
}

describe('turn structure enforcement', () => {
  it('advances through the legal turn lifecycle and applies stand/draw consequences', () => {
    const pregameState = makeTurnState({
      phase: 'pregame' as PhaseId,
      pieceStates: [
        {
          pieceId: PIECE_P1_VANGUARD,
          orientation: 'rest',
          flags: [],
        },
        {
          pieceId: PIECE_P1_REARGUARD,
          orientation: 'rest',
          flags: ['locked'],
        },
      ],
    })

    const standResult = expectApplied(
      advancePhase(pregameState, 'stand', 'action-advance-stand'),
    )

    expect(standResult.nextState.turn.phase).toBe('stand')
    expect(standResult.events.map((event) => event.type)).toEqual([
      'turn.phase_advanced',
      'piece.stood',
    ])
    expect(
      standResult.nextState.pieceStates.find(
        (pieceState) => pieceState.pieceId === PIECE_P1_VANGUARD,
      ),
    ).toBeUndefined()
    expect(
      standResult.nextState.pieceStates.find(
        (pieceState) => pieceState.pieceId === PIECE_P1_REARGUARD,
      ),
    ).toEqual({
      pieceId: PIECE_P1_REARGUARD,
      orientation: 'rest',
      flags: ['locked'],
    })

    const drawResult = expectApplied(
      advancePhase(standResult.nextState, 'draw', 'action-advance-draw'),
    )

    expect(drawResult.nextState.turn.phase).toBe('draw')
    expect(drawResult.events.map((event) => event.type)).toEqual([
      'turn.phase_advanced',
      'piece.moved',
      'cards.drawn',
    ])
    expect(
      drawResult.nextState.zones.find((zone) => zone.zoneId === ZONE_P1_DECK)
        ?.occupants,
    ).toEqual([])
    expect(
      drawResult.nextState.zones
        .find((zone) => zone.zoneId === ZONE_P1_HAND)
        ?.occupants.map((occupant) => occupant.pieceId),
    ).toEqual([PIECE_P1_HAND, PIECE_P1_DECK])

    let workingState = drawResult.nextState

    for (const [nextPhase, actionId] of [
      ['ride', 'action-advance-ride'],
      ['main', 'action-advance-main'],
      ['battle', 'action-advance-battle'],
      ['end', 'action-advance-end'],
    ] as const) {
      const result = expectApplied(
        advancePhase(workingState, nextPhase, actionId),
      )

      expect(result.nextState.turn.phase).toBe(nextPhase)
      expect(result.events[0]?.type).toBe('turn.phase_advanced')
      workingState = result.nextState
    }
  })

  it('rejects illegal phase jumps instead of trusting caller sequencing', () => {
    const result = expectInvalid(
      advancePhase(
        makeTurnState({ phase: 'stand' as PhaseId }),
        'battle',
        'action-skip-to-battle',
      ),
    )

    expect(result.code).toBe('invalid_action')
    expect(result.message).toContain('to draw, not battle')
  })

  it('lets the current turn player end a phase but rejects the wrong player', () => {
    const currentPlayerResult = expectApplied(
      endPhase(makeTurnState({ phase: 'ride' as PhaseId })),
    )

    expect(currentPlayerResult.nextState.turn.phase).toBe('main')
    expect(currentPlayerResult.events.map((event) => event.type)).toEqual([
      'turn.phase_advanced',
    ])

    const wrongPlayerResult = expectInvalid(
      endPhase(makeTurnState({ phase: 'ride' as PhaseId }), PLAYER_2),
    )

    expect(wrongPlayerResult.code).toBe('invalid_action')
    expect(wrongPlayerResult.message).toContain(
      'requires current turn player player-1',
    )
  })

  it('switches turns from end phase and clears turn-scoped runtime modifiers', () => {
    const result = expectApplied(
      endTurn(
        makeTurnState({
          phase: 'end' as PhaseId,
          turnNumber: 3,
          pieceStates: [
            {
              pieceId: PIECE_P1_VANGUARD,
              orientation: 'rest',
              flags: [PERSONA_RIDE_POWER_FLAG],
              powerModifier: 10000,
              criticalModifier: 1,
            },
            {
              pieceId: PIECE_P2_VANGUARD,
              orientation: 'rest',
              flags: [],
            },
          ],
        }),
      ),
    )

    expect(result.nextState.turn).toEqual({
      turnNumber: 4,
      turnPlayerId: PLAYER_2,
      priorityPlayerId: PLAYER_2,
      phase: 'stand',
    })
    expect(result.nextState.players.map((player) => player.status)).toEqual([
      'waiting',
      'active',
    ])
    expect(result.events.map((event) => event.type)).toEqual([
      'turn.ended',
      'turn.cleanup_applied',
      'turn.started',
      'piece.stood',
    ])
    expect(result.events[1]).toMatchObject({
      type: 'turn.cleanup_applied',
      cleanedPieceIds: [PIECE_P1_VANGUARD],
      removedFlagPieceIds: [PIECE_P1_VANGUARD],
      clearedModifierPieceIds: [PIECE_P1_VANGUARD],
    })
    expect(
      result.nextState.pieceStates.find(
        (pieceState) => pieceState.pieceId === PIECE_P1_VANGUARD,
      ),
    ).toEqual({
      pieceId: PIECE_P1_VANGUARD,
      orientation: 'rest',
      flags: [],
    })
    expect(
      result.nextState.pieceStates.find(
        (pieceState) => pieceState.pieceId === PIECE_P2_VANGUARD,
      ),
    ).toBeUndefined()
  })

  it('rejects turn switch before the end phase', () => {
    const result = expectInvalid(
      endTurn(makeTurnState({ phase: 'battle' as PhaseId })),
    )

    expect(result.code).toBe('invalid_action')
    expect(result.message).toContain('can switch turns only from the end phase')
  })

  it('enforces phase legality for ride, call, and battle actions', () => {
    const rideResult = expectInvalid(
      applyGameAction(makeTurnState({ phase: 'main' as PhaseId }), {
        action: {
          actionId: 'action-ride-wrong-phase' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          pieceId: PIECE_P1_HAND,
          from: {
            zoneId: ZONE_P1_HAND,
          },
          to: {
            zoneId: ZONE_P1_VANGUARD,
          },
          ridingOverPieceId: PIECE_P1_VANGUARD,
        },
      }),
    )

    expect(rideResult.message).toContain('requires ride phase')

    const callResult = expectInvalid(
      applyGameAction(makeTurnState({ phase: 'ride' as PhaseId }), {
        action: {
          actionId: 'action-call-wrong-phase' as ActionId,
          type: 'card.call',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          pieceId: PIECE_P1_HAND,
          from: {
            zoneId: ZONE_P1_HAND,
          },
          to: {
            zoneId: ZONE_P1_REARGUARD,
          },
        },
      }),
    )

    expect(callResult.message).toContain('requires main phase')

    const attackResult = expectInvalid(
      applyGameAction(makeTurnState({ phase: 'main' as PhaseId }), {
        action: {
          actionId: 'action-attack-wrong-phase' as ActionId,
          type: 'battle.declare_attack',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          attackerPieceId: PIECE_P1_VANGUARD,
          target: {
            kind: 'piece',
            pieceId: PIECE_P2_VANGUARD,
          },
        },
      }),
    )

    expect(attackResult.message).toContain('requires battle phase')
  })

  it('blocks phase progression while a pending request is unresolved', () => {
    const result = expectBlocked(
      endPhase(
        makeTurnState({
          status: 'awaiting_choice',
          phase: 'ride' as PhaseId,
          pendingRequests: [makePendingRequest()],
        }),
      ),
    )

    expect(result.code).toBe('pending_request')
    expect(result.blockingRequests).toHaveLength(1)
  })

  it('rejects turn progression after terminal match state', () => {
    const result = expectInvalid(
      endTurn(makeTurnState({ status: 'completed', phase: 'end' as PhaseId })),
    )

    expect(result.code).toBe('invalid_action')
    expect(result.message).toContain('requires the match to be in progress')
  })
})
