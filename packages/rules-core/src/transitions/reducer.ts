import type {
  ActionActor,
  AdvancePhaseAction,
  CallCardAction,
  GameActionSubmission,
  MatchConcedeAction,
  MatchReadyAction,
  MatchStartAction,
  MovePieceAction,
} from '../actions'
import type { EventId, TransitionId } from '../contracts'
import { RulesInvariantError } from '../errors'
import type { EventOrigin, GameEvent } from '../events'
import {
  assertChoiceResponseMatchesRequest,
  type GameChoiceResponse,
  type PendingGameChoiceRequest,
} from '../requests'
import { assertGameStateInvariant, type GameState } from '../state'

import {
  advanceGameStateRevision,
  type ActionTransitionInput,
  assertActionSubmissionRevision,
  assertChoiceResponseSubmissionRevision,
  type ChoiceResponseTransitionInput,
  createBlockedTransitionResult,
  createInvalidTransitionResult,
  createTransitionResult,
  type GameChoiceResponseSubmission,
  type TransitionInput,
  type TransitionResult,
} from './transition'
import { relocatePieceBetweenZones } from './zone-relocation'

export function reduceGameState(input: TransitionInput): TransitionResult {
  assertGameStateInvariant(input.currentState)

  return input.kind === 'action'
    ? reduceActionTransition(input)
    : reduceChoiceResponseTransition(input)
}

export function applyGameAction(
  currentState: GameState,
  submission: GameActionSubmission,
): TransitionResult {
  return reduceGameState({
    kind: 'action',
    currentState,
    submission,
  })
}

export function applyGameChoiceResponse(
  currentState: GameState,
  submission: GameChoiceResponseSubmission,
): TransitionResult {
  return reduceGameState({
    kind: 'choice_response',
    currentState,
    submission,
  })
}

function reduceActionTransition(
  input: ActionTransitionInput,
): TransitionResult {
  const { currentState, submission } = input
  const action = submission.action
  const transitionId = createActionTransitionId(
    action.actionId,
    currentState.revision,
  )

  if (
    !isRevisionCompatible(() =>
      assertActionSubmissionRevision(submission, currentState),
    )
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'revision_mismatch',
      `Action submission revision ${submission.expectedRevision} does not match game state revision ${currentState.revision}.`,
    )
  }

  const blockingRequest = currentState.pendingRequests[0]

  if (blockingRequest !== undefined && action.type !== 'match.concede') {
    return createBlockedTransitionResult(
      transitionId,
      currentState,
      currentState.pendingRequests,
      `Game state is waiting for request ${blockingRequest.requestId} before action ${action.type} can be applied.`,
    )
  }

  switch (action.type) {
    case 'match.ready':
      return applyMatchReadyTransition(transitionId, currentState, action)
    case 'match.start':
      return applyMatchStartTransition(transitionId, currentState, action)
    case 'match.concede':
      return applyMatchConcedeTransition(transitionId, currentState, action)
    case 'system.advance_phase':
      return applyAdvancePhaseTransition(transitionId, currentState, action)
    case 'zone.move_piece':
      return applyMovePieceTransition(transitionId, currentState, action)
    case 'card.call':
      return applyCallCardTransition(transitionId, currentState, action)
    default:
      return createInvalidTransitionResult(
        transitionId,
        currentState,
        'unsupported_action',
        `Action type ${action.type} is not implemented by the reducer foundation yet.`,
      )
  }
}

function reduceChoiceResponseTransition(
  input: ChoiceResponseTransitionInput,
): TransitionResult {
  const { currentState, submission } = input
  const response = submission.response
  const transitionId = createChoiceResponseTransitionId(
    response.requestId,
    currentState.revision,
  )

  if (
    !isRevisionCompatible(() =>
      assertChoiceResponseSubmissionRevision(submission, currentState),
    )
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'revision_mismatch',
      `Choice response submission revision ${submission.expectedRevision} does not match game state revision ${currentState.revision}.`,
      { inputKind: 'choice_response' },
    )
  }

  const blockingRequest = currentState.pendingRequests[0]

  if (blockingRequest === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'request_not_pending',
      `Choice response ${response.requestId} does not match any pending engine request.`,
      { inputKind: 'choice_response' },
    )
  }

  if (response.requestId !== blockingRequest.requestId) {
    return createBlockedTransitionResult(
      transitionId,
      currentState,
      [blockingRequest],
      `Game state is waiting for pending request ${blockingRequest.requestId} before response ${response.requestId} can be applied.`,
      { inputKind: 'choice_response' },
    )
  }

  try {
    assertChoiceResponseMatchesRequest(blockingRequest, response)
  } catch (error) {
    if (error instanceof RulesInvariantError) {
      return createInvalidTransitionResult(
        transitionId,
        currentState,
        'request_response_mismatch',
        error.message,
        { inputKind: 'choice_response' },
      )
    }

    throw error
  }

  const remainingRequests = currentState.pendingRequests.slice(1)
  const nextState = advanceGameStateRevision({
    ...currentState,
    status: deriveStatusAfterChoiceResolution(currentState, remainingRequests),
    pendingRequests: remainingRequests,
  })

  return createTransitionResult(transitionId, nextState, [], {
    inputKind: 'choice_response',
  })
}

function applyMatchReadyTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: MatchReadyAction,
): TransitionResult {
  if (currentState.status !== 'setup' && currentState.status !== 'ready') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} is only available while the match is in setup or ready state.`,
    )
  }

  const player = currentState.players.find(
    (candidate) => candidate.playerId === action.actor.playerId,
  )

  if (player === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
    )
  }

  if (player.status === 'ready') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Player ${player.playerId} is already ready.`,
    )
  }

  const nextPlayers = currentState.players.map((candidate) =>
    candidate.playerId === player.playerId
      ? {
          ...candidate,
          status: 'ready',
        }
      : candidate,
  )
  const nextState = advanceGameStateRevision({
    ...currentState,
    status: nextPlayers.every((candidate) => candidate.status === 'ready')
      ? 'ready'
      : currentState.status,
    players: nextPlayers,
  })

  return createTransitionResult(transitionId, nextState)
}

function applyMatchStartTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: MatchStartAction,
): TransitionResult {
  if (currentState.status !== 'ready') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in ready state.`,
    )
  }

  const startingPlayer = currentState.players.find(
    (player) => player.playerId === currentState.turn.turnPlayerId,
  )

  if (startingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown starting player ${currentState.turn.turnPlayerId}.`,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    status: 'in_progress',
    players: currentState.players.map((player) =>
      player.playerId === currentState.turn.turnPlayerId
        ? {
            ...player,
            status: 'active',
          }
        : player.status === 'defeated'
          ? player
          : {
              ...player,
              status: 'waiting',
            },
    ),
    turn: {
      ...currentState.turn,
      priorityPlayerId: currentState.turn.turnPlayerId,
    },
  })
  const events: readonly GameEvent[] = [
    {
      eventId: createEventId(transitionId, 0),
      type: 'match.started',
      sequence: 0,
      sourceActionId: action.actionId,
      origin: createSystemEventOrigin(action.actor.system),
      startingPlayerId: currentState.turn.turnPlayerId,
    },
    {
      eventId: createEventId(transitionId, 1),
      type: 'turn.started',
      sequence: 1,
      sourceActionId: action.actionId,
      origin: createSystemEventOrigin(action.actor.system),
      turnNumber: nextState.turn.turnNumber,
      turnPlayerId: nextState.turn.turnPlayerId,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

function applyMatchConcedeTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: MatchConcedeAction,
): TransitionResult {
  if (currentState.status === 'completed') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      'A completed match cannot be conceded again.',
    )
  }

  const concedingPlayer = currentState.players.find(
    (player) => player.playerId === action.actor.playerId,
  )

  if (concedingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
    )
  }

  const winningPlayer = currentState.players.find(
    (player) =>
      player.playerId !== concedingPlayer.playerId &&
      player.status !== 'defeated',
  )
  const nextState = advanceGameStateRevision({
    ...currentState,
    status: 'completed',
    pendingRequests: [],
    players: currentState.players.map((player) =>
      player.playerId === concedingPlayer.playerId
        ? {
            ...player,
            status: 'defeated',
          }
        : player,
    ),
  })
  const matchEndedEvent: GameEvent = {
    eventId: createEventId(transitionId, 0),
    type: 'match.ended',
    sequence: 0,
    sourceActionId: action.actionId,
    origin: createEventOrigin(action.actor),
    reason: 'concede',
    loserPlayerId: concedingPlayer.playerId,
    ...(winningPlayer === undefined
      ? {}
      : {
          winnerPlayerId: winningPlayer.playerId,
        }),
  }
  const events: readonly GameEvent[] = [matchEndedEvent]

  return createTransitionResult(transitionId, nextState, events)
}

function applyAdvancePhaseTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: AdvancePhaseAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  if (action.nextPhase === currentState.turn.phase) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} must advance to a different phase than ${currentState.turn.phase}.`,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    turn: {
      turnNumber: currentState.turn.turnNumber,
      turnPlayerId: currentState.turn.turnPlayerId,
      priorityPlayerId: currentState.turn.turnPlayerId,
      phase: action.nextPhase,
    },
  })
  const events: readonly GameEvent[] = [
    {
      eventId: createEventId(transitionId, 0),
      type: 'turn.phase_advanced',
      sequence: 0,
      sourceActionId: action.actionId,
      origin: createSystemEventOrigin(action.actor.system),
      turnNumber: currentState.turn.turnNumber,
      previousPhase: currentState.turn.phase,
      nextPhase: action.nextPhase,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

function applyMovePieceTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: MovePieceAction,
): TransitionResult {
  if (currentState.status === 'completed') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      'A completed match cannot move pieces.',
    )
  }

  const relocation = relocatePieceBetweenZones(
    currentState,
    action.pieceId,
    action.from,
    action.to,
  )

  if (!relocation.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      relocation.code,
      relocation.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    zones: relocation.zones,
  })
  const events: readonly GameEvent[] = [
    {
      eventId: createEventId(transitionId, 0),
      type: 'piece.moved',
      sequence: 0,
      sourceActionId: action.actionId,
      origin: createEventOrigin(action.actor),
      pieceId: action.pieceId,
      from: relocation.actualFrom,
      to: relocation.actualTo,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

function applyCallCardTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: CallCardAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  const actingPlayer = currentState.players.find(
    (player) => player.playerId === action.actor.playerId,
  )

  if (actingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
    )
  }

  const piece = currentState.pieces.find(
    (candidate) => candidate.pieceId === action.pieceId,
  )

  if (piece === undefined || piece.kind !== 'card') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} requires a runtime card piece ${action.pieceId}.`,
    )
  }

  const destinationZone = currentState.zones.find(
    (zone) => zone.zoneId === action.to.zoneId,
  )

  if (
    destinationZone === undefined ||
    (destinationZone.ownerPlayerId !== undefined &&
      destinationZone.ownerPlayerId !== actingPlayer.playerId)
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} cannot call to zone ${action.to.zoneId} for player ${actingPlayer.playerId}.`,
    )
  }

  const relocation = relocatePieceBetweenZones(
    currentState,
    action.pieceId,
    action.from,
    action.to,
  )

  if (!relocation.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      relocation.code,
      relocation.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    zones: relocation.zones,
    pieces: currentState.pieces.map((candidate) =>
      candidate.pieceId === action.pieceId
        ? {
            ...candidate,
            controllerPlayerId: actingPlayer.playerId,
          }
        : candidate,
    ),
  })
  const origin = createEventOrigin(action.actor)
  const events: readonly GameEvent[] = [
    {
      eventId: createEventId(transitionId, 0),
      type: 'piece.moved',
      sequence: 0,
      sourceActionId: action.actionId,
      origin,
      pieceId: action.pieceId,
      from: relocation.actualFrom,
      to: relocation.actualTo,
    },
    {
      eventId: createEventId(transitionId, 1),
      type: 'card.called',
      sequence: 1,
      sourceActionId: action.actionId,
      origin: createPlayerEventOrigin(action.actor.playerId),
      pieceId: action.pieceId,
      from: relocation.actualFrom,
      to: relocation.actualTo,
    },
  ]

  return createTransitionResult(transitionId, nextState, events)
}

function deriveStatusAfterChoiceResolution(
  currentState: GameState,
  remainingRequests: readonly PendingGameChoiceRequest[],
): GameState['status'] {
  if (remainingRequests.length > 0) {
    return 'awaiting_choice'
  }

  return currentState.status === 'awaiting_choice'
    ? 'in_progress'
    : currentState.status
}

function createActionTransitionId(
  actionId: GameActionSubmission['action']['actionId'],
  revision: GameState['revision'],
): TransitionId {
  return `transition:action:${actionId}:r${revision}` as TransitionId
}

function createChoiceResponseTransitionId(
  requestId: GameChoiceResponse['requestId'],
  revision: GameState['revision'],
): TransitionId {
  return `transition:choice:${requestId}:r${revision}` as TransitionId
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}

function createEventOrigin(actor: ActionActor): EventOrigin {
  return actor.kind === 'player'
    ? {
        kind: 'player',
        playerId: actor.playerId,
      }
    : {
        kind: 'system',
        system: actor.system,
      }
}

function createSystemEventOrigin(
  system: Extract<EventOrigin, { readonly kind: 'system' }>['system'],
): Extract<EventOrigin, { readonly kind: 'system' }> {
  return {
    kind: 'system',
    system,
  }
}

function createPlayerEventOrigin(
  playerId: CallCardAction['actor']['playerId'],
): Extract<EventOrigin, { readonly kind: 'player' }> {
  return {
    kind: 'player',
    playerId,
  }
}

function isRevisionCompatible(assertion: () => void): boolean {
  try {
    assertion()
    return true
  } catch (error) {
    if (error instanceof RulesInvariantError) {
      return false
    }

    throw error
  }
}
