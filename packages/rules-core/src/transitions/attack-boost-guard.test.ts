import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameChoiceRequest,
  GameChoiceResponseSubmission,
  GameState,
  RequestId,
  TransitionResult,
  ZoneSlotId,
} from '../index'
import {
  applyGameAction,
  applyGameChoiceResponse,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

function makeBattleReadyState(
  options: {
    readonly pendingRequests?: readonly GameChoiceRequest[]
    readonly battle?: GameState['battle']
  } = {},
): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status = pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress'

  return {
    gameId: 'game-battle-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status,
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'battle' as GameState['turn']['phase'],
      step: 'attack-window' as NonNullable<GameState['turn']['step']>,
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
          'zone-p2-hand' as GameState['zones'][number]['zoneId'],
          'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
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
            pieceId: 'piece-p1-hand' as GameState['pieces'][number]['pieceId'],
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
            pieceId:
              'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
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
        occupants: [
          {
            pieceId:
              'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
            slotId: 'slot-right' as ZoneSlotId,
          },
        ],
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
              'piece-p2-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p2-hand' as GameState['zones'][number]['zoneId'],
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId:
              'piece-p2-guard-1' as GameState['pieces'][number]['pieceId'],
          },
          {
            pieceId:
              'piece-p2-guard-2' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p2-guardian' as GameState['zones'][number]['zoneId'],
        kind: 'guardian_circle',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
    ],
    pieces: [
      {
        pieceId: 'piece-p1-hand' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p1-hand' as CardId,
      },
      {
        pieceId: 'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p1-vanguard' as CardId,
      },
      {
        pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p1-booster' as CardId,
      },
      {
        pieceId: 'piece-p2-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p2-vanguard' as CardId,
      },
      {
        pieceId: 'piece-p2-guard-1' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p2-guard-1' as CardId,
      },
      {
        pieceId: 'piece-p2-guard-2' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-p2-guard-2' as CardId,
      },
    ],
    pieceStates: [],
    flags: [],
    ...(options.battle === undefined ? {} : { battle: options.battle }),
    pendingRequests,
  }
}

function makeConfirmRequest(
  requestId = 'request-battle-block-1',
): GameChoiceRequest {
  return {
    requestId: requestId as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'battle',
    visibility: 'responder-only',
  }
}

function expectApplied(result: TransitionResult) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error(
      `Expected an applied transition result, received ${result.status}.`,
    )
  }

  return result
}

function expectBlocked(result: TransitionResult) {
  expect(isBlockedTransitionResult(result)).toBe(true)

  if (!isBlockedTransitionResult(result)) {
    throw new Error(
      `Expected a blocked transition result, received ${result.status}.`,
    )
  }

  return result
}

function expectInvalid(result: TransitionResult) {
  expect(isInvalidTransitionResult(result)).toBe(true)

  if (!isInvalidTransitionResult(result)) {
    throw new Error(
      `Expected an invalid transition result, received ${result.status}.`,
    )
  }

  return result
}

function declareAttack(state: GameState): TransitionResult {
  return applyGameAction(state, {
    action: {
      actionId: 'action-attack-1' as ActionId,
      type: 'battle.declare_attack',
      actor: {
        kind: 'player',
        playerId: 'player-1' as GameState['players'][number]['playerId'],
      },
      attackerPieceId:
        'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
      target: {
        kind: 'player',
        playerId: 'player-2' as GameState['players'][number]['playerId'],
      },
    },
    expectedRevision: state.revision,
  })
}

describe('@web-vg/rules-core attack / boost / guard foundation', () => {
  it('declares an attack and creates coherent battle state', () => {
    const state = makeBattleReadyState()
    const result = declareAttack(state)
    const repeatedResult = declareAttack(state)
    const appliedResult = expectApplied(result)

    expect(result).toEqual(repeatedResult)
    expect(appliedResult.nextState.battle).toMatchObject({
      status: 'attack_declared',
      attackingPlayerId: 'player-1',
      defendingPlayerId: 'player-2',
      attackerPieceId: 'piece-p1-vanguard',
      attackerZoneId: 'zone-p1-vanguard',
      guardPieceIds: [],
    })
    expect(appliedResult.nextState.pieceStates).toEqual([
      {
        pieceId: 'piece-p1-vanguard',
        orientation: 'rest',
        flags: [],
      },
    ])
    expect(appliedResult.events.map((event) => event.type)).toEqual([
      'piece.rested',
      'battle.attack_declared',
    ])
    expect(appliedResult.timingWindows).toEqual([
      expect.objectContaining({
        sequence: 0,
        window: 'before',
        point: 'battle.attack',
        relatedEventSequence: 1,
      }),
      expect.objectContaining({
        sequence: 1,
        window: 'on',
        point: 'battle.attack',
        relatedEventSequence: 1,
      }),
      expect.objectContaining({
        sequence: 2,
        window: 'after',
        point: 'battle.attack',
        relatedEventSequence: 1,
      }),
    ])
  })

  it('rejects attacks from non-battle zones structurally', () => {
    const state = makeBattleReadyState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-attack-invalid-zone-1' as ActionId,
        type: 'battle.declare_attack',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        attackerPieceId:
          'piece-p1-hand' as GameState['pieces'][number]['pieceId'],
        target: {
          kind: 'player',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
        },
      },
      expectedRevision: state.revision,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.message).toMatch(/vanguard or rear-guard circle/i)
  })

  it('commits a boost onto the current battle and prevents duplicate boosting', () => {
    const state = makeBattleReadyState()
    const attackResult = expectApplied(declareAttack(state))
    const firstBoostResult = applyGameAction(attackResult.nextState, {
      action: {
        actionId: 'action-boost-1' as ActionId,
        type: 'battle.commit_boost',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        attackerPieceId:
          'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        boosterPieceId:
          'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
      },
      expectedRevision: attackResult.nextState.revision,
    })
    const appliedBoostResult = expectApplied(firstBoostResult)

    expect(appliedBoostResult.nextState.battle).toMatchObject({
      status: 'boost_declared',
      boostingPieceId: 'piece-p1-booster',
      boostingZoneId: 'zone-p1-rearguard',
    })
    expect(appliedBoostResult.nextState.pieceStates).toEqual([
      {
        pieceId: 'piece-p1-vanguard',
        orientation: 'rest',
        flags: [],
      },
      {
        pieceId: 'piece-p1-booster',
        orientation: 'rest',
        flags: [],
      },
    ])
    expect(appliedBoostResult.events.map((event) => event.type)).toEqual([
      'piece.rested',
      'battle.boost_declared',
    ])

    const duplicateBoostResult = applyGameAction(appliedBoostResult.nextState, {
      action: {
        actionId: 'action-boost-2' as ActionId,
        type: 'battle.commit_boost',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        attackerPieceId:
          'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        boosterPieceId:
          'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
      },
      expectedRevision: appliedBoostResult.nextState.revision,
    })
    const invalidResult = expectInvalid(duplicateBoostResult)

    expect(invalidResult.code).toBe('invalid_action')
  })

  it('rejects already-rested boosters without corrupting the active battle state', () => {
    const state: GameState = {
      ...makeBattleReadyState(),
      pieceStates: [
        {
          pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
          orientation: 'rest',
          flags: [],
        },
      ],
    }
    const attackResult = expectApplied(declareAttack(state))
    const boostResult = applyGameAction(attackResult.nextState, {
      action: {
        actionId: 'action-boost-rested-invalid-1' as ActionId,
        type: 'battle.commit_boost',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        attackerPieceId:
          'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        boosterPieceId:
          'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
      },
      expectedRevision: attackResult.nextState.revision,
    })
    const invalidResult = expectInvalid(boostResult)

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.message).toMatch(/already rested/i)
    expect(invalidResult.currentState).toEqual(attackResult.nextState)
    expect(invalidResult.events).toEqual([])
  })

  it('opens an engine-owned guard request for the defending player', () => {
    const state = makeBattleReadyState()
    const attackResult = expectApplied(declareAttack(state))
    const guardResult = applyGameAction(attackResult.nextState, {
      action: {
        actionId: 'action-guard-request-1' as ActionId,
        type: 'battle.guard',
        actor: {
          kind: 'player',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
        },
        againstAttackerPieceId:
          'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
      },
      expectedRevision: attackResult.nextState.revision,
    })
    const appliedGuardResult = expectApplied(guardResult)
    const guardRequest = appliedGuardResult.nextState.pendingRequests[0]

    expect(appliedGuardResult.nextState.status).toBe('awaiting_choice')
    expect(appliedGuardResult.nextState.battle).toMatchObject({
      status: 'guard_requested',
      attackerPieceId: 'piece-p1-vanguard',
      guardZoneId: 'zone-p2-guardian',
    })
    expect(appliedGuardResult.events.map((event) => event.type)).toEqual([
      'battle.guard_requested',
    ])
    expect(guardRequest?.type).toBe('battle.guard_select')
  })

  it('resolves guard commitment through choice response and moves guardians into the guardian circle', () => {
    const state = makeBattleReadyState()
    const attackResult = expectApplied(declareAttack(state))
    const guardResult = expectApplied(
      applyGameAction(attackResult.nextState, {
        action: {
          actionId: 'action-guard-request-2' as ActionId,
          type: 'battle.guard',
          actor: {
            kind: 'player',
            playerId: 'player-2' as GameState['players'][number]['playerId'],
          },
          againstAttackerPieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: attackResult.nextState.revision,
      }),
    )
    const request = guardResult.nextState.pendingRequests[0]

    if (request?.type !== 'battle.guard_select') {
      throw new Error('Expected a battle.guard_select request.')
    }

    const response: GameChoiceResponseSubmission = {
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.guard',
        selectedPieceIds: [
          'piece-p2-guard-1' as GameState['pieces'][number]['pieceId'],
          'piece-p2-guard-2' as GameState['pieces'][number]['pieceId'],
        ],
      },
      expectedRevision: guardResult.nextState.revision,
    }
    const resolutionResult = applyGameChoiceResponse(
      guardResult.nextState,
      response,
    )
    const appliedResolutionResult = expectApplied(resolutionResult)
    const handZone = appliedResolutionResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p2-hand' as GameState['zones'][number]['zoneId']),
    )
    const guardianZone = appliedResolutionResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p2-guardian' as GameState['zones'][number]['zoneId']),
    )

    expect(appliedResolutionResult.nextState.status).toBe('in_progress')
    expect(appliedResolutionResult.nextState.pendingRequests).toEqual([])
    expect(appliedResolutionResult.nextState.battle).toMatchObject({
      status: 'guard_resolved',
      guardPieceIds: ['piece-p2-guard-1', 'piece-p2-guard-2'],
      guardZoneId: 'zone-p2-guardian',
    })
    expect(handZone?.occupants).toEqual([])
    expect(guardianZone?.occupants).toEqual([
      {
        pieceId: 'piece-p2-guard-1' as GameState['pieces'][number]['pieceId'],
      },
      {
        pieceId: 'piece-p2-guard-2' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(appliedResolutionResult.events.map((event) => event.type)).toEqual([
      'choice.response_resolved',
      'piece.moved',
      'piece.moved',
      'battle.guard_declared',
    ])
    expect(appliedResolutionResult.events[0]).toMatchObject({
      type: 'choice.response_resolved',
      outcome: 'selection_made',
      selectedPieceIds: ['piece-p2-guard-1', 'piece-p2-guard-2'],
    })
    expect(
      appliedResolutionResult.events
        .filter((event) => event.type === 'piece.moved')
        .map((event) => event.reason),
    ).toEqual(['guard', 'guard'])
  })

  it('resolves guard pass through the request path without moving guardian pieces', () => {
    const state = makeBattleReadyState()
    const attackResult = expectApplied(declareAttack(state))
    const guardResult = expectApplied(
      applyGameAction(attackResult.nextState, {
        action: {
          actionId: 'action-guard-pass-request-1' as ActionId,
          type: 'battle.guard',
          actor: {
            kind: 'player',
            playerId: 'player-2' as GameState['players'][number]['playerId'],
          },
          againstAttackerPieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: attackResult.nextState.revision,
      }),
    )
    const request = guardResult.nextState.pendingRequests[0]

    if (request?.type !== 'battle.guard_select') {
      throw new Error('Expected a battle.guard_select request.')
    }

    const passResult = applyGameChoiceResponse(guardResult.nextState, {
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.pass',
        reason: 'pass',
      },
      expectedRevision: guardResult.nextState.revision,
    })
    const appliedPassResult = expectApplied(passResult)
    const handZone = appliedPassResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p2-hand' as GameState['zones'][number]['zoneId']),
    )
    const guardianZone = appliedPassResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p2-guardian' as GameState['zones'][number]['zoneId']),
    )

    expect(appliedPassResult.inputKind).toBe('choice_response')
    expect(appliedPassResult.nextState.status).toBe('in_progress')
    expect(appliedPassResult.nextState.pendingRequests).toEqual([])
    expect(appliedPassResult.nextState.battle).toMatchObject({
      status: 'guard_resolved',
      guardPieceIds: [],
      guardZoneId: 'zone-p2-guardian',
    })
    expect(handZone?.occupants.map((occupant) => occupant.pieceId)).toEqual([
      'piece-p2-guard-1' as GameState['pieces'][number]['pieceId'],
      'piece-p2-guard-2' as GameState['pieces'][number]['pieceId'],
    ])
    expect(guardianZone?.occupants).toEqual([])
    expect(appliedPassResult.events.map((event) => event.type)).toEqual([
      'choice.response_resolved',
      'battle.guard_passed',
    ])
    expect(appliedPassResult.events[0]).toMatchObject({
      type: 'choice.response_resolved',
      outcome: 'optional_declined',
      requestId: request.requestId,
    })
    expect(
      appliedPassResult.timingWindows.map((window) => window.point),
    ).toEqual([
      'choice.response',
      'choice.response',
      'choice.response',
      'battle.guard',
      'battle.guard',
      'battle.guard',
    ])
  })

  it('rejects guard actions when no battle is active and blocks attacks behind pending requests', () => {
    const state = makeBattleReadyState()
    const invalidGuardResult = applyGameAction(state, {
      action: {
        actionId: 'action-guard-invalid-1' as ActionId,
        type: 'battle.guard',
        actor: {
          kind: 'player',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
        },
        againstAttackerPieceId:
          'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
      },
      expectedRevision: state.revision,
    })
    const invalidResult = expectInvalid(invalidGuardResult)

    expect(invalidResult.code).toBe('invalid_action')

    const pendingRequest = makeConfirmRequest()
    const blockedState = makeBattleReadyState({
      pendingRequests: [pendingRequest],
    })
    const blockedResult = applyGameAction(blockedState, {
      action: {
        actionId: 'action-attack-blocked-1' as ActionId,
        type: 'battle.declare_attack',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        attackerPieceId:
          'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        target: {
          kind: 'player',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
        },
      },
      expectedRevision: blockedState.revision,
    })
    const blockedTransition = expectBlocked(blockedResult)

    expect(blockedTransition.code).toBe('pending_request')
  })

  it('rejects mismatched guard responses structurally', () => {
    const state = makeBattleReadyState()
    const attackResult = expectApplied(declareAttack(state))
    const guardResult = expectApplied(
      applyGameAction(attackResult.nextState, {
        action: {
          actionId: 'action-guard-request-3' as ActionId,
          type: 'battle.guard',
          actor: {
            kind: 'player',
            playerId: 'player-2' as GameState['players'][number]['playerId'],
          },
          againstAttackerPieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: attackResult.nextState.revision,
      }),
    )
    const request = guardResult.nextState.pendingRequests[0]

    if (request?.type !== 'battle.guard_select') {
      throw new Error('Expected a battle.guard_select request.')
    }

    const invalidResponseResult = applyGameChoiceResponse(
      guardResult.nextState,
      {
        response: {
          requestId: request.requestId,
          responderPlayerId: request.responderPlayerId,
          type: 'answer.guard',
          selectedPieceIds: [
            'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
          ],
        },
        expectedRevision: guardResult.nextState.revision,
      },
    )
    const invalidResult = expectInvalid(invalidResponseResult)

    expect(invalidResult.inputKind).toBe('choice_response')
    expect(invalidResult.code).toBe('request_response_mismatch')
  })
})
