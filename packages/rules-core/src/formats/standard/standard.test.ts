import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  EngineDispatchResult,
  GameChoiceRequest,
  GameState,
  RequestId,
} from '../../index'
import {
  STANDARD_FORMAT_ACTION_TYPES,
  STANDARD_FORMAT_ID,
  STANDARD_ZONE_KINDS,
  dispatchEngineCommand,
  dispatchStandardCommand,
  isAcceptedEngineDispatchResult,
  isBlockedEngineDispatchResult,
  isInvalidEngineDispatchResult,
  standardFormatAdapter,
} from '../../index'

interface StandardStateOptions {
  readonly formatId?: FormatId
  readonly status?: GameState['status']
  readonly revision?: number
  readonly pendingRequests?: readonly GameChoiceRequest[]
}

function makeStandardState(options: StandardStateOptions = {}): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status =
    options.status ??
    (pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress')

  return {
    gameId: 'game-standard-1' as GameState['gameId'],
    formatId: options.formatId ?? STANDARD_FORMAT_ID,
    status,
    revision: options.revision ?? 3,
    turn: {
      turnNumber: 2,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: (status === 'ready'
        ? 'pregame'
        : 'ride') as GameState['turn']['phase'],
      step: (status === 'ready' ? 'opening' : 'main') as NonNullable<
        GameState['turn']['step']
      >,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: (status === 'ready'
          ? 'ready'
          : 'active') as GameState['players'][number]['status'],
        ownedZoneIds: [
          'zone-p1-ride' as GameState['zones'][number]['zoneId'],
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p1-soul' as GameState['zones'][number]['zoneId'],
          'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: (status === 'ready'
          ? 'ready'
          : 'waiting') as GameState['players'][number]['status'],
        ownedZoneIds: [
          'zone-p2-ride' as GameState['zones'][number]['zoneId'],
          'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p2-soul' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-p1-ride' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.rideDeck,
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.vanguardCircle,
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
        zoneId: 'zone-p1-soul' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.soul,
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
        zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
        kind: 'rear_guard_circle',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [],
      },
      {
        zoneId: 'zone-p2-ride' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.rideDeck,
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
      {
        zoneId: 'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.vanguardCircle,
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
      {
        zoneId: 'zone-p2-soul' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.soul,
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [],
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
    pieceStates: [],
    flags: [],
    pendingRequests,
  }
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-standard-1' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

function expectAccepted(result: EngineDispatchResult) {
  expect(isAcceptedEngineDispatchResult(result)).toBe(true)

  if (!isAcceptedEngineDispatchResult(result)) {
    throw new Error(`Expected an accepted result, received ${result.status}.`)
  }

  return result
}

function expectInvalid(result: EngineDispatchResult) {
  expect(isInvalidEngineDispatchResult(result)).toBe(true)

  if (!isInvalidEngineDispatchResult(result)) {
    throw new Error(`Expected an invalid result, received ${result.status}.`)
  }

  return result
}

function expectBlocked(result: EngineDispatchResult) {
  expect(isBlockedEngineDispatchResult(result)).toBe(true)

  if (!isBlockedEngineDispatchResult(result)) {
    throw new Error(`Expected a blocked result, received ${result.status}.`)
  }

  return result
}

describe('@web-vg/rules-core Standard format adapter', () => {
  it('publishes a real format adapter surface over the core engine boundary', () => {
    expect(standardFormatAdapter.formatId).toBe(STANDARD_FORMAT_ID)
    expect(standardFormatAdapter.supportedActionTypes).toEqual(
      STANDARD_FORMAT_ACTION_TYPES,
    )
    expect(typeof standardFormatAdapter.dispatch).toBe('function')
  })

  it('delegates generic supported actions to the core engine without changing their semantics', () => {
    const state = makeStandardState({
      status: 'ready',
      revision: 0,
    })
    const command = {
      kind: 'action' as const,
      submission: {
        action: {
          actionId: 'action-standard-start-1' as ActionId,
          type: 'match.start' as const,
          actor: {
            kind: 'system' as const,
            system: 'match-setup' as const,
          },
        },
        expectedRevision: 0,
      },
    }

    const coreResult = dispatchEngineCommand(state, command)
    const adapterResult = dispatchStandardCommand(state, command)

    expect(adapterResult).toEqual(coreResult)
    expectAccepted(adapterResult)
  })

  it('rejects non-standard states before dispatching gameplay commands', () => {
    const state = makeStandardState({
      formatId: 'premium' as FormatId,
    })
    const result = dispatchStandardCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-standard-ready-1' as ActionId,
          type: 'match.ready',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
        },
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('format_mismatch')
    expect(invalidResult.state).toEqual(state)
  })

  it('blocks normal calls that try to use the Standard ride deck as a generic call zone', () => {
    const state = makeStandardState()
    const result = dispatchStandardCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-standard-call-1' as ActionId,
          type: 'card.call',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-ride' as GameState['zones'][number]['zoneId'],
          },
          to: {
            zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          },
        },
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('format_rule_violation')
    expect(invalidResult.state).toEqual(state)
    expect(invalidResult.events).toEqual([])
  })

  it('applies Standard ride flow by moving the previous vanguard to soul and the ride card to vanguard circle', () => {
    const state = makeStandardState()
    const result = dispatchStandardCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-standard-ride-1' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-ride' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: 3,
      },
    })
    const acceptedResult = expectAccepted(result)
    const rideDeckZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-ride' as GameState['zones'][number]['zoneId']),
    )
    const vanguardZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-vanguard' as GameState['zones'][number]['zoneId']),
    )
    const soulZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-soul' as GameState['zones'][number]['zoneId']),
    )

    expect(acceptedResult.state.revision).toBe(4)
    expect(rideDeckZone?.occupants).toEqual([])
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
    expect(acceptedResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
    ])
    expect(acceptedResult.pendingRequests).toEqual([])
  })

  it('keeps pending request blocking semantics when a Standard-specific ride action is attempted', () => {
    const pendingRequest = makePendingRequest()
    const state = makeStandardState({
      pendingRequests: [pendingRequest],
    })
    const result = dispatchStandardCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-standard-ride-blocked-1' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-ride' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: state.revision,
      },
    })
    const blockedResult = expectBlocked(result)

    expect(blockedResult.code).toBe('pending_request')
    expect(blockedResult.blockingRequests).toEqual([pendingRequest])
    expect(blockedResult.state).toEqual(state)
  })
})
