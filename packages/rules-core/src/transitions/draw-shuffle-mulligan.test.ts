import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type { ActionId, GameChoiceRequest, GameState } from '../index'
import {
  applyGameAction,
  applyGameChoiceResponse,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

function makeOpeningState(
  pendingRequests: readonly GameChoiceRequest[] = [],
): GameState {
  return {
    gameId: 'game-opening-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress',
    revision: 4,
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
        status: 'active',
        ownedZoneIds: [
          'zone-deck' as GameState['zones'][number]['zoneId'],
          'zone-hand' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [],
        counters: [],
        flags: [],
      },
    ],
    zones: [
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
          { pieceId: 'piece-deck-1' as GameState['pieces'][number]['pieceId'] },
          { pieceId: 'piece-deck-2' as GameState['pieces'][number]['pieceId'] },
          { pieceId: 'piece-deck-3' as GameState['pieces'][number]['pieceId'] },
        ],
      },
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
          { pieceId: 'piece-hand-1' as GameState['pieces'][number]['pieceId'] },
          { pieceId: 'piece-hand-2' as GameState['pieces'][number]['pieceId'] },
          { pieceId: 'piece-hand-3' as GameState['pieces'][number]['pieceId'] },
        ],
      },
    ],
    pieces: [
      makeCardPiece('piece-deck-1', 'card-deck-1', 'player-1'),
      makeCardPiece('piece-deck-2', 'card-deck-2', 'player-1'),
      makeCardPiece('piece-deck-3', 'card-deck-3', 'player-1'),
      makeCardPiece('piece-hand-1', 'card-hand-1', 'player-1'),
      makeCardPiece('piece-hand-2', 'card-hand-2', 'player-1'),
      makeCardPiece('piece-hand-3', 'card-hand-3', 'player-1'),
    ],
    pieceStates: [],
    flags: [],
    pendingRequests,
  }
}

function makeCardPiece(
  pieceId: string,
  cardDefinitionId: string,
  playerId: string,
): GameState['pieces'][number] {
  return {
    pieceId: pieceId as GameState['pieces'][number]['pieceId'],
    kind: 'card',
    ownerPlayerId: playerId as GameState['players'][number]['playerId'],
    controllerPlayerId: playerId as GameState['players'][number]['playerId'],
    cardDefinitionId: cardDefinitionId as CardId,
  }
}

function expectEveryPieceLocatedOnce(state: GameState): void {
  const expectedPieceIds = state.pieces
    .map((piece) => piece.pieceId as string)
    .sort()
  const locatedPieceIds = state.zones
    .flatMap((zone) => zone.occupants)
    .map((occupant) => occupant.pieceId as string)
    .sort()

  expect(locatedPieceIds).toEqual(expectedPieceIds)
}

function expectApplied(result: ReturnType<typeof applyGameAction>) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error(`Expected an applied result, received ${result.status}.`)
  }

  return result
}

function expectInvalid(result: ReturnType<typeof applyGameAction>) {
  expect(isInvalidTransitionResult(result)).toBe(true)

  if (!isInvalidTransitionResult(result)) {
    throw new Error(`Expected an invalid result, received ${result.status}.`)
  }

  return result
}

function expectBlocked(result: ReturnType<typeof applyGameAction>) {
  expect(isBlockedTransitionResult(result)).toBe(true)

  if (!isBlockedTransitionResult(result)) {
    throw new Error(`Expected a blocked result, received ${result.status}.`)
  }

  return result
}

describe('@web-vg/rules-core draw / shuffle / mulligan mechanics', () => {
  it('applies zone.shuffle deterministically from an explicit ordered piece list', () => {
    const state = makeOpeningState()
    const submission = {
      action: {
        actionId: 'action-shuffle-1' as ActionId,
        type: 'zone.shuffle' as const,
        actor: {
          kind: 'system' as const,
          system: 'automatic-flow' as const,
        },
        zoneId: 'zone-deck' as GameState['zones'][number]['zoneId'],
        orderedPieceIds: [
          'piece-deck-3' as GameState['pieces'][number]['pieceId'],
          'piece-deck-1' as GameState['pieces'][number]['pieceId'],
          'piece-deck-2' as GameState['pieces'][number]['pieceId'],
        ],
      },
      expectedRevision: 4,
    }

    const firstResult = applyGameAction(state, submission)
    const secondResult = applyGameAction(state, submission)
    const appliedResult = expectApplied(firstResult)
    const deckZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-deck' as GameState['zones'][number]['zoneId']),
    )

    expect(firstResult).toEqual(secondResult)
    expect(appliedResult.nextState.revision).toBe(5)
    expect(deckZone?.occupants.map((occupant) => occupant.pieceId)).toEqual(
      submission.action.orderedPieceIds,
    )
    expect(appliedResult.events).toEqual([
      expect.objectContaining({
        type: 'zone.shuffled',
        orderedPieceIds: submission.action.orderedPieceIds,
      }),
    ])
  })

  it('draws the top cards from deck to hand without duplication or loss', () => {
    const state = makeOpeningState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-draw-1' as ActionId,
        type: 'zone.draw',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        count: 2,
      },
      expectedRevision: 4,
    })
    const appliedResult = expectApplied(result)
    const deckZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-deck' as GameState['zones'][number]['zoneId']),
    )
    const handZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-hand' as GameState['zones'][number]['zoneId']),
    )

    expect(deckZone?.occupants.map((occupant) => occupant.pieceId)).toEqual([
      'piece-deck-3' as GameState['pieces'][number]['pieceId'],
    ])
    expect(handZone?.occupants.map((occupant) => occupant.pieceId)).toEqual([
      'piece-hand-1' as GameState['pieces'][number]['pieceId'],
      'piece-hand-2' as GameState['pieces'][number]['pieceId'],
      'piece-hand-3' as GameState['pieces'][number]['pieceId'],
      'piece-deck-1' as GameState['pieces'][number]['pieceId'],
      'piece-deck-2' as GameState['pieces'][number]['pieceId'],
    ])
    expectEveryPieceLocatedOnce(appliedResult.nextState)
    expect(appliedResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'cards.drawn',
    ])
    expect(appliedResult.events[0]).toMatchObject({
      type: 'piece.moved',
      reason: 'draw',
    })
    expect(appliedResult.events[1]).toMatchObject({
      type: 'piece.moved',
      reason: 'draw',
    })
  })

  it('returns a structured invalid draw result when the deck does not contain enough cards', () => {
    const state = makeOpeningState()
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-draw-invalid-1' as ActionId,
        type: 'zone.draw',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        count: 99,
      },
      expectedRevision: 4,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.currentState).toEqual(state)
    expect(invalidResult.events).toEqual([])
  })

  it('starts mulligan as an engine-owned request and blocks unrelated actions while it is pending', () => {
    const state = makeOpeningState()
    const beginResult = applyGameAction(state, {
      action: {
        actionId: 'action-mulligan-begin-1' as ActionId,
        type: 'system.begin_mulligan',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        handZoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        deckZoneId: 'zone-deck' as GameState['zones'][number]['zoneId'],
      },
      expectedRevision: 4,
    })
    const appliedBeginResult = expectApplied(beginResult)
    const request = appliedBeginResult.nextState.pendingRequests[0]

    expect(appliedBeginResult.nextState.status).toBe('awaiting_choice')
    expect(request?.type).toBe('mulligan.select_cards')
    expect(appliedBeginResult.events.map((event) => event.type)).toEqual([
      'mulligan.started',
    ])

    const blockedResult = applyGameAction(appliedBeginResult.nextState, {
      action: {
        actionId: 'action-draw-blocked-1' as ActionId,
        type: 'zone.draw',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        fromZoneId: 'zone-deck' as GameState['zones'][number]['zoneId'],
        toZoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        count: 1,
      },
      expectedRevision: appliedBeginResult.nextState.revision,
    })
    const blockedTransition = expectBlocked(blockedResult)

    expect(blockedTransition.code).toBe('pending_request')
    expect(blockedTransition.blockingRequests).toEqual(
      appliedBeginResult.nextState.pendingRequests,
    )
  })

  it('resolves mulligan by returning cards, shuffling the deck deterministically, drawing replacements, and completing the request', () => {
    const state = makeOpeningState()
    const beginResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-mulligan-begin-resolve-1' as ActionId,
          type: 'system.begin_mulligan',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          playerId: 'player-1' as GameState['players'][number]['playerId'],
          handZoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
          deckZoneId: 'zone-deck' as GameState['zones'][number]['zoneId'],
        },
        expectedRevision: 4,
      }),
    )
    const request = beginResult.nextState.pendingRequests[0]

    expect(request?.type).toBe('mulligan.select_cards')

    if (request?.type !== 'mulligan.select_cards') {
      throw new Error('Expected a mulligan.select_cards request.')
    }

    const resolutionResult = applyGameChoiceResponse(beginResult.nextState, {
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.mulligan',
        returnedPieceIds: [
          'piece-hand-2' as GameState['pieces'][number]['pieceId'],
          'piece-hand-3' as GameState['pieces'][number]['pieceId'],
        ],
        shuffledDeckPieceIds: [
          'piece-hand-2' as GameState['pieces'][number]['pieceId'],
          'piece-deck-1' as GameState['pieces'][number]['pieceId'],
          'piece-deck-2' as GameState['pieces'][number]['pieceId'],
          'piece-hand-3' as GameState['pieces'][number]['pieceId'],
          'piece-deck-3' as GameState['pieces'][number]['pieceId'],
        ],
      },
      expectedRevision: beginResult.nextState.revision,
    })

    expect(isAppliedTransitionResult(resolutionResult)).toBe(true)

    if (!isAppliedTransitionResult(resolutionResult)) {
      throw new Error(
        `Expected an applied mulligan resolution, received ${resolutionResult.status}.`,
      )
    }

    const deckZone = resolutionResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-deck' as GameState['zones'][number]['zoneId']),
    )
    const handZone = resolutionResult.nextState.zones.find(
      (zone) =>
        zone.zoneId === ('zone-hand' as GameState['zones'][number]['zoneId']),
    )
    const player = resolutionResult.nextState.players.find(
      (candidate) =>
        candidate.playerId ===
        ('player-1' as GameState['players'][number]['playerId']),
    )

    expect(resolutionResult.inputKind).toBe('choice_response')
    expect(resolutionResult.nextState.status).toBe('in_progress')
    expect(resolutionResult.nextState.pendingRequests).toEqual([])
    expect(deckZone?.occupants.map((occupant) => occupant.pieceId)).toEqual([
      'piece-deck-2' as GameState['pieces'][number]['pieceId'],
      'piece-hand-3' as GameState['pieces'][number]['pieceId'],
      'piece-deck-3' as GameState['pieces'][number]['pieceId'],
    ])
    expect(handZone?.occupants.map((occupant) => occupant.pieceId)).toEqual([
      'piece-hand-1' as GameState['pieces'][number]['pieceId'],
      'piece-hand-2' as GameState['pieces'][number]['pieceId'],
      'piece-deck-1' as GameState['pieces'][number]['pieceId'],
    ])
    expectEveryPieceLocatedOnce(resolutionResult.nextState)
    expect(player?.flags).toContainEqual({
      key: 'mulligan_completed',
      enabled: true,
      visibility: 'public',
    })
    expect(resolutionResult.events.map((event) => event.type)).toEqual([
      'choice.response_resolved',
      'piece.moved',
      'piece.moved',
      'zone.shuffled',
      'piece.moved',
      'piece.moved',
      'cards.drawn',
      'mulligan.completed',
    ])
    expect(resolutionResult.events[0]).toMatchObject({
      type: 'choice.response_resolved',
      outcome: 'selection_made',
      returnedPieceIds: ['piece-hand-2', 'piece-hand-3'],
    })
    expect(
      resolutionResult.events
        .filter((event) => event.type === 'piece.moved')
        .map((event) => event.reason),
    ).toEqual([
      'mulligan_return',
      'mulligan_return',
      'mulligan_draw',
      'mulligan_draw',
    ])
  })

  it('rejects structurally mismatched mulligan responses without corrupting state', () => {
    const state = makeOpeningState()
    const beginResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-mulligan-begin-invalid-1' as ActionId,
          type: 'system.begin_mulligan',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          playerId: 'player-1' as GameState['players'][number]['playerId'],
          handZoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
          deckZoneId: 'zone-deck' as GameState['zones'][number]['zoneId'],
        },
        expectedRevision: 4,
      }),
    )
    const request = beginResult.nextState.pendingRequests[0]

    if (request?.type !== 'mulligan.select_cards') {
      throw new Error(
        'Expected a mulligan request before invalid response check.',
      )
    }

    const invalidResult = applyGameChoiceResponse(beginResult.nextState, {
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.mulligan',
        returnedPieceIds: [
          'piece-hand-2' as GameState['pieces'][number]['pieceId'],
        ],
        shuffledDeckPieceIds: [
          'piece-deck-1' as GameState['pieces'][number]['pieceId'],
          'piece-deck-2' as GameState['pieces'][number]['pieceId'],
          'piece-deck-3' as GameState['pieces'][number]['pieceId'],
        ],
      },
      expectedRevision: beginResult.nextState.revision,
    })

    expect(isInvalidTransitionResult(invalidResult)).toBe(true)

    if (!isInvalidTransitionResult(invalidResult)) {
      throw new Error(
        `Expected an invalid mulligan response, received ${invalidResult.status}.`,
      )
    }

    expect(invalidResult.code).toBe('request_response_mismatch')
    expect(invalidResult.currentState).toEqual(beginResult.nextState)
    expect(invalidResult.events).toEqual([])
  })
})
