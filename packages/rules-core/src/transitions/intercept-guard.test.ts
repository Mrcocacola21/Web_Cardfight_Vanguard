import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameState,
  PieceId,
  PlayerId,
  TransitionResult,
  ZoneId,
  ZoneSlotId,
} from '../index'
import {
  applyGameAction,
  applyGameChoiceResponse,
  isAppliedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

const PLAYER_1 = 'player-1' as PlayerId
const PLAYER_2 = 'player-2' as PlayerId
const P1_ATTACKER = 'piece-p1-attacker' as PieceId
const P1_VANGUARD = 'piece-p1-vanguard' as PieceId
const P2_VANGUARD = 'piece-p2-vanguard' as PieceId
const P2_HAND_GUARD = 'piece-p2-hand-guard' as PieceId
const P2_FRONT_INTERCEPT = 'piece-p2-front-intercept' as PieceId
const P2_BACK_GRADE_2 = 'piece-p2-back-grade-2' as PieceId
const ZONE_P1_VANGUARD = 'zone-p1-vanguard' as ZoneId
const ZONE_P1_REARGUARD = 'zone-p1-rearguard' as ZoneId
const ZONE_P2_VANGUARD = 'zone-p2-vanguard' as ZoneId
const ZONE_P2_REARGUARD = 'zone-p2-rearguard' as ZoneId
const ZONE_P2_HAND = 'zone-p2-hand' as ZoneId
const ZONE_P2_GUARDIAN = 'zone-p2-guardian' as ZoneId
const ZONE_P2_DROP = 'zone-p2-drop' as ZoneId

describe('intercept guard foundation', () => {
  it('adds legal front-row interceptors to guard choices and shield math', () => {
    const attackResult = expectApplied(declareAttack(makeInterceptState()))
    const guardRequestResult = expectApplied(
      requestGuard(attackResult.nextState),
    )
    const request = guardRequestResult.nextState.pendingRequests[0]

    expect(request?.type).toBe('battle.guard_select')

    if (request?.type !== 'battle.guard_select') {
      throw new Error('Expected battle.guard_select request.')
    }

    expect(request.handPieceIds).toEqual([P2_HAND_GUARD])
    expect(request.interceptPieceIds).toEqual([P2_FRONT_INTERCEPT])
    expect(request.eligiblePieceIds).toEqual([
      P2_HAND_GUARD,
      P2_FRONT_INTERCEPT,
    ])

    const guardResult = expectApplied(
      applyGameChoiceResponse(guardRequestResult.nextState, {
        response: {
          requestId: request.requestId,
          responderPlayerId: PLAYER_2,
          type: 'answer.guard',
          selectedPieceIds: [P2_FRONT_INTERCEPT],
        },
        expectedRevision: guardRequestResult.nextState.revision,
      }),
    )

    expect(guardResult.events.map((event) => event.type)).toEqual([
      'choice.response_resolved',
      'piece.moved',
      'battle.intercept_declared',
      'battle.guard_declared',
    ])
    expect(
      guardResult.nextState.zones
        .find((zone) => zone.zoneId === ZONE_P2_GUARDIAN)
        ?.occupants.map((occupant) => occupant.pieceId),
    ).toEqual([P2_FRONT_INTERCEPT])
    expect(guardResult.nextState.battle?.guardPieceIds).toEqual([
      P2_FRONT_INTERCEPT,
    ])

    const battleId = guardResult.nextState.battle?.battleId

    expect(battleId).toBeDefined()

    if (battleId === undefined) {
      throw new Error('Expected active battle after guard resolution.')
    }

    const combatResult = expectApplied(
      applyGameAction(guardResult.nextState, {
        action: {
          actionId: 'action-resolve-combat' as ActionId,
          type: 'system.resolve_combat',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId,
        },
        expectedRevision: guardResult.nextState.revision,
      }),
    )

    expect(combatResult.nextState.battle?.combat).toMatchObject({
      attackPower: 15000,
      shieldPower: 10000,
      totalDefensePower: 20000,
      result: 'miss',
    })
    expect(combatResult.events.map((event) => event.type)).toEqual([
      'battle.combat_resolved',
      'battle.attack_missed',
    ])

    const completionResult = expectApplied(
      applyGameAction(combatResult.nextState, {
        action: {
          actionId: 'action-complete-intercept-battle' as ActionId,
          type: 'system.resolve_mandatory_flow',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          scope: 'battle',
        },
        expectedRevision: combatResult.nextState.revision,
      }),
    )

    expect(completionResult.nextState.battle).toBeUndefined()
    expect(completionResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.guardians_cleaned_up',
      'battle.completed',
    ])
    expect(completionResult.events[1]).toMatchObject({
      type: 'battle.guardians_cleaned_up',
      guardPieceIds: [P2_FRONT_INTERCEPT],
      fromZoneId: ZONE_P2_GUARDIAN,
      toZoneId: ZONE_P2_DROP,
    })
    expect(
      completionResult.nextState.zones.find(
        (zone) => zone.zoneId === ZONE_P2_GUARDIAN,
      )?.occupants,
    ).toEqual([])
    expect(
      completionResult.nextState.zones.find(
        (zone) => zone.zoneId === ZONE_P2_DROP,
      )?.occupants,
    ).toEqual([{ pieceId: P2_FRONT_INTERCEPT }])
  })

  it('rejects intercept selection from a non-front-row unit', () => {
    const attackResult = expectApplied(declareAttack(makeInterceptState()))
    const guardRequestResult = expectApplied(
      requestGuard(attackResult.nextState),
    )
    const request = guardRequestResult.nextState.pendingRequests[0]

    if (request?.type !== 'battle.guard_select') {
      throw new Error('Expected battle.guard_select request.')
    }

    expect(request.interceptPieceIds).not.toContain(P2_BACK_GRADE_2)

    const invalidResult = expectInvalid(
      applyGameChoiceResponse(guardRequestResult.nextState, {
        response: {
          requestId: request.requestId,
          responderPlayerId: PLAYER_2,
          type: 'answer.guard',
          selectedPieceIds: [P2_BACK_GRADE_2],
        },
        expectedRevision: guardRequestResult.nextState.revision,
      }),
    )

    expect(invalidResult.code).toBe('request_response_mismatch')
    expect(invalidResult.message).toContain('not allowed')
  })
})

function declareAttack(state: GameState): TransitionResult {
  return applyGameAction(state, {
    action: {
      actionId: 'action-declare-attack' as ActionId,
      type: 'battle.declare_attack',
      actor: {
        kind: 'player',
        playerId: PLAYER_1,
      },
      attackerPieceId: P1_ATTACKER,
      target: {
        kind: 'piece',
        pieceId: P2_VANGUARD,
      },
    },
    expectedRevision: state.revision,
  })
}

function requestGuard(state: GameState): TransitionResult {
  return applyGameAction(state, {
    action: {
      actionId: 'action-request-guard' as ActionId,
      type: 'battle.guard',
      actor: {
        kind: 'player',
        playerId: PLAYER_2,
      },
      againstAttackerPieceId: P1_ATTACKER,
    },
    expectedRevision: state.revision,
  })
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

function makeInterceptState(): GameState {
  return {
    gameId: 'game-intercept-foundation' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 2,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'battle' as GameState['turn']['phase'],
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: [ZONE_P1_VANGUARD, ZONE_P1_REARGUARD],
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [
          ZONE_P2_VANGUARD,
          ZONE_P2_REARGUARD,
          ZONE_P2_HAND,
          ZONE_P2_GUARDIAN,
          ZONE_P2_DROP,
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      makeSingleZone(ZONE_P1_VANGUARD, PLAYER_1, 'vanguard_circle', [
        P1_VANGUARD,
      ]),
      {
        zoneId: ZONE_P1_REARGUARD,
        kind: 'rear_guard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_1,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: ['p1:front-left' as ZoneSlotId],
        },
        occupants: [
          {
            pieceId: P1_ATTACKER,
            slotId: 'p1:front-left' as ZoneSlotId,
          },
        ],
      },
      makeSingleZone(ZONE_P2_VANGUARD, PLAYER_2, 'vanguard_circle', [
        P2_VANGUARD,
      ]),
      {
        zoneId: ZONE_P2_REARGUARD,
        kind: 'rear_guard_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: [
            'p2:front-left' as ZoneSlotId,
            'p2:back-left' as ZoneSlotId,
          ],
        },
        occupants: [
          {
            pieceId: P2_FRONT_INTERCEPT,
            slotId: 'p2:front-left' as ZoneSlotId,
          },
          {
            pieceId: P2_BACK_GRADE_2,
            slotId: 'p2:back-left' as ZoneSlotId,
          },
        ],
      },
      {
        zoneId: ZONE_P2_HAND,
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [{ pieceId: P2_HAND_GUARD }],
      },
      {
        zoneId: ZONE_P2_GUARDIAN,
        kind: 'guardian_circle',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
      {
        zoneId: ZONE_P2_DROP,
        kind: 'drop',
        scope: 'player',
        ownerPlayerId: PLAYER_2,
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
    ],
    pieces: [
      makePiece(P1_ATTACKER, PLAYER_1, 'card-p1-attacker' as CardId),
      makePiece(P1_VANGUARD, PLAYER_1, 'card-p1-vanguard' as CardId),
      makePiece(P2_VANGUARD, PLAYER_2, 'card-p2-vanguard' as CardId),
      makePiece(P2_HAND_GUARD, PLAYER_2, 'card-p2-hand-guard' as CardId),
      makePiece(
        P2_FRONT_INTERCEPT,
        PLAYER_2,
        'card-p2-front-intercept' as CardId,
      ),
      makePiece(P2_BACK_GRADE_2, PLAYER_2, 'card-p2-back-grade-2' as CardId),
    ],
    cardStats: {
      cards: [
        stats('card-p1-attacker' as CardId, 1, 15000, 0),
        stats('card-p1-vanguard' as CardId, 1, 10000, 0),
        stats('card-p2-vanguard' as CardId, 1, 10000, 0),
        stats('card-p2-hand-guard' as CardId, 1, 8000, 5000),
        stats('card-p2-front-intercept' as CardId, 2, 10000, 10000),
        stats('card-p2-back-grade-2' as CardId, 2, 10000, 10000),
      ],
    },
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function makeSingleZone(
  zoneId: ZoneId,
  playerId: PlayerId,
  kind: string,
  pieceIds: readonly PieceId[],
): GameState['zones'][number] {
  return {
    zoneId,
    kind,
    scope: 'player',
    ownerPlayerId: playerId,
    visibility: 'public',
    layout: {
      ordering: 'unordered',
      occupancy: 'single',
    },
    occupants: pieceIds.map((pieceId) => ({ pieceId })),
  }
}

function makePiece(
  pieceId: PieceId,
  playerId: PlayerId,
  cardDefinitionId: CardId,
): GameState['pieces'][number] {
  return {
    pieceId,
    kind: 'card',
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    cardDefinitionId,
  }
}

function stats(
  cardDefinitionId: CardId,
  grade: 1 | 2,
  power: number,
  shield: number,
): NonNullable<GameState['cardStats']>['cards'][number] {
  return {
    cardDefinitionId,
    cardType: 'normal-unit',
    grade,
    power,
    shield,
    critical: 1,
    triggerType: null,
    keywords: [],
  }
}
