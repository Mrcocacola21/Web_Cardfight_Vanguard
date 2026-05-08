import { describe, expect, expectTypeOf, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  EngineCommand,
  EngineDispatchResult,
  GameChoiceRequest,
  GameState,
  RequestId,
  TransitionId,
  ZoneSlotId,
} from '../index'
import {
  createEngineDispatchResult,
  createTransitionResult,
  dispatchEngineCommand,
  isAcceptedEngineDispatchResult,
  isBlockedEngineDispatchResult,
  isInvalidEngineDispatchResult,
  rulesEngineBoundary,
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
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: 'ready',
        ownedZoneIds: [],
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
          slotIds: ['slot-vanguard' as ZoneSlotId, 'slot-left' as ZoneSlotId],
        },
        occupants: [],
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
    ],
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function makeAwaitingChoiceState(): GameState {
  const request: GameChoiceRequest = {
    requestId: 'request-1' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'rule',
    visibility: 'responder-only',
  }

  return {
    ...makeReadyState(),
    status: 'awaiting_choice',
    players: makeReadyState().players.map((player) =>
      player.playerId ===
      ('player-1' as GameState['players'][number]['playerId'])
        ? {
            ...player,
            status: 'active',
          }
        : {
            ...player,
            status: 'waiting',
          },
    ),
    pendingRequests: [request],
  }
}

describe('@web-vg/rules-core engine/UI boundary', () => {
  it('publishes a command-only boundary surface for UI interaction', () => {
    expectTypeOf<EngineCommand['kind']>().toEqualTypeOf<
      'action' | 'choice_response'
    >()
    expectTypeOf<HasKey<EngineCommand, 'clientX'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<EngineCommand, 'onClick'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<EngineCommand, 'statePatch'>>().toEqualTypeOf<false>()
    expectTypeOf<
      HasKey<EngineDispatchResult, 'component'>
    >().toEqualTypeOf<false>()
    expectTypeOf<HasKey<EngineDispatchResult, 'label'>>().toEqualTypeOf<false>()
    expectTypeOf<
      HasKey<EngineDispatchResult, 'clientMutationId'>
    >().toEqualTypeOf<false>()
  })

  it('maps a valid gameplay action into an accepted engine result', () => {
    const state = makeReadyState()
    const result = dispatchEngineCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-start-1' as ActionId,
          type: 'match.start',
          actor: {
            kind: 'system',
            system: 'match-setup',
          },
        },
        expectedRevision: 0,
      },
    })

    expect(isAcceptedEngineDispatchResult(result)).toBe(true)
    if (!isAcceptedEngineDispatchResult(result)) {
      throw new Error(
        `Expected an accepted engine result, received ${result.status}.`,
      )
    }

    expect(result.state.status).toBe('in_progress')
    expect(result.events.map((event) => event.type)).toEqual([
      'match.started',
      'turn.started',
    ])
    expect(result.pendingRequests).toEqual([])
  })

  it('returns a structured invalid result when the engine rejects an action', () => {
    const state = makeReadyState()
    const result = rulesEngineBoundary.dispatch(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-ready-1' as ActionId,
          type: 'match.ready',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
        },
      },
    })

    expect(isInvalidEngineDispatchResult(result)).toBe(true)
    if (!isInvalidEngineDispatchResult(result)) {
      throw new Error(
        `Expected an invalid engine result, received ${result.status}.`,
      )
    }

    expect(result.code).toBe('invalid_action')
    expect(result.state).toEqual(state)
    expect(result.events).toEqual([])
  })

  it('returns a structured blocked result while the engine owns a pending request', () => {
    const state = makeAwaitingChoiceState()
    const result = dispatchEngineCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-phase-1' as ActionId,
          type: 'system.advance_phase',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          nextPhase: 'battle' as GameState['turn']['phase'],
        },
      },
    })

    expect(isBlockedEngineDispatchResult(result)).toBe(true)
    if (!isBlockedEngineDispatchResult(result)) {
      throw new Error(
        `Expected a blocked engine result, received ${result.status}.`,
      )
    }

    expect(result.code).toBe('pending_request')
    expect(result.blockingRequests).toEqual(state.pendingRequests)
    expect(result.pendingRequests).toEqual(state.pendingRequests)
  })

  it('continues request-driven flow only through a structured choice response command', () => {
    const state = makeAwaitingChoiceState()
    const request = state.pendingRequests[0]

    if (request === undefined) {
      throw new Error('Expected a pending request in the fixture.')
    }

    const result = dispatchEngineCommand(state, {
      kind: 'choice_response',
      submission: {
        response: {
          requestId: request.requestId,
          responderPlayerId: request.responderPlayerId,
          type: 'answer.boolean',
          accepted: true,
        },
        expectedRevision: 0,
      },
    })

    expect(isAcceptedEngineDispatchResult(result)).toBe(true)
    if (!isAcceptedEngineDispatchResult(result)) {
      throw new Error(
        `Expected an accepted engine result, received ${result.status}.`,
      )
    }

    expect(result.state.pendingRequests).toEqual([])
    expect(result.state.status).toBe('in_progress')
  })

  it('preserves engine-owned pending requests in normalized accepted outputs', () => {
    const request: GameChoiceRequest = {
      requestId: 'request-2' as RequestId,
      type: 'confirm.boolean',
      responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      purpose: 'rule',
      visibility: 'responder-only',
    }
    const nextState: GameState = {
      ...makeReadyState(),
      status: 'awaiting_choice',
      revision: 1,
      pendingRequests: [request],
    }
    const boundaryResult = createEngineDispatchResult(
      createTransitionResult('transition-request-1' as TransitionId, nextState),
    )

    expect(boundaryResult.status).toBe('accepted')
    expect(boundaryResult.pendingRequests).toEqual([request])
  })
})
