import type {
  AdvancePhaseAction,
  GameAction,
  ResolveMandatoryFlowAction,
  TurnEndPhaseAction,
  TurnEndTurnAction,
} from '../actions'
import type { EventId, PlayerId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type {
  GamePieceStatusState,
  GameState,
  PhaseId,
  PlayerState,
} from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPlayerById,
  listOwnedZonesByKind,
} from '../state'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  type TransitionResult,
} from './transition'
import { drawTopPiecesBetweenZones } from './ordered-zone-operations'
import {
  applyStandPieceStateChange,
  LOCKED_PIECE_FLAG,
  resolveGamePieceStatusState,
} from './piece-state-flags'
import { createPieceMovedEvents } from './zone-transfer'
import { FACE_DOWN_DAMAGE_FLAG } from '../resources/resource-state'

export const PREGAME_PHASE = 'pregame' as PhaseId
export const TURN_PHASE_STAND = 'stand' as PhaseId
export const TURN_PHASE_DRAW = 'draw' as PhaseId
export const TURN_PHASE_RIDE = 'ride' as PhaseId
export const TURN_PHASE_MAIN = 'main' as PhaseId
export const TURN_PHASE_BATTLE = 'battle' as PhaseId
export const TURN_PHASE_END = 'end' as PhaseId

export const VANGUARD_TURN_PHASES = [
  TURN_PHASE_STAND,
  TURN_PHASE_DRAW,
  TURN_PHASE_RIDE,
  TURN_PHASE_MAIN,
  TURN_PHASE_BATTLE,
  TURN_PHASE_END,
] as const

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const

type PhaseAction =
  | AdvancePhaseAction
  | TurnEndPhaseAction
  | TurnEndTurnAction
  | ResolveMandatoryFlowAction

type PhaseConsequenceResult =
  | {
      readonly ok: true
      readonly state: GameState
      readonly events: readonly GameEvent[]
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    }

interface TurnScopedPieceStateCleanupResult {
  readonly state: GameState
  readonly cleanedPieceIds: readonly GamePieceStatusState['pieceId'][]
  readonly removedFlagPieceIds: readonly GamePieceStatusState['pieceId'][]
  readonly clearedModifierPieceIds: readonly GamePieceStatusState['pieceId'][]
}

export function resolveNextTurnPhase(
  currentPhase: PhaseId,
): PhaseId | undefined {
  if (currentPhase === PREGAME_PHASE) {
    return TURN_PHASE_STAND
  }

  const currentIndex = VANGUARD_TURN_PHASES.indexOf(currentPhase)

  if (currentIndex === -1 || currentIndex >= VANGUARD_TURN_PHASES.length - 1) {
    return undefined
  }

  return VANGUARD_TURN_PHASES[currentIndex + 1]
}

export function isTurnLifecyclePhase(phase: PhaseId): boolean {
  return (VANGUARD_TURN_PHASES as readonly string[]).includes(phase)
}

export function resolvePhaseActionViolation(
  currentState: GameState,
  action: GameAction,
): string | undefined {
  if (currentState.status !== 'in_progress') {
    return undefined
  }

  const turnOwnedPlayerActionViolation = resolveTurnOwnedPlayerActionViolation(
    currentState,
    action,
  )

  if (turnOwnedPlayerActionViolation !== undefined) {
    return turnOwnedPlayerActionViolation
  }

  const requiredPhase = resolveRequiredPhaseForAction(action)

  if (
    requiredPhase === undefined ||
    currentState.turn.phase === requiredPhase
  ) {
    return undefined
  }

  return `Action ${action.type} requires ${requiredPhase} phase, but the current phase is ${currentState.turn.phase}.`
}

export function applyAdvancePhaseTransition(
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

  const expectedNextPhase = resolveNextTurnPhase(currentState.turn.phase)

  if (expectedNextPhase === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} cannot advance from terminal phase ${currentState.turn.phase}; end the turn instead.`,
    )
  }

  if (action.nextPhase !== expectedNextPhase) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} must advance from ${currentState.turn.phase} to ${expectedNextPhase}, not ${action.nextPhase}.`,
    )
  }

  return applyPhaseAdvance(transitionId, currentState, action, action.nextPhase)
}

export function applyEndPhaseTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: TurnEndPhaseAction,
): TransitionResult {
  const playerValidation = validateCurrentTurnPlayerAction(
    transitionId,
    currentState,
    action,
  )

  if (!playerValidation.ok) {
    return playerValidation.result
  }

  const nextPhase = resolveNextTurnPhase(currentState.turn.phase)

  if (nextPhase === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} cannot advance from ${currentState.turn.phase}; use turn.end_turn from the end phase.`,
    )
  }

  return applyPhaseAdvance(transitionId, currentState, action, nextPhase)
}

export function applyEndTurnTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: TurnEndTurnAction,
): TransitionResult {
  const playerValidation = validateCurrentTurnPlayerAction(
    transitionId,
    currentState,
    action,
  )

  if (!playerValidation.ok) {
    return playerValidation.result
  }

  return applyTurnSwitch(transitionId, currentState, action)
}

export function applyResolveTurnMandatoryFlowTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: ResolveMandatoryFlowAction,
): TransitionResult {
  if (action.scope !== 'turn') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'unsupported_action',
      `Action ${action.type} cannot resolve non-turn mandatory flow through turn structure.`,
    )
  }

  return applyTurnSwitch(transitionId, currentState, action)
}

function applyPhaseAdvance(
  transitionId: TransitionId,
  currentState: GameState,
  action: PhaseAction,
  nextPhase: PhaseId,
): TransitionResult {
  const stateAfterPhaseChange: GameState = {
    ...currentState,
    turn: {
      turnNumber: currentState.turn.turnNumber,
      turnPlayerId: currentState.turn.turnPlayerId,
      priorityPlayerId: currentState.turn.turnPlayerId,
      phase: nextPhase,
    },
  }
  const phaseEvent: GameEvent = {
    eventId: createEventId(transitionId, 0),
    type: 'turn.phase_advanced',
    sequence: 0,
    sourceActionId: action.actionId,
    origin: createSystemFlowOrigin(action),
    turnNumber: currentState.turn.turnNumber,
    previousPhase: currentState.turn.phase,
    nextPhase,
  }
  const consequenceResult = applyAutomaticPhaseConsequences(
    transitionId,
    stateAfterPhaseChange,
    action,
    nextPhase,
    1,
  )

  if (!consequenceResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      consequenceResult.code,
      consequenceResult.message,
    )
  }

  const nextState = advanceGameStateRevision(consequenceResult.state)

  return createTransitionResult(transitionId, nextState, [
    phaseEvent,
    ...consequenceResult.events,
  ])
}

function applyTurnSwitch(
  transitionId: TransitionId,
  currentState: GameState,
  action: PhaseAction,
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
      `Action ${action.type} cannot end the turn while battle ${currentState.battle.battleId} is active.`,
    )
  }

  if (currentState.turn.phase !== TURN_PHASE_END) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can switch turns only from the end phase, not ${currentState.turn.phase}.`,
    )
  }

  const nextPlayer = resolveNextActivePlayer(currentState)

  if (nextPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} could not resolve the next active player.`,
    )
  }

  const turnCleanup = resolveTurnScopedPieceStateCleanup(currentState)
  const stateAfterTurnCleanup = turnCleanup.state
  const stateAfterTurnSwitch: GameState = {
    ...stateAfterTurnCleanup,
    players: stateAfterTurnCleanup.players.map((player) =>
      player.playerId === nextPlayer.playerId
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
      turnNumber: stateAfterTurnCleanup.turn.turnNumber + 1,
      turnPlayerId: nextPlayer.playerId,
      priorityPlayerId: nextPlayer.playerId,
      phase: TURN_PHASE_STAND,
    },
  }
  const turnEndedEvent: GameEvent = {
    eventId: createEventId(transitionId, 0),
    type: 'turn.ended',
    sequence: 0,
    sourceActionId: action.actionId,
    origin: createActionOrigin(action),
    turnNumber: currentState.turn.turnNumber,
    turnPlayerId: currentState.turn.turnPlayerId,
  }
  const turnCleanupEvent =
    turnCleanup.cleanedPieceIds.length === 0
      ? undefined
      : createTurnCleanupAppliedEvent(
          transitionId,
          currentState,
          action,
          turnCleanup,
          1,
        )
  const turnStartedSequence = turnCleanupEvent === undefined ? 1 : 2
  const turnStartedEvent: GameEvent = {
    eventId: createEventId(transitionId, turnStartedSequence),
    type: 'turn.started',
    sequence: turnStartedSequence,
    sourceActionId: action.actionId,
    origin: createSystemFlowOrigin(action),
    turnNumber: stateAfterTurnSwitch.turn.turnNumber,
    turnPlayerId: nextPlayer.playerId,
  }
  const standResult = applyAutomaticStandConsequences(
    transitionId,
    stateAfterTurnSwitch,
    action,
    turnStartedSequence + 1,
  )

  if (!standResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      standResult.code,
      standResult.message,
    )
  }

  return createTransitionResult(
    transitionId,
    advanceGameStateRevision(standResult.state),
    [
      turnEndedEvent,
      ...(turnCleanupEvent === undefined ? [] : [turnCleanupEvent]),
      turnStartedEvent,
      ...standResult.events,
    ],
  )
}

function applyAutomaticPhaseConsequences(
  transitionId: TransitionId,
  currentState: GameState,
  action: PhaseAction,
  nextPhase: PhaseId,
  startingSequence: number,
): PhaseConsequenceResult {
  if (nextPhase === TURN_PHASE_STAND) {
    return applyAutomaticStandConsequences(
      transitionId,
      currentState,
      action,
      startingSequence,
    )
  }

  if (nextPhase === TURN_PHASE_DRAW) {
    return applyAutomaticDrawConsequences(
      transitionId,
      currentState,
      action,
      startingSequence,
    )
  }

  return {
    ok: true,
    state: currentState,
    events: [],
  }
}

function applyAutomaticStandConsequences(
  transitionId: TransitionId,
  currentState: GameState,
  action: PhaseAction,
  startingSequence: number,
): PhaseConsequenceResult {
  let workingState = currentState
  const events: GameEvent[] = []
  const standCandidatePieceIds = resolveControlledMainUnitPieceIds(
    currentState,
    currentState.turn.turnPlayerId,
  )

  for (const pieceId of standCandidatePieceIds) {
    const pieceState = resolveGamePieceStatusState(workingState, pieceId)

    if (
      pieceState.orientation !== 'rest' ||
      pieceState.flags.includes(LOCKED_PIECE_FLAG)
    ) {
      continue
    }

    const standResult = applyStandPieceStateChange(
      workingState,
      pieceId,
      transitionId,
      startingSequence + events.length,
      createActionOrigin(action),
      action.actionId,
    )

    if (!standResult.ok) {
      return standResult
    }

    workingState = {
      ...workingState,
      pieceStates: standResult.pieceStates,
    }
    events.push(standResult.event)
  }

  return {
    ok: true,
    state: workingState,
    events,
  }
}

function applyAutomaticDrawConsequences(
  transitionId: TransitionId,
  currentState: GameState,
  action: PhaseAction,
  startingSequence: number,
): PhaseConsequenceResult {
  const stateIndex = buildGameStateIndex(currentState)
  const turnPlayer = findPlayerById(stateIndex, currentState.turn.turnPlayerId)
  const deckZone =
    turnPlayer === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, turnPlayer, 'deck')
  const handZone =
    turnPlayer === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, turnPlayer, 'hand')

  if (
    turnPlayer === undefined ||
    deckZone === undefined ||
    handZone === undefined ||
    deckZone.occupants.length === 0
  ) {
    return {
      ok: true,
      state: currentState,
      events: [],
    }
  }

  const drawResult = drawTopPiecesBetweenZones(
    currentState,
    deckZone.zoneId,
    handZone.zoneId,
    1,
    'draw',
  )

  if (!drawResult.ok) {
    return drawResult
  }

  const movedEvents = createPieceMovedEvents(
    transitionId,
    drawResult.movedPieces,
    createSystemFlowOrigin(action),
    {
      sourceActionId: action.actionId,
      startingSequence,
    },
  )
  const cardsDrawnEvent: GameEvent = {
    eventId: createEventId(transitionId, startingSequence + movedEvents.length),
    type: 'cards.drawn',
    sequence: startingSequence + movedEvents.length,
    sourceActionId: action.actionId,
    origin: createSystemFlowOrigin(action),
    playerId: turnPlayer.playerId,
    fromZoneId: deckZone.zoneId,
    toZoneId: handZone.zoneId,
    pieceIds: drawResult.movedPieces.map((movement) => movement.pieceId),
  }

  return {
    ok: true,
    state: {
      ...currentState,
      zones: drawResult.zones,
      pieceStates: drawResult.pieceStates,
    },
    events: [...movedEvents, cardsDrawnEvent],
  }
}

function validateCurrentTurnPlayerAction(
  transitionId: TransitionId,
  currentState: GameState,
  action: TurnEndPhaseAction | TurnEndTurnAction,
):
  | {
      readonly ok: true
    }
  | {
      readonly ok: false
      readonly result: TransitionResult
    } {
  if (currentState.status !== 'in_progress') {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} requires the match to be in progress.`,
      ),
    }
  }

  if (action.actor.playerId !== currentState.turn.turnPlayerId) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} requires current turn player ${currentState.turn.turnPlayerId}.`,
      ),
    }
  }

  return { ok: true }
}

function resolveRequiredPhaseForAction(
  action: GameAction,
): PhaseId | undefined {
  switch (action.type) {
    case 'card.ride':
      return TURN_PHASE_RIDE
    case 'card.call':
    case 'card.play':
      return TURN_PHASE_MAIN
    case 'battle.declare_attack':
    case 'battle.commit_boost':
    case 'battle.guard':
    case 'system.drive_check':
    case 'system.resolve_combat':
    case 'system.damage_check':
      return TURN_PHASE_BATTLE
    case 'system.resolve_mandatory_flow':
      return action.scope === 'battle'
        ? TURN_PHASE_BATTLE
        : action.scope === 'turn'
          ? TURN_PHASE_END
          : undefined
    default:
      return undefined
  }
}

function resolveTurnOwnedPlayerActionViolation(
  currentState: GameState,
  action: GameAction,
): string | undefined {
  if (action.actor.kind !== 'player') {
    return undefined
  }

  switch (action.type) {
    case 'turn.end_phase':
    case 'turn.end_turn':
    case 'card.ride':
    case 'card.call':
    case 'card.play':
    case 'battle.declare_attack':
      return action.actor.playerId === currentState.turn.turnPlayerId
        ? undefined
        : `Action ${action.type} requires current turn player ${currentState.turn.turnPlayerId}.`
    default:
      return undefined
  }
}

function resolveNextActivePlayer(
  currentState: GameState,
): PlayerState | undefined {
  const eligiblePlayers = currentState.players
    .filter((player) => player.status !== 'defeated')
    .sort((left, right) => left.seat - right.seat)

  if (eligiblePlayers.length === 0) {
    return undefined
  }

  const currentPlayerIndex = eligiblePlayers.findIndex(
    (player) => player.playerId === currentState.turn.turnPlayerId,
  )

  return eligiblePlayers[(currentPlayerIndex + 1) % eligiblePlayers.length]
}

function resolveTurnScopedPieceStateCleanup(
  currentState: GameState,
): TurnScopedPieceStateCleanupResult {
  const cleanedPieceIds: GamePieceStatusState['pieceId'][] = []
  const removedFlagPieceIds: GamePieceStatusState['pieceId'][] = []
  const clearedModifierPieceIds: GamePieceStatusState['pieceId'][] = []
  const pieceStates = currentState.pieceStates.flatMap((pieceState) => {
    const preservedFlags = pieceState.flags.filter(
      (flag) => flag === LOCKED_PIECE_FLAG || flag === FACE_DOWN_DAMAGE_FLAG,
    )
    const removedAnyFlag = preservedFlags.length !== pieceState.flags.length
    const clearedAnyModifier =
      (pieceState.powerModifier ?? 0) !== 0 ||
      (pieceState.criticalModifier ?? 0) !== 0
    const nextPieceState = normalizePieceStateAfterTurnCleanup({
      pieceId: pieceState.pieceId,
      orientation: pieceState.orientation,
      flags: preservedFlags,
    })
    const changed =
      removedAnyFlag ||
      clearedAnyModifier ||
      nextPieceState === undefined ||
      nextPieceState.flags.length !== pieceState.flags.length

    if (changed) {
      cleanedPieceIds.push(pieceState.pieceId)
    }

    if (removedAnyFlag) {
      removedFlagPieceIds.push(pieceState.pieceId)
    }

    if (clearedAnyModifier) {
      clearedModifierPieceIds.push(pieceState.pieceId)
    }

    return nextPieceState === undefined ? [] : [nextPieceState]
  })

  return {
    state: {
      ...currentState,
      pieceStates,
    },
    cleanedPieceIds,
    removedFlagPieceIds,
    clearedModifierPieceIds,
  }
}

function createTurnCleanupAppliedEvent(
  transitionId: TransitionId,
  currentState: GameState,
  action: PhaseAction,
  cleanup: TurnScopedPieceStateCleanupResult,
  sequence: number,
): Extract<GameEvent, { readonly type: 'turn.cleanup_applied' }> {
  return {
    eventId: createEventId(transitionId, sequence),
    type: 'turn.cleanup_applied',
    sequence,
    sourceActionId: action.actionId,
    origin: createSystemFlowOrigin(action),
    turnNumber: currentState.turn.turnNumber,
    turnPlayerId: currentState.turn.turnPlayerId,
    cleanedPieceIds: cleanup.cleanedPieceIds,
    removedFlagPieceIds: cleanup.removedFlagPieceIds,
    clearedModifierPieceIds: cleanup.clearedModifierPieceIds,
  }
}

function normalizePieceStateAfterTurnCleanup(
  pieceState: GamePieceStatusState,
): GamePieceStatusState | undefined {
  const flags = Array.from(new Set(pieceState.flags))

  if (pieceState.orientation === 'stand' && flags.length === 0) {
    return undefined
  }

  return {
    pieceId: pieceState.pieceId,
    orientation: pieceState.orientation,
    flags,
  }
}

function resolveControlledMainUnitPieceIds(
  currentState: GameState,
  playerId: PlayerId,
): readonly GamePieceStatusState['pieceId'][] {
  const stateIndex = buildGameStateIndex(currentState)

  return [
    ...listOwnedZonesByKind(stateIndex, playerId, 'vanguard_circle'),
    ...listOwnedZonesByKind(stateIndex, playerId, 'rear_guard_circle'),
  ]
    .flatMap((zone) => zone.occupants.map((occupant) => occupant.pieceId))
    .filter((pieceId) => {
      const piece = findPieceById(stateIndex, pieceId)

      return (piece?.controllerPlayerId ?? piece?.ownerPlayerId) === playerId
    })
}

function createActionOrigin(
  action: PhaseAction,
): Extract<GameEvent['origin'], { readonly kind: 'player' | 'system' }> {
  return action.actor.kind === 'player'
    ? {
        kind: 'player',
        playerId: action.actor.playerId,
      }
    : {
        kind: 'system',
        system: action.actor.system,
      }
}

function createSystemFlowOrigin(
  action: PhaseAction,
): Extract<GameEvent['origin'], { readonly kind: 'system' }> {
  return {
    kind: 'system',
    system:
      action.actor.kind === 'system'
        ? action.actor.system
        : AUTOMATIC_FLOW_SYSTEM,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
