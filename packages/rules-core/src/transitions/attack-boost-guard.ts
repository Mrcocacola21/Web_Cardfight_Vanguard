import type {
  CommitBoostAction,
  DeclareAttackAction,
  GuardAction,
} from '../actions'
import {
  isFrontRowBoardPosition,
  resolveBoardPositionForOccupant,
  resolveBoardPositionForPiece,
  resolveBoostRelation,
} from '../board'
import { resolveGamePieceCardStats } from '../cards'
import type { BattleId, EventId, RequestId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import { INTERCEPT_KEYWORD } from '../keywords'
import type {
  GuardChoiceRequest,
  GuardChoiceResponse,
  PassChoiceResponse,
} from '../requests'
import type {
  GamePieceState,
  GameState,
  GameStateIndex,
  PlayerState,
  ZoneState,
} from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceLocation,
  findPlayerById,
  findZoneById,
  listOwnedZonesByKind,
} from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type TransitionResult,
} from './transition'
import { movePiecesByIdBetweenZones } from './ordered-zone-operations'
import {
  applyRestPieceStateChange,
  LOCKED_PIECE_FLAG,
  resolveGamePieceStatusState,
} from './piece-state-flags'
import {
  createPieceMovedEvents,
  resolveZoneTransferSequence,
} from './zone-transfer'
import { resolveFirstTurnAttackLegality } from './vanguard-legality'

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

  const stateIndex = buildGameStateIndex(currentState)
  const actingPlayer = findPlayerById(stateIndex, action.actor.playerId)

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

  const attackLegality = resolveFirstTurnAttackLegality({
    currentState,
    actionType: action.type,
  })

  if (!attackLegality.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      attackLegality.code,
      attackLegality.message,
    )
  }

  const attackerLocation = findPieceLocation(stateIndex, action.attackerPieceId)

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

  const attackerBoardPosition = resolveBoardPositionForPiece(
    currentState,
    action.attackerPieceId,
  )

  if (!attackerBoardPosition.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      attackerBoardPosition.issue.message,
    )
  }

  if (!isFrontRowBoardPosition(attackerBoardPosition.position)) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires attacker piece ${action.attackerPieceId} to be on a front-row battlefield circle.`,
    )
  }

  const defendingPlayerIdResult = resolveDefendingPlayerId(
    currentState,
    stateIndex,
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

  const stateIndex = buildGameStateIndex(currentState)
  const boosterLocation = findPieceLocation(stateIndex, action.boosterPieceId)

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

  const boostRelation = resolveBoostRelation(
    currentState,
    action.attackerPieceId,
    action.boosterPieceId,
  )

  if (!boostRelation.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      boostRelation.issue.message,
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

  const stateIndex = buildGameStateIndex(currentState)
  const defendingPlayer = findPlayerById(stateIndex, battle.defendingPlayerId)

  if (defendingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Battle ${battle.battleId} references an unknown defending player ${battle.defendingPlayerId}.`,
    )
  }

  const handZone = findOwnedZoneByKind(stateIndex, defendingPlayer, 'hand')
  const guardZone = findOwnedZoneByKind(
    stateIndex,
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
  const eligibleInterceptPieceIds = resolveEligibleInterceptPieceIds(
    currentState,
    stateIndex,
    defendingPlayer,
  )
  const eligibleGuardianPieceIds = [
    ...eligiblePieceIds,
    ...eligibleInterceptPieceIds,
  ]
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
    maxSelections: eligibleGuardianPieceIds.length,
    eligiblePieceIds: eligibleGuardianPieceIds,
    handPieceIds: eligiblePieceIds,
    interceptPieceIds: eligibleInterceptPieceIds,
    context: {
      sourceActionId: action.actionId,
      relatedPieceIds:
        eligibleGuardianPieceIds.length === 0
          ? [battle.attackerPieceId]
          : [battle.attackerPieceId, ...eligibleGuardianPieceIds],
      relatedZoneIds: Array.from(
        new Set([
          handZone.zoneId,
          guardZone.zoneId,
          ...resolveInterceptSourceZoneIds(
            stateIndex,
            eligibleInterceptPieceIds,
          ),
        ]),
      ),
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

  const stateIndex = buildGameStateIndex(currentState)
  const defendingPlayer = findPlayerById(stateIndex, request.responderPlayerId)

  if (defendingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Pending battle guard request ${request.requestId} references an unknown defending player ${request.responderPlayerId}.`,
      { inputKind: 'choice_response' },
    )
  }

  const handZone = findZoneById(stateIndex, request.handZoneId)
  const guardZone = findZoneById(stateIndex, request.guardZoneId)

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
  const requestHandPieceIds = request.handPieceIds ?? request.eligiblePieceIds
  const requestInterceptPieceIds = request.interceptPieceIds ?? []

  if (!haveExactMembers(currentHandPieceIds, requestHandPieceIds)) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'request_response_mismatch',
      `Pending battle guard request ${request.requestId} no longer matches the current defending hand state.`,
      { inputKind: 'choice_response' },
    )
  }

  if (requestInterceptPieceIds.length > 0) {
    const currentInterceptPieceIds = resolveEligibleInterceptPieceIds(
      currentState,
      stateIndex,
      defendingPlayer,
    )

    if (!haveExactMembers(currentInterceptPieceIds, requestInterceptPieceIds)) {
      return createInvalidTransitionResult(
        transitionId,
        currentState,
        'request_response_mismatch',
        `Pending battle guard request ${request.requestId} no longer matches the current intercept state.`,
        { inputKind: 'choice_response' },
      )
    }
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

  const selectedHandPieceIds = response.selectedPieceIds.filter((pieceId) =>
    requestHandPieceIds.includes(pieceId),
  )
  const selectedInterceptPieceIds = response.selectedPieceIds.filter(
    (pieceId) => requestInterceptPieceIds.includes(pieceId),
  )
  const handMoveResult =
    selectedHandPieceIds.length === 0
      ? {
          ok: true as const,
          zones: currentState.zones,
          pieceStates: currentState.pieceStates,
          movedPieces: [],
        }
      : movePiecesByIdBetweenZones(
          currentState,
          selectedHandPieceIds,
          request.handZoneId,
          request.guardZoneId,
          'guard',
        )

  if (!handMoveResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      handMoveResult.code,
      handMoveResult.message,
      { inputKind: 'choice_response' },
    )
  }

  const stateAfterHandGuards: GameState = {
    ...currentState,
    zones: handMoveResult.zones,
    pieceStates: handMoveResult.pieceStates,
  }
  const stateAfterHandGuardsIndex = buildGameStateIndex(stateAfterHandGuards)
  const interceptMoveResult =
    selectedInterceptPieceIds.length === 0
      ? {
          ok: true as const,
          zones: stateAfterHandGuards.zones,
          pieceStates: stateAfterHandGuards.pieceStates,
          transfers: [],
        }
      : resolveZoneTransferSequence(
          stateAfterHandGuards,
          selectedInterceptPieceIds.map((pieceId) => {
            const location = findPieceLocation(
              stateAfterHandGuardsIndex,
              pieceId,
            )

            return {
              pieceId,
              from: {
                zoneId: location?.zone.zoneId ?? request.guardZoneId,
              },
              to: {
                zoneId: request.guardZoneId,
              },
              reason: 'intercept' as const,
            }
          }),
        )

  if (!interceptMoveResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      interceptMoveResult.code,
      interceptMoveResult.message,
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
    zones: interceptMoveResult.zones,
    pieceStates: interceptMoveResult.pieceStates,
  })
  const handMovedEvents = createPieceMovedEvents(
    transitionId,
    handMoveResult.movedPieces,
    createPlayerEventOrigin(defendingPlayer.playerId),
    {
      startingSequence: 1,
    },
  )
  const interceptMovedEvents = createPieceMovedEvents(
    transitionId,
    interceptMoveResult.transfers,
    createPlayerEventOrigin(defendingPlayer.playerId),
    {
      startingSequence: 1 + handMovedEvents.length,
    },
  )
  const interceptEvent:
    | Extract<GameEvent, { readonly type: 'battle.intercept_declared' }>
    | undefined =
    selectedInterceptPieceIds.length === 0
      ? undefined
      : {
          eventId: createBattleEventId(
            transitionId,
            1 + handMovedEvents.length + interceptMovedEvents.length,
          ),
          type: 'battle.intercept_declared',
          sequence: 1 + handMovedEvents.length + interceptMovedEvents.length,
          origin: createPlayerEventOrigin(defendingPlayer.playerId),
          battleId: battle.battleId,
          interceptPieceIds: selectedInterceptPieceIds,
          fromZoneIds: Array.from(
            new Set(
              interceptMoveResult.transfers.map(
                (transfer) => transfer.from.zoneId,
              ),
            ),
          ),
          guardZoneId: request.guardZoneId,
          attackerPieceId: battle.attackerPieceId,
        }
  const guardDeclaredSequence =
    1 +
    handMovedEvents.length +
    interceptMovedEvents.length +
    (interceptEvent === undefined ? 0 : 1)
  const events: readonly GameEvent[] = [
    choiceResponseEvent,
    ...handMovedEvents,
    ...interceptMovedEvents,
    ...(interceptEvent === undefined ? [] : [interceptEvent]),
    {
      eventId: createBattleEventId(transitionId, guardDeclaredSequence),
      type: 'battle.guard_declared',
      sequence: guardDeclaredSequence,
      origin: createPlayerEventOrigin(defendingPlayer.playerId),
      battleId: battle.battleId,
      guardianPieceIds: response.selectedPieceIds,
      handPieceIds: selectedHandPieceIds,
      interceptPieceIds: selectedInterceptPieceIds,
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
        relatedEventSequence: guardDeclaredSequence,
        battleId: battle.battleId,
        requestId: request.requestId,
      }),
    ],
  })
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

function resolveEligibleInterceptPieceIds(
  currentState: GameState,
  stateIndex: GameStateIndex,
  defendingPlayer: PlayerState,
): readonly GamePieceState['pieceId'][] {
  return listOwnedZonesByKind(stateIndex, defendingPlayer, 'rear_guard_circle')
    .flatMap((zone) =>
      zone.occupants
        .filter((occupant) => {
          const position = resolveBoardPositionForOccupant(zone, occupant)

          return position.ok && isFrontRowBoardPosition(position.position)
        })
        .map((occupant) => occupant.pieceId),
    )
    .filter((pieceId) =>
      isLegalInterceptPiece(
        currentState,
        stateIndex,
        defendingPlayer.playerId,
        pieceId,
      ),
    )
}

function resolveInterceptSourceZoneIds(
  stateIndex: GameStateIndex,
  interceptPieceIds: readonly GamePieceState['pieceId'][],
): readonly ZoneState['zoneId'][] {
  return interceptPieceIds.flatMap((pieceId) => {
    const location = findPieceLocation(stateIndex, pieceId)

    return location === undefined ? [] : [location.zone.zoneId]
  })
}

function isLegalInterceptPiece(
  currentState: GameState,
  stateIndex: GameStateIndex,
  defendingPlayerId: PlayerState['playerId'],
  pieceId: GamePieceState['pieceId'],
): boolean {
  const location = findPieceLocation(stateIndex, pieceId)

  if (
    location === undefined ||
    location.zone.kind !== 'rear_guard_circle' ||
    resolvePieceController(location.piece) !== defendingPlayerId
  ) {
    return false
  }

  const pieceStatus = resolveGamePieceStatusState(currentState, pieceId)

  if (pieceStatus.flags.includes(LOCKED_PIECE_FLAG)) {
    return false
  }

  if (location.piece.keywords?.includes(INTERCEPT_KEYWORD) === true) {
    return true
  }

  const statsResolution = resolveGamePieceCardStats(
    currentState,
    location.piece,
  )

  if (!statsResolution.ok) {
    return false
  }

  return (
    statsResolution.stats.grade === 2 &&
    isUnitCardType(statsResolution.stats.cardType)
  )
}

function isUnitCardType(cardType: string): boolean {
  return cardType === 'normal-unit' || cardType === 'trigger-unit'
}

function resolveDefendingPlayerId(
  currentState: GameState,
  stateIndex: GameStateIndex,
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

    const defendingPlayer = findPlayerById(stateIndex, target.playerId)

    if (defendingPlayer === undefined) {
      return {
        code: 'invalid_action_reference',
        message: `Attack target player ${target.playerId} does not exist in the current game state.`,
      }
    }

    return { defendingPlayerId: defendingPlayer.playerId }
  }

  const targetLocation = findPieceLocation(stateIndex, target.pieceId)

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

  const targetBoardPosition = resolveBoardPositionForPiece(
    currentState,
    target.pieceId,
  )

  if (!targetBoardPosition.ok) {
    return {
      code: 'invalid_action',
      message: targetBoardPosition.issue.message,
    }
  }

  if (!isFrontRowBoardPosition(targetBoardPosition.position)) {
    return {
      code: 'invalid_action',
      message: `Attack target piece ${target.pieceId} must be on a front-row battlefield circle.`,
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
