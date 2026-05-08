import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  GameChoiceRequest,
  GameState,
  RequestId,
  TransitionResult,
} from '../index'
import {
  applyGameAction,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

function makeTransferState(
  pendingRequests: readonly GameChoiceRequest[] = [],
): GameState {
  return {
    gameId: 'game-transfer-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress',
    revision: 7,
    turn: {
      turnNumber: 2,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'main' as GameState['turn']['phase'],
      step: 'resolution' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          'zone-hand' as GameState['zones'][number]['zoneId'],
          'zone-deck' as GameState['zones'][number]['zoneId'],
          'zone-soul' as GameState['zones'][number]['zoneId'],
          'zone-drop' as GameState['zones'][number]['zoneId'],
          'zone-bind' as GameState['zones'][number]['zoneId'],
          'zone-damage' as GameState['zones'][number]['zoneId'],
          'zone-ride-deck' as GameState['zones'][number]['zoneId'],
          'zone-g-deck' as GameState['zones'][number]['zoneId'],
          'zone-occupied-single' as GameState['zones'][number]['zoneId'],
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
            pieceId:
              'piece-hand-transfer' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-deck' as GameState['zones'][number]['zoneId'],
        kind: 'deck',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId:
              'piece-deck-transfer' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-soul' as GameState['zones'][number]['zoneId'],
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
        zoneId: 'zone-bind' as GameState['zones'][number]['zoneId'],
        kind: 'bind',
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
        zoneId: 'zone-damage' as GameState['zones'][number]['zoneId'],
        kind: 'damage',
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
        zoneId: 'zone-ride-deck' as GameState['zones'][number]['zoneId'],
        kind: 'ride_deck',
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
        zoneId: 'zone-g-deck' as GameState['zones'][number]['zoneId'],
        kind: 'g_deck',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId:
              'piece-g-deck-transfer' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-occupied-single' as GameState['zones'][number]['zoneId'],
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
              'piece-occupied-single' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
    ],
    pieces: [
      makeCardPiece('piece-hand-transfer', 'card-hand-transfer'),
      makeCardPiece('piece-deck-transfer', 'card-deck-transfer'),
      makeCardPiece('piece-g-deck-transfer', 'card-g-deck-transfer'),
      makeCardPiece('piece-occupied-single', 'card-occupied-single'),
    ],
    pieceStates: [],
    flags: [],
    pendingRequests,
  }
}

function makeCardPiece(
  pieceId: string,
  cardDefinitionId: string,
): GameState['pieces'][number] {
  return {
    pieceId: pieceId as GameState['pieces'][number]['pieceId'],
    kind: 'card',
    ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    controllerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    cardDefinitionId: cardDefinitionId as CardId,
  }
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-transfer-1' as RequestId,
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
      `Expected an applied transfer result, received ${result.status}.`,
    )
  }

  return result
}

function expectInvalid(result: TransitionResult) {
  expect(isInvalidTransitionResult(result)).toBe(true)

  if (!isInvalidTransitionResult(result)) {
    throw new Error(
      `Expected an invalid transfer result, received ${result.status}.`,
    )
  }

  return result
}

function expectBlocked(result: TransitionResult) {
  expect(isBlockedTransitionResult(result)).toBe(true)

  if (!isBlockedTransitionResult(result)) {
    throw new Error(
      `Expected a blocked transfer result, received ${result.status}.`,
    )
  }

  return result
}

describe('@web-vg/rules-core unified zone transfer foundation', () => {
  it.each([
    {
      label: 'soul',
      pieceId: 'piece-hand-transfer',
      fromZoneId: 'zone-hand',
      toZoneId: 'zone-soul',
      reason: 'soul',
    },
    {
      label: 'drop',
      pieceId: 'piece-hand-transfer',
      fromZoneId: 'zone-hand',
      toZoneId: 'zone-drop',
      reason: 'retire',
    },
    {
      label: 'bind',
      pieceId: 'piece-hand-transfer',
      fromZoneId: 'zone-hand',
      toZoneId: 'zone-bind',
      reason: 'bind',
    },
    {
      label: 'damage',
      pieceId: 'piece-deck-transfer',
      fromZoneId: 'zone-deck',
      toZoneId: 'zone-damage',
      reason: 'damage_check',
    },
    {
      label: 'ride deck',
      pieceId: 'piece-hand-transfer',
      fromZoneId: 'zone-hand',
      toZoneId: 'zone-ride-deck',
      reason: 'format',
    },
    {
      label: 'G deck',
      pieceId: 'piece-g-deck-transfer',
      fromZoneId: 'zone-g-deck',
      toZoneId: 'zone-hand',
      reason: 'format',
    },
  ])(
    'applies a representative transfer touching $label while preserving piece identity',
    ({ pieceId, fromZoneId, toZoneId, reason }) => {
      const state = makeTransferState()
      const result = applyGameAction(state, {
        action: {
          actionId: `action-transfer-${String(reason)}` as ActionId,
          type: 'zone.move_piece',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          pieceId: pieceId as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: fromZoneId as GameState['zones'][number]['zoneId'],
          },
          to: {
            zoneId: toZoneId as GameState['zones'][number]['zoneId'],
          },
          reason,
        },
        expectedRevision: state.revision,
      })
      const appliedResult = expectApplied(result)
      const sourceZone = appliedResult.nextState.zones.find(
        (zone) =>
          zone.zoneId === (fromZoneId as GameState['zones'][number]['zoneId']),
      )
      const destinationZone = appliedResult.nextState.zones.find(
        (zone) =>
          zone.zoneId === (toZoneId as GameState['zones'][number]['zoneId']),
      )
      const occurrenceCount = appliedResult.nextState.zones
        .flatMap((zone) => zone.occupants)
        .filter(
          (occupant) =>
            occupant.pieceId ===
            (pieceId as GameState['pieces'][number]['pieceId']),
        ).length

      expect(
        sourceZone?.occupants.some(
          (occupant) =>
            occupant.pieceId ===
            (pieceId as GameState['pieces'][number]['pieceId']),
        ) ?? false,
      ).toBe(false)
      expect(destinationZone?.occupants).toContainEqual({
        pieceId: pieceId as GameState['pieces'][number]['pieceId'],
      })
      expect(occurrenceCount).toBe(1)
      expect(appliedResult.events).toHaveLength(1)
      expect(appliedResult.events[0]).toMatchObject({
        type: 'piece.moved',
        pieceId,
        reason,
      })
      expect(
        appliedResult.timingWindows.map((window) => window.window),
      ).toEqual(['before', 'on', 'after'])
      expect(appliedResult.timingWindows[1]).toMatchObject({
        point: 'zone.transfer',
        relatedEventSequence: 0,
        pieceId,
      })
    },
  )

  it('rejects wrong-source transfers structurally without corrupting zone state', () => {
    const state = makeTransferState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-transfer-wrong-source-1' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId:
          'piece-hand-transfer' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-drop' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-soul' as GameState['zones'][number]['zoneId'],
        },
        reason: 'soul',
      },
      expectedRevision: state.revision,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action_reference')
    expect(invalidResult.currentState).toEqual(state)
    expect(invalidResult.events).toEqual([])
  })

  it('rejects transfers into invalid occupied destinations without duplicating the source piece', () => {
    const state = makeTransferState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-transfer-occupied-destination-1' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId:
          'piece-hand-transfer' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId:
            'zone-occupied-single' as GameState['zones'][number]['zoneId'],
        },
        reason: 'generic',
      },
      expectedRevision: state.revision,
    })
    const invalidResult = expectInvalid(result)
    const occurrenceCount = invalidResult.currentState.zones
      .flatMap((zone) => zone.occupants)
      .filter(
        (occupant) =>
          occupant.pieceId ===
          ('piece-hand-transfer' as GameState['pieces'][number]['pieceId']),
      ).length

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.currentState).toEqual(state)
    expect(invalidResult.events).toEqual([])
    expect(occurrenceCount).toBe(1)
  })

  it('keeps transfers blocked while an engine-owned request is pending', () => {
    const pendingRequest = makePendingRequest()
    const state = makeTransferState([pendingRequest])
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-transfer-blocked-1' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId:
          'piece-hand-transfer' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-drop' as GameState['zones'][number]['zoneId'],
        },
        reason: 'retire',
      },
      expectedRevision: state.revision,
    })
    const blockedResult = expectBlocked(result)

    expect(blockedResult.code).toBe('pending_request')
    expect(blockedResult.blockingRequests).toEqual([pendingRequest])
    expect(blockedResult.currentState).toEqual(state)
    expect(blockedResult.events).toEqual([])
  })
})
