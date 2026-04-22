import { describe, expect, expectTypeOf, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  ActionTransitionInput,
  GameChoiceRequest,
  GameChoiceResponseSubmission,
  GameState,
  RequestId,
  TransitionInput,
  TransitionResult,
  ZoneSlotId,
} from '../index'
import {
  applyGameAction,
  applyGameChoiceResponse,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
  reduceGameState,
} from '../index'

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue
  ? true
  : false

function makeReadyState(): GameState {
  return {
    gameId: 'game-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'ready',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'pregame' as GameState['turn']['phase'],
      step: 'opening' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: 'ready',
        ownedZoneIds: [
          'zone-hand' as GameState['players'][number]['ownedZoneIds'][number],
          'zone-field' as GameState['players'][number]['ownedZoneIds'][number],
          'zone-drop' as GameState['players'][number]['ownedZoneIds'][number],
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: 'ready',
        ownedZoneIds: [
          'zone-opponent-field' as GameState['players'][number]['ownedZoneIds'][number],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
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
            pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-field' as GameState['zones'][number]['zoneId'],
        kind: 'field',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
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
        occupants: [
          {
            pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
            slotId: 'slot-vanguard' as ZoneSlotId,
          },
        ],
      },
      {
        zoneId: 'zone-drop' as GameState['zones'][number]['zoneId'],
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
        zoneId: 'zone-opponent-field' as GameState['zones'][number]['zoneId'],
        kind: 'field',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId: 'piece-opponent' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
    ],
    pieces: [
      {
        pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-1' as CardId,
      },
      {
        pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-2' as CardId,
      },
      {
        pieceId: 'piece-opponent' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-3' as CardId,
      },
    ],
    flags: [],
    pendingRequests: [],
  }
}

function makeInProgressState(
  pendingRequests: readonly GameChoiceRequest[] = [],
): GameState {
  const baseState = makeReadyState()

  return {
    ...baseState,
    status: pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress',
    players: baseState.players.map((player) =>
      player.playerId === baseState.turn.turnPlayerId
        ? {
            ...player,
            status: 'active',
          }
        : {
            ...player,
            status: 'waiting',
          },
    ),
    pendingRequests,
  }
}

function makeConfirmRequest(
  requestId = 'request-confirm-1',
): GameChoiceRequest {
  return {
    requestId: requestId as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'rule',
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

describe('@web-vg/rules-core reducer / transition model', () => {
  it('publishes a deterministic, domain-safe transition surface', () => {
    expectTypeOf<
      TransitionResult['pendingRequests'][number]
    >().toEqualTypeOf<GameChoiceRequest>()
    expectTypeOf<ActionTransitionInput['kind']>().toEqualTypeOf<'action'>()
    expectTypeOf<TransitionInput['kind']>().toEqualTypeOf<
      'action' | 'choice_response'
    >()
    expectTypeOf<
      HasKey<ActionTransitionInput, 'onClick'>
    >().toEqualTypeOf<false>()
    expectTypeOf<HasKey<TransitionResult, 'clientX'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<TransitionResult, 'recordId'>>().toEqualTypeOf<false>()
  })

  it('reduces match.start deterministically and emits lifecycle events', () => {
    const state = makeReadyState()
    const submission = {
      action: {
        actionId: 'action-start-1' as ActionId,
        type: 'match.start' as const,
        actor: {
          kind: 'system' as const,
          system: 'match-setup' as const,
        },
      },
      expectedRevision: 0,
    }

    const firstResult = applyGameAction(state, submission)
    const secondResult = applyGameAction(state, submission)
    const appliedResult = expectApplied(firstResult)

    expect(firstResult).toEqual(secondResult)
    expect(appliedResult.nextState.status).toBe('in_progress')
    expect(appliedResult.nextState.revision).toBe(1)
    expect(appliedResult.events.map((event) => event.type)).toEqual([
      'match.started',
      'turn.started',
    ])
    expect(appliedResult.pendingRequests).toEqual([])
  })

  it('applies generic piece movement and emits a piece.moved fact', () => {
    const state = makeInProgressState()
    const result = reduceGameState({
      kind: 'action',
      currentState: state,
      submission: {
        action: {
          actionId: 'action-move-1' as ActionId,
          type: 'zone.move_piece' as const,
          actor: {
            kind: 'system' as const,
            system: 'automatic-flow' as const,
          },
          pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
          },
          to: {
            zoneId: 'zone-drop' as GameState['zones'][number]['zoneId'],
          },
        },
      },
    })
    const appliedResult = expectApplied(result)
    const handZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-hand' as GameState['zones'][number]['zoneId']),
    )
    const dropZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-drop' as GameState['zones'][number]['zoneId']),
    )

    expect(handZone?.occupants).toEqual([])
    expect(dropZone?.occupants).toEqual([
      {
        pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
      },
    ])
    const movedEvent = appliedResult.events[0]

    expect(appliedResult.events).toHaveLength(1)
    expect(movedEvent?.type).toBe('piece.moved')

    if (movedEvent?.type !== 'piece.moved') {
      throw new Error('Expected a piece.moved event from zone.move_piece.')
    }

    expect(movedEvent.to).toEqual({
      zoneId: 'zone-drop' as GameState['zones'][number]['zoneId'],
      position: 0,
    })
  })

  it('applies card.call as a composed transition with movement and card facts', () => {
    const state = makeInProgressState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-call-1' as ActionId,
        type: 'card.call' as const,
        actor: {
          kind: 'player' as const,
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-field' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
      },
    })
    const appliedResult = expectApplied(result)
    const fieldZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-field' as GameState['zones'][number]['zoneId']),
    )

    expect(fieldZone?.occupants).toContainEqual({
      pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
      slotId: 'slot-left' as ZoneSlotId,
    })
    expect(appliedResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'card.called',
    ])
  })

  it('returns blocked when the engine is waiting for a pending request', () => {
    const request = makeConfirmRequest()
    const state = makeInProgressState([request])
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-phase-1' as ActionId,
        type: 'system.advance_phase' as const,
        actor: {
          kind: 'system' as const,
          system: 'automatic-flow' as const,
        },
        nextPhase: 'battle' as GameState['turn']['phase'],
      },
    })
    const blockedResult = expectBlocked(result)

    expect(blockedResult.code).toBe('pending_request')
    expect(blockedResult.blockingRequests[0]?.requestId).toBe(request.requestId)
    expect(blockedResult.pendingRequests).toEqual([request])
  })

  it('resolves the head pending choice response and returns a new state', () => {
    const request = makeConfirmRequest()
    const state = makeInProgressState([request])
    const submission: GameChoiceResponseSubmission = {
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.boolean',
        accepted: true,
      },
      expectedRevision: 0,
    }
    const result = applyGameChoiceResponse(state, submission)
    const appliedResult = expectApplied(result)

    expect(appliedResult.inputKind).toBe('choice_response')
    expect(appliedResult.nextState.revision).toBe(1)
    expect(appliedResult.nextState.pendingRequests).toEqual([])
    expect(appliedResult.nextState.status).toBe('in_progress')
  })

  it('returns a structured invalid result for mismatched choice responses', () => {
    const request = makeConfirmRequest()
    const state = makeInProgressState([request])
    const result = applyGameChoiceResponse(state, {
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.pieces',
        selectedPieceIds: [
          'piece-hand' as GameState['pieces'][number]['pieceId'],
        ],
      },
      expectedRevision: 0,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.inputKind).toBe('choice_response')
    expect(invalidResult.code).toBe('request_response_mismatch')
    expect(invalidResult.currentState).toEqual(state)
    expect(invalidResult.events).toEqual([])
  })

  it('returns invalid for stale transition submissions', () => {
    const state = makeReadyState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-start-stale' as ActionId,
        type: 'match.start' as const,
        actor: {
          kind: 'system' as const,
          system: 'match-setup' as const,
        },
      },
      expectedRevision: 99,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('revision_mismatch')
    expect(invalidResult.currentState).toEqual(state)
    expect(invalidResult.events).toEqual([])
  })

  it('blocks out-of-order choice responses behind the head pending request', () => {
    const firstRequest = makeConfirmRequest('request-confirm-1')
    const secondRequest = makeConfirmRequest('request-confirm-2')
    const state = makeInProgressState([firstRequest, secondRequest])
    const result = applyGameChoiceResponse(state, {
      response: {
        requestId: secondRequest.requestId,
        responderPlayerId: secondRequest.responderPlayerId,
        type: 'answer.boolean',
        accepted: false,
      },
    })
    const blockedResult = expectBlocked(result)

    expect(blockedResult.inputKind).toBe('choice_response')
    expect(blockedResult.blockingRequests).toEqual([firstRequest])
  })
})
