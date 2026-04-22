import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameChoiceRequest,
  GameState,
  RequestId,
  ZoneSlotId,
} from '../index'
import {
  applyGameAction,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

function makeZoneMoveState(
  pendingRequests: readonly GameChoiceRequest[] = [],
): GameState {
  return {
    gameId: 'game-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress',
    revision: 2,
    turn: {
      turnNumber: 1,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'main' as GameState['turn']['phase'],
      step: 'action-window' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: pendingRequests.length > 0 ? 'active' : 'active',
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
        status: 'waiting',
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
        cardDefinitionId: 'card-1' as CardId,
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
      },
      {
        pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        cardDefinitionId: 'card-2' as CardId,
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
      },
      {
        pieceId: 'piece-opponent' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        cardDefinitionId: 'card-3' as CardId,
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
      },
    ],
    flags: [],
    pendingRequests,
  }
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-1' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

describe('@web-vg/rules-core zone move scenarios', () => {
  it('moves a piece between zones without duplication or identity drift', () => {
    const state = makeZoneMoveState()
    const submission = {
      action: {
        actionId: 'action-zone-move-1' as ActionId,
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
      expectedRevision: 2,
    }

    const firstResult = applyGameAction(state, submission)
    const secondResult = applyGameAction(state, submission)

    expect(isAppliedTransitionResult(firstResult)).toBe(true)
    expect(firstResult).toEqual(secondResult)

    if (!isAppliedTransitionResult(firstResult)) {
      throw new Error(
        `Expected an applied zone move result, received ${firstResult.status}.`,
      )
    }

    const handZone = firstResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-hand' as GameState['zones'][number]['zoneId']),
    )
    const dropZone = firstResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-drop' as GameState['zones'][number]['zoneId']),
    )

    expect(handZone?.occupants).toEqual([])
    expect(dropZone?.occupants).toEqual([
      {
        pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(firstResult.nextState.pieces).toEqual(state.pieces)
    expect(firstResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
    ])
  })

  it('rejects moves to an occupied slot without mutating the current state', () => {
    const state = makeZoneMoveState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-zone-move-occupied' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-field' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-vanguard' as ZoneSlotId,
        },
      },
      expectedRevision: 2,
    })

    expect(isInvalidTransitionResult(result)).toBe(true)

    if (!isInvalidTransitionResult(result)) {
      throw new Error(
        `Expected an invalid zone move result, received ${result.status}.`,
      )
    }

    expect(result.code).toBe('invalid_action')
    expect(result.currentState).toEqual(state)
    expect(result.events).toEqual([])
    expect(result.pendingRequests).toEqual([])
  })

  it('rejects moves with an incorrect source reference without corrupting piece locations', () => {
    const state = makeZoneMoveState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-zone-move-wrong-source' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-drop' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-field' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
      },
    })

    expect(isInvalidTransitionResult(result)).toBe(true)

    if (!isInvalidTransitionResult(result)) {
      throw new Error(
        `Expected an invalid source zone result, received ${result.status}.`,
      )
    }

    expect(result.code).toBe('invalid_action_reference')
    expect(result.currentState.zones).toEqual(state.zones)
    expect(result.currentState.pieces).toEqual(state.pieces)
  })

  it('keeps zone moves blocked while a pending request is waiting', () => {
    const request = makePendingRequest()
    const state = makeZoneMoveState([request])
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-zone-move-blocked' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId: 'piece-hand' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-drop' as GameState['zones'][number]['zoneId'],
        },
      },
    })

    expect(isBlockedTransitionResult(result)).toBe(true)

    if (!isBlockedTransitionResult(result)) {
      throw new Error(
        `Expected a blocked zone move result, received ${result.status}.`,
      )
    }

    expect(result.currentState).toEqual(state)
    expect(result.blockingRequests).toEqual([request])
    expect(result.events).toEqual([])
  })
})
