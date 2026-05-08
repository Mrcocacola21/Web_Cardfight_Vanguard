import type {
  CommitBoostAction,
  DeclareAttackAction,
  GuardAction,
} from '../actions'
import type { BattleId, EventId, RequestId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type {
  GuardChoiceRequest,
  GuardChoiceResponse,
  PassChoiceResponse,
} from '../requests'
import type {
  GamePieceState,
  GameState,
  PlayerState,
  ZoneState,
} from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type TransitionResult,
} from './transition'
import {
  findZoneById,
  movePiecesByIdBetweenZones,
} from './ordered-zone-operations'
import {
  applyRestPieceStateChange,
  LOCKED_PIECE_FLAG,
  resolveGamePieceStatusState,
} from './piece-state-flags'
import { createPieceMovedEvents } from './zone-transfer'

interface PieceLocation {
  readonly piece: GamePieceState
  readonly zone: ZoneState
}

export function applyDeclareAttackTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: DeclareAttackAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  if (currentState.battle !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} cannot start a new battle while battle ${currentState.battle.battleId} is still active.`,
    )
  }

  const actingPlayer = findPlayerById(currentState, action.actor.playerId)

  if (actingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
    )
  }

  if (currentState.turn.turnPlayerId !== actingPlayer.playerId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the acting player ${actingPlayer.playerId} to be the current turn player.`,
    )
  }

  const attackerLocation = findPieceLocation(
    currentState,
    action.attackerPieceId,
  )

  if (attackerLocation === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown attacker piece ${action.attackerPieceId}.`,
    )
  }

  const attackerController = resolvePieceController(attackerLocation.piece)

  if (attackerController !== actingPlayer.playerId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} cannot use attacker piece ${action.attackerPieceId} for player ${actingPlayer.playerId}.`,
    )
  }

  if (
    attackerLocation.zone.kind !== 'vanguard_circle' &&
    attackerLocation.zone.kind !== 'rear_guard_circle'
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires attacker piece ${action.attackerPieceId} to be on a vanguard or rear-guard circle.`,
    )
  }

  const defendingPlayerIdResult = resolveDefendingPlayerId(
    currentState,
    actingPlayer.playerId,
    action.target,
  )

  if ('code' in defendingPlayerIdResult) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      defendingPlayerIdResult.code,
      defendingPlayerIdResult.message,
    )
  }

  const attackerRestResult = applyRestPieceStateChange(
    currentState,
    action.attackerPieceId,
    transitionId,
    0,
    createPlayerEventOrigin(actingPlayer.playerId),
    action.actionId,
  )

  if (!attackerRestResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      attackerRestResult.code,
      attackerRestResult.message,
    )
  }

  const battleId = createBattleId(transitionId)
  const nextState = advanceGameStateRevision({
    ...currentState,
    pieceStates: attackerRestResult.pieceStates,
    battle: {
      battleId,
      status: 'attack_declared',
      attackingPlayerId: actingPlayer.playerId,
      defendingPlayerId: defendingPlayerIdResult.defendingPlayerId,
      attackerPieceId: action.attackerPieceId,
      attackerZoneId: attackerLocation.zone.zoneId,
      target: action.target,
      guardPieceIds: [],
    },
  })
  const events: readonly GameEvent[] = [
    attackerRestResult.event,
    {
      eventId: createBattleEventId(transitionId, 1),
      type: 'battle.attack_declared',
      sequence: 1,
      sourceActionId: action.actionId,
      origin: createPlayerEventOrigin(actingPlayer.playerId),
      battleId,
      attackerPieceId: action.attackerPieceId,
      target: action.target,
    },
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.attack', {
      relatedEventSequence: 1,
      battleId,
      pieceId: action.attackerPieceId,
    }),
  })
}

export function applyCommitBoostTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: CommitBoostAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  const battle = currentState.battle

  if (battle === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires an active battle.`,
    )
  }

  if (battle.status !== 'attack_declared') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} is only available immediately after attack declaration.`,
    )
  }

  if (battle.attackingPlayerId !== action.actor.playerId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can only be used by the attacking player ${battle.attackingPlayerId}.`,
    )
  }

  if (battle.attackerPieceId !== action.attackerPieceId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} must reference the active attacker ${battle.attackerPieceId}.`,
    )
  }

  if (battle.boostingPieceId !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Battle ${battle.battleId} already has a boosting piece ${battle.boostingPieceId}.`,
    )
  }

  if (action.boosterPieceId === action.attackerPieceId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} cannot use the attacker as its own booster.`,
    )
  }

  const boosterLocation = findPieceLocation(currentState, action.boosterPieceId)

  if (boosterLocation === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown booster piece ${action.boosterPieceId}.`,
    )
  }

  const boosterController = resolvePieceController(boosterLocation.piece)

  if (boosterController !== action.actor.playerId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} cannot use booster piece ${action.boosterPieceId} for player ${action.actor.playerId}.`,
    )
  }

  if (boosterLocation.zone.kind !== 'rear_guard_circle') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the boosting piece ${action.boosterPieceId} to be on a rear-guard circle under the current simplified battle foundation.`,
    )
  }

  const boosterRestResult = applyRestPieceStateChange(
    currentState,
    action.boosterPieceId,
    transitionId,
    0,
    createPlayerEventOrigin(action.actor.playerId),
    action.actionId,
  )

  if (!boosterRestResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      boosterRestResult.code,
      boosterRestResult.message,
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    pieceStates: boosterRestResult.pieceStates,
    battle: {
      ...battle,
      status: 'boost_declared',
      boostingPieceId: action.boosterPieceId,
      boostingZoneId: boosterLocation.zone.zoneId,
    },
  })
  const events: readonly GameEvent[] = [
    boosterRestResult.event,
    {
      eventId: createBattleEventId(transitionId, 1),
      type: 'battle.boost_declared',
      sequence: 1,
      sourceActionId: action.actionId,
      origin: createPlayerEventOrigin(action.actor.playerId),
      battleId: battle.battleId,
      attackerPieceId: action.attackerPieceId,
      boosterPieceId: action.boosterPieceId,
    },
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.boost', {
      relatedEventSequence: 1,
      battleId: battle.battleId,
      pieceId: action.boosterPieceId,
    }),
  })
}

export function applyGuardTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: GuardAction,
): TransitionResult {
  if (currentState.status !== 'in_progress') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the match to be in progress.`,
    )
  }

  const battle = currentState.battle

  if (battle === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires an active battle.`,
    )
  }

  if (
    battle.status !== 'attack_declared' &&
    battle.status !== 'boost_declared'
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} is not available while battle ${battle.battleId} is in status ${battle.status}.`,
    )
  }

  if (battle.defendingPlayerId !== action.actor.playerId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can only be used by defending player ${battle.defendingPlayerId}.`,
    )
  }

  if (battle.attackerPieceId !== action.againstAttackerPieceId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} must reference the active attacker ${battle.attackerPieceId}.`,
    )
  }

  const defendingPlayer = findPlayerById(currentState, battle.defendingPlayerId)

  if (defendingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Battle ${battle.battleId} references an unknown defending player ${battle.defendingPlayerId}.`,
    )
  }

  const handZone = findOwnedZoneByKind(currentState, defendingPlayer, 'hand')
  const guardZone = findOwnedZoneByKind(
    currentState,
    defendingPlayer,
    'guardian_circle',
  )

  if (handZone === undefined || guardZone === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} requires defending player ${defendingPlayer.playerId} to own both hand and guardian circle zones.`,
    )
  }

  if (guardZone.layout.occupancy !== 'multi') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires guardian circle ${guardZone.zoneId} to support multi-piece guard commitments.`,
    )
  }

  const requestId = createBattleGuardRequestId(transitionId)
  const eligiblePieceIds = handZone.occupants.map(
    (occupant) => occupant.pieceId,
  )
  const request: GuardChoiceRequest = {
    requestId,
    type: 'battle.guard_select',
    responderPlayerId: defendingPlayer.playerId,
    purpose: 'battle',
    visibility: 'responder-only',
    allowPass: true,
    battleId: battle.battleId,
    handZoneId: handZone.zoneId,
    guardZoneId: guardZone.zoneId,
    attackerPieceId: battle.attackerPieceId,
    minSelections: 0,
    maxSelections: eligiblePieceIds.length,
    eligiblePieceIds,
    context: {
      sourceActionId: action.actionId,
      relatedPieceIds:
        eligiblePieceIds.length === 0
          ? [battle.attackerPieceId]
          : [battle.attackerPieceId, ...eligiblePieceIds],
      relatedZoneIds: [handZone.zoneId, guardZone.zoneId],
    },
  }
  const nextState = advanceGameStateRevision({
    ...currentState,
    status: 'awaiting_choice',
    battle: {
      ...battle,
      status: 'guard_requested',
      guardRequestId: requestId,
      guardZoneId: guardZone.zoneId,
      guardPieceIds: [],
    },
    pendingRequests: [request],
  })
  const events: readonly GameEvent[] = [
    {
      eventId: createBattleEventId(transitionId, 0),
      type: 'battle.guard_requested',
      sequence: 0,
      sourceActionId: action.actionId,
      origin: createPlayerEventOrigin(defendingPlayer.playerId),
      battleId: battle.battleId,
      requestId,
      defendingPlayerId: defendingPlayer.playerId,
      attackerPieceId: battle.attackerPieceId,
    },
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.guard', {
      relatedEventSequence: 0,
      battleId: battle.battleId,
      requestId,
    }),
  })
}

export function applyGuardChoiceResponseTransition(
  transitionId: TransitionId,
  currentState: GameState,
  request: GuardChoiceRequest,
  response: GuardChoiceResponse | PassChoiceResponse,
  choiceResponseEvent: Extract<
    GameEvent,
    { readonly type: 'choice.response_resolved' }
  >,
): TransitionResult {
  const battle = currentState.battle

  if (
    battle === undefined ||
    battle.battleId !== request.battleId ||
    battle.guardRequestId !== request.requestId
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'request_response_mismatch',
      `Pending battle guard request ${request.requestId} no longer matches the current battle state.`,
      { inputKind: 'choice_response' },
    )
  }

  const defendingPlayer = findPlayerById(
    currentState,
    request.responderPlayerId,
  )

  if (defendingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Pending battle guard request ${request.requestId} references an unknown defending player ${request.responderPlayerId}.`,
      { inputKind: 'choice_response' },
    )
  }

  const handZone = findZoneById(currentState, request.handZoneId)
  const guardZone = findZoneById(currentState, request.guardZoneId)

  if (
    handZone === undefined ||
    guardZone === undefined ||
    handZone.ownerPlayerId !== defendingPlayer.playerId ||
    guardZone.ownerPlayerId !== defendingPlayer.playerId
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Pending battle guard request ${request.requestId} references invalid defending zones.`,
      { inputKind: 'choice_response' },
    )
  }

  const currentHandPieceIds = handZone.occupants.map(
    (occupant) => occupant.pieceId,
  )

  if (!haveExactMembers(currentHandPieceIds, request.eligiblePieceIds)) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'request_response_mismatch',
      `Pending battle guard request ${request.requestId} no longer matches the current defending hand state.`,
      { inputKind: 'choice_response' },
    )
  }

  if (response.type === 'answer.pass') {
    const guardPassedEvent: Extract<
      GameEvent,
      { readonly type: 'battle.guard_passed' }
    > = {
      eventId: createBattleEventId(transitionId, 1),
      type: 'battle.guard_passed',
      sequence: 1,
      ...(request.context?.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: request.context.sourceActionId,
          }),
      origin: createPlayerEventOrigin(defendingPlayer.playerId),
      battleId: battle.battleId,
      requestId: request.requestId,
      handZoneId: request.handZoneId,
      guardZoneId: request.guardZoneId,
      attackerPieceId: battle.attackerPieceId,
    }
    const nextState = advanceGameStateRevision({
      ...currentState,
      status: 'in_progress',
      battle: clearGuardRequestId({
        ...battle,
        status: 'guard_resolved',
        guardPieceIds: [],
        guardZoneId: request.guardZoneId,
      }),
      pendingRequests: currentState.pendingRequests.slice(1),
    })

    return createTransitionResult(
      transitionId,
      nextState,
      [choiceResponseEvent, guardPassedEvent],
      {
        inputKind: 'choice_response',
        timingWindows: [
          ...createTransitionTimingWindowTriplet('choice.response', {
            relatedEventSequence: choiceResponseEvent.sequence,
            requestId: request.requestId,
          }),
          ...createTransitionTimingWindowTriplet('battle.guard', {
            startingSequence: 3,
            relatedEventSequence: guardPassedEvent.sequence,
            battleId: battle.battleId,
            requestId: request.requestId,
          }),
        ],
      },
    )
  }

  const guardMoveResult = movePiecesByIdBetweenZones(
    currentState,
    response.selectedPieceIds,
    request.handZoneId,
    request.guardZoneId,
    'guard',
  )

  if (!guardMoveResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      guardMoveResult.code,
      guardMoveResult.message,
      { inputKind: 'choice_response' },
    )
  }

  const nextState = advanceGameStateRevision({
    ...currentState,
    status: 'in_progress',
    battle: clearGuardRequestId({
      ...battle,
      status: 'guard_resolved',
      guardZoneId: request.guardZoneId,
      guardPieceIds: response.selectedPieceIds,
    }),
    pendingRequests: currentState.pendingRequests.slice(1),
    zones: guardMoveResult.zones,
    pieceStates: guardMoveResult.pieceStates,
  })
  const pieceMovedEvents = createPieceMovedEvents(
    transitionId,
    guardMoveResult.movedPieces,
    createPlayerEventOrigin(defendingPlayer.playerId),
    {
      startingSequence: 1,
    },
  )
  const events: readonly GameEvent[] = [
    choiceResponseEvent,
    ...pieceMovedEvents,
    {
      eventId: createBattleEventId(transitionId, pieceMovedEvents.length + 1),
      type: 'battle.guard_declared',
      sequence: pieceMovedEvents.length + 1,
      origin: createPlayerEventOrigin(defendingPlayer.playerId),
      battleId: battle.battleId,
      guardianPieceIds: response.selectedPieceIds,
      handZoneId: request.handZoneId,
      guardZoneId: request.guardZoneId,
      attackerPieceId: battle.attackerPieceId,
    },
  ]

  return createTransitionResult(transitionId, nextState, events, {
    inputKind: 'choice_response',
    timingWindows: [
      ...createTransitionTimingWindowTriplet('choice.response', {
        relatedEventSequence: choiceResponseEvent.sequence,
        requestId: request.requestId,
      }),
      ...createTransitionTimingWindowTriplet('battle.guard', {
        startingSequence: 3,
        relatedEventSequence: pieceMovedEvents.length + 1,
        battleId: battle.battleId,
        requestId: request.requestId,
      }),
    ],
  })
}

function findPlayerById(
  currentState: GameState,
  playerId: PlayerState['playerId'],
): PlayerState | undefined {
  return currentState.players.find((player) => player.playerId === playerId)
}

function findPieceLocation(
  currentState: GameState,
  pieceId: GamePieceState['pieceId'],
): PieceLocation | undefined {
  const piece = currentState.pieces.find(
    (candidate) => candidate.pieceId === pieceId,
  )

  if (piece === undefined) {
    return undefined
  }

  const zone = currentState.zones.find((candidate) =>
    candidate.occupants.some((occupant) => occupant.pieceId === pieceId),
  )

  if (zone === undefined) {
    return undefined
  }

  return {
    piece,
    zone,
  }
}

function resolvePieceController(
  piece: GamePieceState,
): PlayerState['playerId'] | undefined {
  return piece.controllerPlayerId ?? piece.ownerPlayerId
}

function clearGuardRequestId(
  battle: GameState['battle'] extends infer TBattle
    ? NonNullable<TBattle>
    : never,
): NonNullable<GameState['battle']> {
  const { guardRequestId: _guardRequestId, ...nextBattle } = battle

  return nextBattle
}

function findOwnedZoneByKind(
  currentState: GameState,
  player: PlayerState,
  kind: ZoneState['kind'],
): ZoneState | undefined {
  return currentState.zones.find(
    (zone) => zone.ownerPlayerId === player.playerId && zone.kind === kind,
  )
}

function resolveDefendingPlayerId(
  currentState: GameState,
  attackingPlayerId: PlayerState['playerId'],
  target: DeclareAttackAction['target'],
):
  | {
      readonly defendingPlayerId: PlayerState['playerId']
    }
  | {
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    } {
  if (target.kind === 'player') {
    if (target.playerId === attackingPlayerId) {
      return {
        code: 'invalid_action',
        message: `Attack target player ${target.playerId} must not be the attacking player.`,
      }
    }

    const defendingPlayer = findPlayerById(currentState, target.playerId)

    if (defendingPlayer === undefined) {
      return {
        code: 'invalid_action_reference',
        message: `Attack target player ${target.playerId} does not exist in the current game state.`,
      }
    }

    return { defendingPlayerId: defendingPlayer.playerId }
  }

  const targetLocation = findPieceLocation(currentState, target.pieceId)

  if (targetLocation === undefined) {
    return {
      code: 'invalid_action_reference',
      message: `Attack target piece ${target.pieceId} does not exist in the current game state.`,
    }
  }

  if (
    targetLocation.zone.kind !== 'vanguard_circle' &&
    targetLocation.zone.kind !== 'rear_guard_circle'
  ) {
    return {
      code: 'invalid_action',
      message: `Attack target piece ${target.pieceId} must be on a vanguard or rear-guard circle.`,
    }
  }

  const targetState = resolveGamePieceStatusState(currentState, target.pieceId)

  if (targetState.flags.includes(LOCKED_PIECE_FLAG)) {
    return {
      code: 'invalid_action',
      message: `Attack target piece ${target.pieceId} cannot be chosen while it is locked.`,
    }
  }

  const defendingPlayerId = resolvePieceController(targetLocation.piece)

  if (defendingPlayerId === undefined) {
    return {
      code: 'invalid_action_reference',
      message: `Attack target piece ${target.pieceId} does not reference a defending player.`,
    }
  }

  if (defendingPlayerId === attackingPlayerId) {
    return {
      code: 'invalid_action',
      message: `Attack target piece ${target.pieceId} must not be controlled by the attacking player.`,
    }
  }

  return { defendingPlayerId }
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

function createBattleId(transitionId: TransitionId): BattleId {
  return `${transitionId}:battle` as BattleId
}

function createBattleGuardRequestId(transitionId: TransitionId): RequestId {
  return `${transitionId}:request:guard` as RequestId
}

function createBattleEventId(
  transitionId: TransitionId,
  sequence: number,
): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}

function createPlayerEventOrigin(
  playerId: PlayerState['playerId'],
): Extract<GameEvent['origin'], { readonly kind: 'player' }> {
  return {
    kind: 'player',
    playerId,
  }
}
