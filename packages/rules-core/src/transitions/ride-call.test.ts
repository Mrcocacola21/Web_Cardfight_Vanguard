import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameChoiceRequest,
  GameState,
  RequestId,
  TransitionResult,
  ZoneSlotId,
} from '../index'
import {
  applyGameAction,
  buildEngineCardStatsSnapshot,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

interface BoardStateOptions {
  readonly callGrade?: number
  readonly currentVanguardGrade?: number
  readonly includeCardStats?: boolean
  readonly pendingRequests?: readonly GameChoiceRequest[]
  readonly rideGrade?: number
}

function makeBoardState(options: BoardStateOptions = {}): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const includeCardStats = options.includeCardStats ?? true

  return {
    gameId: 'game-board-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress',
    revision: 2,
    turn: {
      turnNumber: 1,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'ride' as GameState['turn']['phase'],
      step: 'main' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          'zone-p1-soul' as GameState['zones'][number]['zoneId'],
          'zone-p1-drop' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [
          'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          },
          {
            pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
        kind: 'rear_guard_circle',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: ['slot-left' as ZoneSlotId, 'slot-right' as ZoneSlotId],
        },
        occupants: [],
      },
      {
        zoneId: 'zone-p1-soul' as GameState['zones'][number]['zoneId'],
        kind: 'soul',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
      {
        zoneId: 'zone-p1-drop' as GameState['zones'][number]['zoneId'],
        kind: 'drop',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
      {
        zoneId: 'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId:
              'piece-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
    ],
    pieces: [
      {
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-ride' as CardId,
      },
      {
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-call' as CardId,
      },
      {
        pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-vanguard' as CardId,
      },
      {
        pieceId:
          'piece-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-opponent-vanguard' as CardId,
      },
    ],
    ...(includeCardStats
      ? {
          cardStats: buildEngineCardStatsSnapshot([
            makeUnitStats('card-ride' as CardId, options.rideGrade ?? 1),
            makeUnitStats('card-call' as CardId, options.callGrade ?? 0),
            makeUnitStats(
              'card-vanguard' as CardId,
              options.currentVanguardGrade ?? 0,
            ),
            makeUnitStats('card-opponent-vanguard' as CardId, 0),
          ]),
        }
      : {}),
    pieceStates: [],
    flags: [],
    pendingRequests,
  }
}

function makeUnitStats(
  cardDefinitionId: CardId,
  grade: number,
): NonNullable<GameState['cardStats']>['cards'][number] {
  return {
    cardDefinitionId,
    cardType: 'normal-unit',
    grade: grade as NonNullable<
      GameState['cardStats']
    >['cards'][number]['grade'],
    power: 8000,
    shield: 5000,
    critical: 1,
    triggerType: null,
    keywords: [],
  }
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-ride-call-1' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
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

describe('@web-vg/rules-core ride / call mechanics', () => {
  it('rides onto the vanguard circle, moves the previous vanguard to soul, and preserves piece identity', () => {
    const state = makeBoardState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-ride-1' as ActionId,
        type: 'card.ride' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        },
        ridingOverPieceId:
          'piece-vanguard' as GameState['pieces'][number]['pieceId'],
      },
      expectedRevision: state.revision,
    })
    const appliedResult = expectApplied(result)
    const handZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-hand' as GameState['zones'][number]['zoneId']),
    )
    const vanguardZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-vanguard' as GameState['zones'][number]['zoneId']),
    )
    const soulZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-soul' as GameState['zones'][number]['zoneId']),
    )

    expect(handZone?.occupants).toEqual([
      {
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(vanguardZone?.occupants).toEqual([
      {
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(soulZone?.occupants).toEqual([
      {
        pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(appliedResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
    ])
    expect(appliedResult.events[0]).toMatchObject({
      type: 'piece.moved',
      reason: 'ride_displacement',
    })
    expect(appliedResult.events[1]).toMatchObject({
      type: 'piece.moved',
      reason: 'ride',
    })
  })

  it.each([
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 2],
    [2, 3],
    [3, 3],
  ])(
    'allows normal ride grade progression from grade %i to grade %i',
    (currentVanguardGrade, rideGrade) => {
      const state = makeBoardState({
        currentVanguardGrade,
        rideGrade,
      })
      const result = applyGameAction(state, {
        action: {
          actionId:
            `action-ride-grade-${currentVanguardGrade}-${rideGrade}` as ActionId,
          type: 'card.ride' as const,
          actor: {
            kind: 'player' as const,
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
      })

      expectApplied(result)
    },
  )

  it.each([
    [0, 2],
    [1, 3],
    [2, 0],
  ])(
    'rejects illegal normal ride grade progression from grade %i to grade %i',
    (currentVanguardGrade, rideGrade) => {
      const state = makeBoardState({
        currentVanguardGrade,
        rideGrade,
      })
      const result = applyGameAction(state, {
        action: {
          actionId:
            `action-ride-grade-invalid-${currentVanguardGrade}-${rideGrade}` as ActionId,
          type: 'card.ride' as const,
          actor: {
            kind: 'player' as const,
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
      })
      const invalidResult = expectInvalid(result)

      expect(invalidResult.code).toBe('ride_grade_restricted')
      expect(invalidResult.currentState).toEqual(state)
      expect(invalidResult.events).toEqual([])
    },
  )

  it('rejects normal ride when card stats are missing instead of guessing grade', () => {
    const state = makeBoardState({
      includeCardStats: false,
    })
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-ride-missing-stats' as ActionId,
        type: 'card.ride' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        },
        ridingOverPieceId:
          'piece-vanguard' as GameState['pieces'][number]['pieceId'],
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action_reference')
    expect(invalidResult.message).toMatch(/card stats snapshot/i)
  })

  it('rejects rides that target a rear-guard circle instead of the vanguard circle', () => {
    const state = makeBoardState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-ride-invalid-1' as ActionId,
        type: 'card.ride' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.currentState).toEqual(state)
  })

  it('calls from hand into an open rear-guard slot and emits call facts', () => {
    const baseState = makeBoardState({
      callGrade: 1,
      currentVanguardGrade: 1,
    })
    const state: GameState = {
      ...baseState,
      turn: {
        ...baseState.turn,
        phase: 'main' as GameState['turn']['phase'],
      },
    }
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-call-1' as ActionId,
        type: 'card.call' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
      },
      expectedRevision: state.revision,
    })
    const appliedResult = expectApplied(result)
    const handZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-hand' as GameState['zones'][number]['zoneId']),
    )
    const rearGuardZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-rearguard' as GameState['zones'][number]['zoneId']),
    )

    expect(handZone?.occupants).toEqual([
      {
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(rearGuardZone?.occupants).toEqual([
      {
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
        slotId: 'slot-left' as ZoneSlotId,
      },
    ])
    expect(appliedResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'card.called',
    ])
    expect(appliedResult.events[0]).toMatchObject({
      type: 'piece.moved',
      reason: 'call',
    })
  })

  it('rejects normal calls above the current vanguard grade', () => {
    const baseState = makeBoardState({
      callGrade: 2,
      currentVanguardGrade: 1,
    })
    const state: GameState = {
      ...baseState,
      turn: {
        ...baseState.turn,
        phase: 'main' as GameState['turn']['phase'],
      },
    }
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-call-grade-invalid' as ActionId,
        type: 'card.call' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
      },
      expectedRevision: state.revision,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('call_grade_restricted')
    expect(invalidResult.currentState).toEqual(state)
    expect(invalidResult.events).toEqual([])
  })

  it('rejects normal calls when card stats are missing instead of allowing blind calls', () => {
    const baseState = makeBoardState({
      includeCardStats: false,
    })
    const state: GameState = {
      ...baseState,
      turn: {
        ...baseState.turn,
        phase: 'main' as GameState['turn']['phase'],
      },
    }
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-call-missing-stats' as ActionId,
        type: 'card.call' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
      },
      expectedRevision: state.revision,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action_reference')
    expect(invalidResult.message).toMatch(/card stats snapshot/i)
  })

  it('rejects occupied rear-guard slot calls without corrupting state', () => {
    const baseState = makeBoardState()
    const state: GameState = {
      ...baseState,
      turn: {
        ...baseState.turn,
        phase: 'main' as GameState['turn']['phase'],
      },
    }
    const occupiedState: GameState = {
      ...state,
      zones: state.zones.map((zone) =>
        zone.zoneId ===
        ('zone-p1-rearguard' as GameState['zones'][number]['zoneId'])
          ? {
              ...zone,
              occupants: [
                {
                  pieceId:
                    'piece-occupied-call' as GameState['pieces'][number]['pieceId'],
                  slotId: 'slot-left' as ZoneSlotId,
                },
              ],
            }
          : zone,
      ),
      pieces: [
        ...state.pieces,
        {
          pieceId:
            'piece-occupied-call' as GameState['pieces'][number]['pieceId'],
          kind: 'card',
          ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
          controllerPlayerId:
            'player-1' as GameState['players'][number]['playerId'],
          cardDefinitionId: 'card-occupied-call' as CardId,
        },
      ],
      cardStats: buildEngineCardStatsSnapshot([
        ...(state.cardStats?.cards ?? []),
        makeUnitStats('card-occupied-call' as CardId, 0),
      ]),
    }
    const result = applyGameAction(occupiedState, {
      action: {
        actionId: 'action-call-invalid-1' as ActionId,
        type: 'card.call' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.currentState).toEqual(occupiedState)
  })

  it('blocks board-development actions while the engine is waiting on a request', () => {
    const pendingRequest = makePendingRequest()
    const state = makeBoardState({
      pendingRequests: [pendingRequest],
    })
    const rideResult = applyGameAction(state, {
      action: {
        actionId: 'action-ride-blocked-1' as ActionId,
        type: 'card.ride' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        },
      },
    })
    const blockedResult = expectBlocked(rideResult)

    expect(blockedResult.code).toBe('pending_request')
    expect(blockedResult.blockingRequests).toEqual([pendingRequest])
  })

  it('blocks calls while the engine is waiting on a request', () => {
    const pendingRequest = makePendingRequest()
    const state = makeBoardState({
      pendingRequests: [pendingRequest],
    })
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-call-blocked-1' as ActionId,
        type: 'card.call' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-right' as ZoneSlotId,
        },
      },
    })
    const blockedResult = expectBlocked(result)

    expect(blockedResult.code).toBe('pending_request')
    expect(blockedResult.blockingRequests).toEqual([pendingRequest])
  })

  it('rejects ride and call attempts while an unresolved battle owns sequencing', () => {
    const state: GameState = {
      ...makeBoardState(),
      battle: {
        battleId: 'battle-ride-call-sequence-1' as NonNullable<
          GameState['battle']
        >['battleId'],
        status: 'attack_declared',
        attackingPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        defendingPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        attackerPieceId:
          'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        attackerZoneId:
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        target: {
          kind: 'player',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
        },
        guardPieceIds: [],
      },
    }
    const rideResult = applyGameAction(state, {
      action: {
        actionId: 'action-ride-sequence-invalid-1' as ActionId,
        type: 'card.ride',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        },
      },
      expectedRevision: state.revision,
    })
    const callResult = applyGameAction(state, {
      action: {
        actionId: 'action-call-sequence-invalid-1' as ActionId,
        type: 'card.call',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-call' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
      },
      expectedRevision: state.revision,
    })
    const invalidRide = expectInvalid(rideResult)
    const invalidCall = expectInvalid(callResult)

    expect(invalidRide.code).toBe('invalid_action')
    expect(invalidCall.code).toBe('invalid_action')
    expect(invalidRide.currentState).toEqual(state)
    expect(invalidCall.currentState).toEqual(state)
    expect(invalidRide.events).toEqual([])
    expect(invalidCall.events).toEqual([])
  })
})
