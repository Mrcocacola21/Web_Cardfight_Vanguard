import type {
  BeginMulliganAction,
  DrawCardsAction,
  ShuffleZoneAction,
} from '../actions'
import type { EventId, RequestId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type {
  MulliganChoiceRequest,
  MulliganChoiceResponse,
  PendingGameChoiceRequest,
} from '../requests'
import type {
  GameState,
  PlayerFlagKey,
  PlayerFlagState,
  PlayerState,
  ZoneState,
} from '../state'
import { buildGameStateIndex, findPlayerById, findZoneById } from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type TransitionResult,
} from './transition'
import {
  drawTopPiecesBetweenZones,
  movePiecesByIdBetweenZones,
  type PieceZoneMovement,
  reorderOrderedMultiZoneOccupants,
} from './ordered-zone-operations'
import { createPieceMovedEvents } from './zone-transfer'

const MULLIGAN_COMPLETED_FLAG_KEY = 'mulligan_completed' as PlayerFlagKey

export function applyShuffleZoneTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: ShuffleZoneAction,
): TransitionResult {
  if (currentState.status === 'completed') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      'A completed match cannot shuffle zones.',
    )
  }

  const shuffleResult = reorderOrderedMultiZoneOccupants(
    currentState,
    action.zoneId,
    action.orderedPieceIds,
  )

  if (!shuffleResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      shuffleResult.code,
      shuffleResult.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    zones: shuffleResult.zones,
  })
  const events: readonly GameEvent[] = [
    {
      eventId: createEventId(transitionId, 0),
      type: 'zone.shuffled',
      sequence: 0,
      sourceActionId: action.actionId,
      origin: {
        kind: 'system',
        system: action.actor.system,
      },
      zoneId: action.zoneId,
      orderedPieceIds: action.orderedPieceIds,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

export function applyDrawCardsTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: DrawCardsAction,
): TransitionResult {
  if (currentState.status === 'completed') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      'A completed match cannot draw cards.',
    )
  }

  const stateIndex = buildGameStateIndex(currentState)
  const player = findPlayerById(stateIndex, action.playerId)

  if (player === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.playerId}.`,
    )
  }

  const sourceZone = findZoneById(stateIndex, action.fromZoneId)
  const destinationZone = findZoneById(stateIndex, action.toZoneId)
  const zoneReferenceError = resolveOwnedPlayerZones(
    action.type,
    player,
    sourceZone,
    destinationZone,
  )

  if (zoneReferenceError !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      zoneReferenceError.code,
      zoneReferenceError.message,
    )
  }

  if (sourceZone === undefined || destinationZone === undefined) {
    throw new Error(`Expected owned draw zones for action ${action.type}.`)
  }

  const drawResult = drawTopPiecesBetweenZones(
    currentState,
    action.fromZoneId,
    action.toZoneId,
    action.count,
    'draw',
  )

  if (!drawResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      drawResult.code,
      drawResult.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    zones: drawResult.zones,
    pieceStates: drawResult.pieceStates,
  })
  const pieceMovedEvents = createPieceMovedEvents(
    transitionId,
    drawResult.movedPieces,
    {
      kind: 'system',
      system: action.actor.system,
    },
    {
      sourceActionId: action.actionId,
    },
  )
  const events: readonly GameEvent[] = [
    ...pieceMovedEvents,
    {
      eventId: createEventId(transitionId, pieceMovedEvents.length),
      type: 'cards.drawn',
      sequence: pieceMovedEvents.length,
      sourceActionId: action.actionId,
      origin: {
        kind: 'system',
        system: action.actor.system,
      },
      playerId: action.playerId,
      fromZoneId: action.fromZoneId,
      toZoneId: action.toZoneId,
      pieceIds: drawResult.movedPieces.map((movement) => movement.pieceId),
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

export function applyBeginMulliganTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: BeginMulliganAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  if (currentState.turn.phase !== ('pregame' as GameState['turn']['phase'])) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} is only available during the pregame phase.`,
    )
  }

  const stateIndex = buildGameStateIndex(currentState)
  const player = findPlayerById(stateIndex, action.playerId)

  if (player === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.playerId}.`,
    )
  }

  if (hasEnabledPlayerFlag(player, MULLIGAN_COMPLETED_FLAG_KEY)) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Player ${player.playerId} has already completed mulligan resolution.`,
    )
  }

  const handZone = findZoneById(stateIndex, action.handZoneId)
  const deckZone = findZoneById(stateIndex, action.deckZoneId)
  const zoneReferenceError = resolveOwnedPlayerZones(
    action.type,
    player,
    handZone,
    deckZone,
  )

  if (zoneReferenceError !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      zoneReferenceError.code,
      zoneReferenceError.message,
    )
  }

  if (handZone === undefined || deckZone === undefined) {
    throw new Error(`Expected owned mulligan zones for action ${action.type}.`)
  }

  if (
    deckZone.layout.ordering !== 'ordered' ||
    deckZone.layout.occupancy !== 'multi'
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires deck zone ${action.deckZoneId} to be an ordered multi-occupancy zone.`,
    )
  }

  const requestId = `${transitionId}:request:mulligan` as RequestId
  const eligiblePieceIds = handZone.occupants.map(
    (occupant) => occupant.pieceId,
  )
  const request: MulliganChoiceRequest = {
    requestId,
    type: 'mulligan.select_cards',
    responderPlayerId: player.playerId,
    purpose: 'rule',
    visibility: 'responder-only',
    handZoneId: handZone.zoneId,
    deckZoneId: deckZone.zoneId,
    minSelections: 0,
    maxSelections: eligiblePieceIds.length,
    eligiblePieceIds,
    currentDeckPieceIds: deckZone.occupants.map((occupant) => occupant.pieceId),
    context: {
      sourceActionId: action.actionId,
      ...(eligiblePieceIds.length === 0
        ? {}
        : {
            relatedPieceIds: eligiblePieceIds,
          }),
      relatedZoneIds: [handZone.zoneId, deckZone.zoneId],
    },
  }
  const nextState = advanceGameStateRevision({
    ...currentState,
    status: 'awaiting_choice',
    pendingRequests: [request],
  })
  const events: readonly GameEvent[] = [
    {
      eventId: createEventId(transitionId, 0),
      type: 'mulligan.started',
      sequence: 0,
      sourceActionId: action.actionId,
      origin: {
        kind: 'system',
        system: action.actor.system,
      },
      playerId: player.playerId,
      requestId,
      handZoneId: handZone.zoneId,
      deckZoneId: deckZone.zoneId,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

export function applyMulliganChoiceResponseTransition(
  transitionId: TransitionId,
  currentState: GameState,
  request: MulliganChoiceRequest,
  response: MulliganChoiceResponse,
  choiceResponseEvent: Extract<
    GameEvent,
    { readonly type: 'choice.response_resolved' }
  >,
): TransitionResult {
  const stateIndex = buildGameStateIndex(currentState)
  const player = findPlayerById(stateIndex, request.responderPlayerId)

  if (player === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Pending mulligan request ${request.requestId} references an unknown player ${request.responderPlayerId}.`,
      { inputKind: 'choice_response' },
    )
  }

  const handZone = findZoneById(stateIndex, request.handZoneId)
  const deckZone = findZoneById(stateIndex, request.deckZoneId)
  const zoneReferenceError = resolveOwnedPlayerZones(
    'mulligan.select_cards',
    player,
    handZone,
    deckZone,
  )

  if (zoneReferenceError !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      zoneReferenceError.code,
      zoneReferenceError.message,
      { inputKind: 'choice_response' },
    )
  }

  if (handZone === undefined || deckZone === undefined) {
    throw new Error(`Expected mulligan zones for request ${request.requestId}.`)
  }

  const currentHandPieceIds = handZone.occupants.map(
    (occupant) => occupant.pieceId,
  )
  const currentDeckPieceIds = deckZone.occupants.map(
    (occupant) => occupant.pieceId,
  )

  if (
    !haveExactMembers(currentHandPieceIds, request.eligiblePieceIds) ||
    !haveExactSequence(currentDeckPieceIds, request.currentDeckPieceIds)
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'request_response_mismatch',
      `Pending mulligan request ${request.requestId} no longer matches the current hand/deck state.`,
      { inputKind: 'choice_response' },
    )
  }

  const returnResult = movePiecesByIdBetweenZones(
    currentState,
    response.returnedPieceIds,
    request.handZoneId,
    request.deckZoneId,
    'mulligan_return',
  )

  if (!returnResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      returnResult.code,
      returnResult.message,
      { inputKind: 'choice_response' },
    )
  }

  const stateAfterReturns: GameState = {
    ...currentState,
    zones: returnResult.zones,
    pieceStates: returnResult.pieceStates,
  }
  const shuffleResult = reorderOrderedMultiZoneOccupants(
    stateAfterReturns,
    request.deckZoneId,
    response.shuffledDeckPieceIds,
  )

  if (!shuffleResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      shuffleResult.code,
      shuffleResult.message,
      { inputKind: 'choice_response' },
    )
  }

  const stateAfterShuffle: GameState = {
    ...stateAfterReturns,
    zones: shuffleResult.zones,
  }
  const drawResult =
    response.returnedPieceIds.length === 0
      ? {
          ok: true as const,
          zones: shuffleResult.zones,
          pieceStates: stateAfterShuffle.pieceStates,
          movedPieces: [],
        }
      : drawTopPiecesBetweenZones(
          stateAfterShuffle,
          request.deckZoneId,
          request.handZoneId,
          response.returnedPieceIds.length,
          'mulligan_draw',
        )

  if (!drawResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      drawResult.code,
      drawResult.message,
      { inputKind: 'choice_response' },
    )
  }

  const remainingRequests = currentState.pendingRequests.slice(1)
  const nextState = advanceGameStateRevision({
    ...currentState,
    status: deriveStatusAfterChoiceResolution(remainingRequests),
    pendingRequests: remainingRequests,
    players: currentState.players.map((candidate) =>
      candidate.playerId === player.playerId
        ? {
            ...candidate,
            flags: upsertPlayerFlag(
              candidate.flags,
              MULLIGAN_COMPLETED_FLAG_KEY,
              true,
              'public',
            ),
          }
        : candidate,
    ),
    zones: drawResult.zones,
    pieceStates: drawResult.pieceStates,
  })
  const events = createMulliganResolutionEvents(
    transitionId,
    player.playerId,
    request,
    returnResult.movedPieces,
    response.shuffledDeckPieceIds,
    drawResult.movedPieces,
    1,
  )

  return createTransitionResult(
    transitionId,
    nextState,
    [choiceResponseEvent, ...events],
    {
      inputKind: 'choice_response',
      timingWindows: createTransitionTimingWindowTriplet('choice.response', {
        relatedEventSequence: choiceResponseEvent.sequence,
        requestId: request.requestId,
      }),
    },
  )
}

function createMulliganResolutionEvents(
  transitionId: TransitionId,
  playerId: PlayerState['playerId'],
  request: MulliganChoiceRequest,
  returnedPieces: readonly PieceZoneMovement[],
  shuffledDeckPieceIds: readonly ZoneState['occupants'][number]['pieceId'][],
  drawnPieces: readonly PieceZoneMovement[],
  startingSequence = 0,
): readonly GameEvent[] {
  const events: GameEvent[] = []
  events.push(
    ...createPieceMovedEvents(
      transitionId,
      returnedPieces,
      {
        kind: 'player',
        playerId,
      },
      {
        startingSequence: startingSequence + events.length,
      },
    ),
  )

  events.push({
    eventId: createEventId(transitionId, startingSequence + events.length),
    type: 'zone.shuffled',
    sequence: startingSequence + events.length,
    origin: {
      kind: 'system',
      system: 'automatic-flow',
    },
    zoneId: request.deckZoneId,
    orderedPieceIds: shuffledDeckPieceIds,
  })

  events.push(
    ...createPieceMovedEvents(
      transitionId,
      drawnPieces,
      {
        kind: 'system',
        system: 'automatic-flow',
      },
      {
        startingSequence: startingSequence + events.length,
      },
    ),
  )

  if (drawnPieces.length > 0) {
    events.push({
      eventId: createEventId(transitionId, startingSequence + events.length),
      type: 'cards.drawn',
      sequence: startingSequence + events.length,
      origin: {
        kind: 'system',
        system: 'automatic-flow',
      },
      playerId,
      fromZoneId: request.deckZoneId,
      toZoneId: request.handZoneId,
      pieceIds: drawnPieces.map((movement) => movement.pieceId),
    })
  }

  events.push({
    eventId: createEventId(transitionId, startingSequence + events.length),
    type: 'mulligan.completed',
    sequence: startingSequence + events.length,
    origin: {
      kind: 'system',
      system: 'automatic-flow',
    },
    playerId,
    requestId: request.requestId,
    returnedPieceIds: returnedPieces.map((movement) => movement.pieceId),
    drawnPieceIds: drawnPieces.map((movement) => movement.pieceId),
  })

  return events
}

function deriveStatusAfterChoiceResolution(
  remainingRequests: readonly PendingGameChoiceRequest[],
): GameState['status'] {
  return remainingRequests.length > 0 ? 'awaiting_choice' : 'in_progress'
}

function resolveOwnedPlayerZones(
  label: string,
  player: PlayerState,
  sourceZone: ZoneState | undefined,
  destinationZone: ZoneState | undefined,
):
  | {
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    }
  | undefined {
  if (sourceZone === undefined || destinationZone === undefined) {
    return {
      code: 'invalid_action_reference',
      message: `Action ${label} references an unknown zone.`,
    }
  }

  if (
    sourceZone.ownerPlayerId !== undefined &&
    sourceZone.ownerPlayerId !== player.playerId
  ) {
    return {
      code: 'invalid_action_reference',
      message: `Action ${label} cannot use source zone ${sourceZone.zoneId} for player ${player.playerId}.`,
    }
  }

  if (
    destinationZone.ownerPlayerId !== undefined &&
    destinationZone.ownerPlayerId !== player.playerId
  ) {
    return {
      code: 'invalid_action_reference',
      message: `Action ${label} cannot use destination zone ${destinationZone.zoneId} for player ${player.playerId}.`,
    }
  }

  return undefined
}

function hasEnabledPlayerFlag(
  player: PlayerState,
  key: PlayerFlagKey,
): boolean {
  return player.flags.some((flag) => flag.key === key && flag.enabled)
}

function upsertPlayerFlag(
  flags: readonly PlayerFlagState[],
  key: PlayerFlagKey,
  enabled: boolean,
  visibility: PlayerFlagState['visibility'],
): readonly PlayerFlagState[] {
  const existingFlag = flags.find((flag) => flag.key === key)

  if (existingFlag === undefined) {
    return [...flags, { key, enabled, visibility }]
  }

  return flags.map((flag) =>
    flag.key === key
      ? {
          ...flag,
          enabled,
          visibility,
        }
      : flag,
  )
}

function haveExactMembers(
  actualValues: readonly string[],
  expectedValues: readonly string[],
): boolean {
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((value) => expectedValues.includes(value)) &&
    expectedValues.every((value) => actualValues.includes(value))
  )
}

function haveExactSequence(
  actualValues: readonly string[],
  expectedValues: readonly string[],
): boolean {
  return (
    actualValues.length === expectedValues.length &&
    actualValues.every((value, index) => value === expectedValues[index])
  )
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
