import type {
  ActionActor,
  GameActionSubmission,
  MatchConcedeAction,
  MatchReadyAction,
  MatchStartAction,
  MovePieceAction,
} from '../actions'
import type { EventId, TransitionId } from '../contracts'
import { resolveEventTriggeredEffects } from '../effects/triggered-resolution'
import { RulesInvariantError } from '../errors'
import type { EventOrigin, GameEvent } from '../events'
import {
  assertChoiceResponseMatchesRequest,
  type GameChoiceRequest,
  type GameChoiceResponse,
  type PendingGameChoiceRequest,
} from '../requests'
import { assertGameStateInvariant, type GameState } from '../state'

import {
  applyBeginMulliganTransition,
  applyDrawCardsTransition,
  applyMulliganChoiceResponseTransition,
  applyShuffleZoneTransition,
} from './draw-shuffle-mulligan'
import {
  applyDamageCheckTransition,
  applyDriveCheckTransition,
} from './drive-damage-check'
import {
  applyLockPieceTransition,
  applyRestPieceTransition,
  applyStandPieceTransition,
  applyUnlockPieceTransition,
} from './piece-state-flags'
import {
  applyCommitBoostTransition,
  applyDeclareAttackTransition,
  applyGuardChoiceResponseTransition,
  applyGuardTransition,
} from './attack-boost-guard'
import { applyResolveMandatoryFlowTransition } from './battle-completion'
import { applyResolveCombatTransition } from './combat-resolution'
import { applyCallCardTransition, applyRideCardTransition } from './ride-call'
import {
  applyAdvancePhaseTransition,
  applyEndPhaseTransition,
  applyEndTurnTransition,
  applyResolveTurnMandatoryFlowTransition,
  resolvePhaseActionViolation,
} from './turn-structure'
import {
  advanceGameStateRevision,
  type ActionTransitionInput,
  assertActionSubmissionRevision,
  assertChoiceResponseSubmissionRevision,
  type ChoiceResponseTransitionInput,
  createBlockedTransitionResult,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type GameChoiceResponseSubmission,
  type TransitionInput,
  type TransitionResult,
} from './transition'
import { createPieceMovedEvents, resolveZoneTransfer } from './zone-transfer'

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

  const battleSequenceViolation =
    action.type === 'match.concede'
      ? undefined
      : resolveBattleSequenceViolation(currentState, action.type)

  if (battleSequenceViolation !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      battleSequenceViolation,
    )
  }

  const phaseActionViolation =
    action.type === 'match.concede'
      ? undefined
      : resolvePhaseActionViolation(currentState, action)

  if (phaseActionViolation !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      phaseActionViolation,
    )
  }

  const baseResult = (() => {
    switch (action.type) {
      case 'match.ready':
        return applyMatchReadyTransition(transitionId, currentState, action)
      case 'match.start':
        return applyMatchStartTransition(transitionId, currentState, action)
      case 'match.concede':
        return applyMatchConcedeTransition(transitionId, currentState, action)
      case 'system.begin_mulligan':
        return applyBeginMulliganTransition(transitionId, currentState, action)
      case 'system.drive_check':
        return applyDriveCheckTransition(transitionId, currentState, action)
      case 'system.resolve_combat':
        return applyResolveCombatTransition(transitionId, currentState, action)
      case 'system.damage_check':
        return applyDamageCheckTransition(transitionId, currentState, action)
      case 'piece.rest':
        return applyRestPieceTransition(transitionId, currentState, action)
      case 'piece.stand':
        return applyStandPieceTransition(transitionId, currentState, action)
      case 'piece.lock':
        return applyLockPieceTransition(transitionId, currentState, action)
      case 'piece.unlock':
        return applyUnlockPieceTransition(transitionId, currentState, action)
      case 'turn.end_phase':
        return applyEndPhaseTransition(transitionId, currentState, action)
      case 'turn.end_turn':
        return applyEndTurnTransition(transitionId, currentState, action)
      case 'system.advance_phase':
        return applyAdvancePhaseTransition(transitionId, currentState, action)
      case 'system.resolve_mandatory_flow':
        return action.scope === 'turn'
          ? applyResolveTurnMandatoryFlowTransition(
              transitionId,
              currentState,
              action,
            )
          : applyResolveMandatoryFlowTransition(
              transitionId,
              currentState,
              action,
            )
      case 'zone.shuffle':
        return applyShuffleZoneTransition(transitionId, currentState, action)
      case 'zone.draw':
        return applyDrawCardsTransition(transitionId, currentState, action)
      case 'zone.move_piece':
        return applyMovePieceTransition(transitionId, currentState, action)
      case 'card.ride':
        return applyRideCardTransition(transitionId, currentState, action)
      case 'card.call':
        return applyCallCardTransition(transitionId, currentState, action)
      case 'battle.declare_attack':
        return applyDeclareAttackTransition(transitionId, currentState, action)
      case 'battle.commit_boost':
        return applyCommitBoostTransition(transitionId, currentState, action)
      case 'battle.guard':
        return applyGuardTransition(transitionId, currentState, action)
      default:
        return createInvalidTransitionResult(
          transitionId,
          currentState,
          'unsupported_action',
          `Action type ${action.type} is not implemented by the reducer foundation yet.`,
        )
    }
  })()

  return resolveEventTriggeredEffects({
    currentState,
    result: baseResult,
  })
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

  if (
    blockingRequest.type === 'mulligan.select_cards' &&
    response.type === 'answer.mulligan'
  ) {
    const choiceResponseEvent = createChoiceResponseResolvedEvent(
      transitionId,
      blockingRequest,
      response,
    )

    return resolveEventTriggeredEffects({
      currentState,
      result: applyMulliganChoiceResponseTransition(
        transitionId,
        currentState,
        blockingRequest,
        response,
        choiceResponseEvent,
      ),
    })
  }

  if (
    blockingRequest.type === 'battle.guard_select' &&
    (response.type === 'answer.guard' || response.type === 'answer.pass')
  ) {
    const choiceResponseEvent = createChoiceResponseResolvedEvent(
      transitionId,
      blockingRequest,
      response,
    )

    return resolveEventTriggeredEffects({
      currentState,
      result: applyGuardChoiceResponseTransition(
        transitionId,
        currentState,
        blockingRequest,
        response,
        choiceResponseEvent,
      ),
    })
  }

  const choiceResponseEvent = createChoiceResponseResolvedEvent(
    transitionId,
    blockingRequest,
    response,
  )
  const remainingRequests = currentState.pendingRequests.slice(1)
  const nextState = advanceGameStateRevision({
    ...currentState,
    status: deriveStatusAfterChoiceResolution(currentState, remainingRequests),
    pendingRequests: remainingRequests,
  })

  return resolveEventTriggeredEffects({
    currentState,
    result: createTransitionResult(
      transitionId,
      nextState,
      [choiceResponseEvent],
      {
        inputKind: 'choice_response',
        timingWindows: createTransitionTimingWindowTriplet('choice.response', {
          relatedEventSequence: choiceResponseEvent.sequence,
          requestId: blockingRequest.requestId,
        }),
      },
    ),
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
  const { battle: _activeBattle, ...stateWithoutBattle } = currentState
  const nextState = advanceGameStateRevision({
    ...stateWithoutBattle,
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

  const relocation = resolveZoneTransfer(currentState, {
    pieceId: action.pieceId,
    from: action.from,
    to: action.to,
    reason: action.reason,
  })

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
    pieceStates: relocation.pieceStates,
  })
  const events: readonly GameEvent[] = [
    ...createPieceMovedEvents(
      transitionId,
      [relocation.transfer],
      createEventOrigin(action.actor),
      {
        sourceActionId: action.actionId,
      },
    ),
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('zone.transfer', {
      relatedEventSequence: 0,
      pieceId: action.pieceId,
    }),
  })
}

function createChoiceResponseResolvedEvent(
  transitionId: TransitionId,
  request: GameChoiceRequest,
  response: GameChoiceResponse,
): Extract<GameEvent, { readonly type: 'choice.response_resolved' }> {
  const base = {
    eventId: createEventId(transitionId, 0),
    type: 'choice.response_resolved' as const,
    sequence: 0,
    ...(request.context?.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: request.context.sourceActionId,
        }),
    origin: {
      kind: 'player' as const,
      playerId: response.responderPlayerId,
    },
    requestId: request.requestId,
    requestType: request.type,
    responseType: response.type,
    responderPlayerId: response.responderPlayerId,
    purpose: request.purpose,
    visibility: request.visibility,
    outcome: resolveChoiceResponseOutcome(response),
  }

  switch (response.type) {
    case 'answer.pieces':
      return {
        ...base,
        selectedPieceIds: response.selectedPieceIds,
      }
    case 'answer.target':
      return {
        ...base,
        selectedTargets: response.selectedTargets,
      }
    case 'answer.zone':
      return {
        ...base,
        selectedLocations: response.selectedLocations,
      }
    case 'answer.option':
      return {
        ...base,
        selectedOptionIds: response.selectedOptionIds,
      }
    case 'answer.guard':
      return {
        ...base,
        selectedPieceIds: response.selectedPieceIds,
      }
    case 'answer.mulligan':
      return {
        ...base,
        returnedPieceIds: response.returnedPieceIds,
      }
    case 'answer.boolean':
      return {
        ...base,
        accepted: response.accepted,
      }
    case 'answer.pass':
      return {
        ...base,
        skipReason: response.reason,
      }
  }
}

function resolveChoiceResponseOutcome(
  response: GameChoiceResponse,
): Extract<
  GameEvent,
  { readonly type: 'choice.response_resolved' }
>['outcome'] {
  switch (response.type) {
    case 'answer.option':
      return 'branch_chosen'
    case 'answer.boolean':
      return response.accepted ? 'boolean_confirmed' : 'boolean_declined'
    case 'answer.pass':
      return 'optional_declined'
    case 'answer.pieces':
    case 'answer.target':
    case 'answer.zone':
    case 'answer.guard':
    case 'answer.mulligan':
      return 'selection_made'
  }
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

function resolveBattleSequenceViolation(
  currentState: GameState,
  actionType: ActionTransitionInput['submission']['action']['type'],
): string | undefined {
  const battle = currentState.battle

  if (battle === undefined) {
    return undefined
  }

  switch (battle.status) {
    case 'attack_declared':
      return actionType === 'battle.commit_boost' ||
        actionType === 'battle.guard'
        ? undefined
        : `Action ${actionType} cannot be applied while battle ${battle.battleId} is waiting for boost or guard progression.`
    case 'boost_declared':
      return actionType === 'battle.guard'
        ? undefined
        : `Action ${actionType} cannot be applied while battle ${battle.battleId} is waiting for guard progression.`
    case 'guard_requested':
      return `Action ${actionType} cannot be applied while battle ${battle.battleId} is waiting for guard choice resolution.`
    case 'guard_resolved':
      return actionType === 'system.drive_check' ||
        actionType === 'system.resolve_combat'
        ? undefined
        : `Action ${actionType} cannot be applied while battle ${battle.battleId} is awaiting drive check or combat comparison progression.`
    case 'drive_checked':
      return actionType === 'system.resolve_combat'
        ? undefined
        : `Action ${actionType} cannot be applied while battle ${battle.battleId} is awaiting combat comparison progression.`
    case 'combat_resolved':
      return actionType === 'system.damage_check' ||
        actionType === 'system.resolve_mandatory_flow'
        ? undefined
        : `Action ${actionType} cannot be applied while battle ${battle.battleId} is awaiting hit/miss follow-up progression.`
    case 'damage_checked':
      return actionType === 'system.resolve_mandatory_flow'
        ? undefined
        : `Action ${actionType} cannot be applied while battle ${battle.battleId} is awaiting downstream battle completion.`
    default:
      return `Action ${actionType} cannot be applied while battle ${battle.battleId} is active.`
  }
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
