import type { DamageCheckAction, DriveCheckAction } from '../actions'
import type { ActionId, EventId, TransitionId } from '../contracts'
import { resolveDriveCheckCountEffects } from '../effects/first-effects'
import type { GameEvent } from '../events'
import type {
  BattleCheckState,
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
  drawTopPiecesBetweenZones,
  findZoneById,
  type PieceZoneMovement,
} from './ordered-zone-operations'
import { createPieceMovedEvents } from './zone-transfer'

const TRIGGER_RESOLUTION_STATE = 'pending_future_engine' as const
const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const

interface CheckSummaryEventFields {
  readonly type: 'battle.drive_checked' | 'battle.damage_checked'
  readonly battleId: NonNullable<GameState['battle']>['battleId']
  readonly playerId: PlayerState['playerId']
  readonly fromZoneId: ZoneState['zoneId']
  readonly toZoneId: ZoneState['zoneId']
  readonly revealedCards: BattleCheckState['revealedCards']
  readonly triggerResolutionState: BattleCheckState['triggerResolutionState']
}

export function applyDriveCheckTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: DriveCheckAction,
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

  if (battle === undefined || battle.battleId !== action.battleId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the referenced battle ${action.battleId} to be active.`,
    )
  }

  if (battle.status !== 'guard_resolved') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} is only available after guard resolution under the current battle flow foundation.`,
    )
  }

  if (battle.attackingPlayerId !== action.playerId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can only be applied for attacking player ${battle.attackingPlayerId}.`,
    )
  }

  if (!Number.isSafeInteger(action.count) || action.count <= 0) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} count must be a positive safe integer.`,
    )
  }

  const attackerZone = findZoneById(currentState, battle.attackerZoneId)

  if (attackerZone?.kind !== 'vanguard_circle') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} currently supports drive checks only for vanguard attacks.`,
    )
  }

  const actingPlayer = findPlayerById(currentState, action.playerId)

  if (actingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.playerId}.`,
    )
  }

  const zoneReferenceError = resolveOwnedCheckZones(
    action.type,
    actingPlayer,
    currentState,
    action.fromZoneId,
    action.toZoneId,
    'deck',
    'hand',
  )

  if (zoneReferenceError !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      zoneReferenceError.code,
      zoneReferenceError.message,
    )
  }

  const effectResolution = resolveDriveCheckCountEffects({
    currentState,
    battle,
    baseCount: action.count,
    transitionId,
    sourceActionId: action.actionId,
  })
  const drawResult = drawTopPiecesBetweenZones(
    currentState,
    action.fromZoneId,
    action.toZoneId,
    effectResolution.count,
    'drive_check',
  )

  if (!drawResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      drawResult.code,
      drawResult.message,
    )
  }

  const checkState = createBattleCheckState(
    currentState,
    'drive',
    action.playerId,
    action.fromZoneId,
    action.toZoneId,
    drawResult.movedPieces.map((movement) => movement.pieceId),
  )
  const nextState = advanceGameStateRevision({
    ...currentState,
    zones: drawResult.zones,
    pieceStates: drawResult.pieceStates,
    battle: {
      ...battle,
      status: 'drive_checked',
      lastCheck: checkState,
    },
  })
  const events = [
    ...effectResolution.events,
    ...createCheckEvents(
      transitionId,
      action.actionId,
      drawResult.movedPieces,
      {
        type: 'battle.drive_checked',
        battleId: battle.battleId,
        playerId: action.playerId,
        fromZoneId: action.fromZoneId,
        toZoneId: action.toZoneId,
        revealedCards: checkState.revealedCards,
        triggerResolutionState: checkState.triggerResolutionState,
      },
      effectResolution.events.length,
    ),
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.drive_check', {
      relatedEventSequence:
        effectResolution.events.length + drawResult.movedPieces.length,
      battleId: battle.battleId,
    }),
  })
}

export function applyDamageCheckTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: DamageCheckAction,
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

  if (battle === undefined || battle.battleId !== action.battleId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires the referenced battle ${action.battleId} to be active.`,
    )
  }

  if (battle.status !== 'drive_checked') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} is only available after drive check resolution under the current battle flow foundation.`,
    )
  }

  if (battle.defendingPlayerId !== action.playerId) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} can only be applied for defending player ${battle.defendingPlayerId}.`,
    )
  }

  if (!supportsBattleDamageCheckTarget(currentState, battle)) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} currently supports damage checks only when the battle target is the defending player or the defending vanguard.`,
    )
  }

  const defendingPlayer = findPlayerById(currentState, action.playerId)

  if (defendingPlayer === undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      `Action ${action.type} references an unknown player ${action.playerId}.`,
    )
  }

  const zoneReferenceError = resolveOwnedCheckZones(
    action.type,
    defendingPlayer,
    currentState,
    action.fromZoneId,
    action.toZoneId,
    'deck',
    'damage',
  )

  if (zoneReferenceError !== undefined) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      zoneReferenceError.code,
      zoneReferenceError.message,
    )
  }

  const drawResult = drawTopPiecesBetweenZones(
    currentState,
    action.fromZoneId,
    action.toZoneId,
    action.count,
    'damage_check',
  )

  if (!drawResult.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      drawResult.code,
      drawResult.message,
    )
  }

  const checkState = createBattleCheckState(
    currentState,
    'damage',
    action.playerId,
    action.fromZoneId,
    action.toZoneId,
    drawResult.movedPieces.map((movement) => movement.pieceId),
  )
  const nextState = advanceGameStateRevision({
    ...currentState,
    zones: drawResult.zones,
    pieceStates: drawResult.pieceStates,
    battle: {
      ...battle,
      status: 'damage_checked',
      lastCheck: checkState,
    },
  })
  const events = createCheckEvents(
    transitionId,
    action.actionId,
    drawResult.movedPieces,
    {
      type: 'battle.damage_checked',
      battleId: battle.battleId,
      playerId: action.playerId,
      fromZoneId: action.fromZoneId,
      toZoneId: action.toZoneId,
      revealedCards: checkState.revealedCards,
      triggerResolutionState: checkState.triggerResolutionState,
    },
  )

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.damage_check', {
      relatedEventSequence: drawResult.movedPieces.length,
      battleId: battle.battleId,
    }),
  })
}

function findPlayerById(
  currentState: GameState,
  playerId: PlayerState['playerId'],
): PlayerState | undefined {
  return currentState.players.find((player) => player.playerId === playerId)
}

function resolveOwnedCheckZones(
  label: string,
  player: PlayerState,
  currentState: GameState,
  fromZoneId: ZoneState['zoneId'],
  toZoneId: ZoneState['zoneId'],
  expectedSourceKind: ZoneState['kind'],
  expectedDestinationKind: ZoneState['kind'],
):
  | {
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    }
  | undefined {
  const sourceZone = findZoneById(currentState, fromZoneId)
  const destinationZone = findZoneById(currentState, toZoneId)

  if (sourceZone === undefined || destinationZone === undefined) {
    return {
      code: 'invalid_action_reference',
      message: `Action ${label} references an unknown source or destination zone.`,
    }
  }

  if (
    sourceZone.ownerPlayerId !== player.playerId ||
    destinationZone.ownerPlayerId !== player.playerId
  ) {
    return {
      code: 'invalid_action_reference',
      message: `Action ${label} cannot use zones that are not owned by player ${player.playerId}.`,
    }
  }

  if (sourceZone.kind !== expectedSourceKind) {
    return {
      code: 'invalid_action',
      message: `Action ${label} requires source zone ${fromZoneId} to be a ${expectedSourceKind} zone.`,
    }
  }

  if (destinationZone.kind !== expectedDestinationKind) {
    return {
      code: 'invalid_action',
      message: `Action ${label} requires destination zone ${toZoneId} to be a ${expectedDestinationKind} zone.`,
    }
  }

  return undefined
}

function createBattleCheckState(
  currentState: GameState,
  kind: BattleCheckState['kind'],
  playerId: PlayerState['playerId'],
  fromZoneId: ZoneState['zoneId'],
  toZoneId: ZoneState['zoneId'],
  pieceIds: readonly GamePieceState['pieceId'][],
): BattleCheckState {
  return {
    kind,
    playerId,
    fromZoneId,
    toZoneId,
    revealedCards: pieceIds.map((pieceId) => {
      const piece = currentState.pieces.find(
        (candidate) => candidate.pieceId === pieceId,
      )

      return {
        pieceId,
        ...(piece?.cardDefinitionId === undefined
          ? {}
          : {
              cardDefinitionId: piece.cardDefinitionId,
            }),
      }
    }),
    triggerResolutionState: TRIGGER_RESOLUTION_STATE,
  }
}

function createCheckEvents(
  transitionId: TransitionId,
  actionId: ActionId,
  movedPieces: readonly PieceZoneMovement[],
  checkEvent: CheckSummaryEventFields,
  startingSequence = 0,
): readonly GameEvent[] {
  const pieceMovedEvents = createPieceMovedEvents(
    transitionId,
    movedPieces,
    {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    {
      sourceActionId: actionId,
      startingSequence,
    },
  )

  return [
    ...pieceMovedEvents,
    {
      ...checkEvent,
      eventId: createEventId(
        transitionId,
        startingSequence + pieceMovedEvents.length,
      ),
      sequence: startingSequence + pieceMovedEvents.length,
      sourceActionId: actionId,
      origin: {
        kind: 'system',
        system: AUTOMATIC_FLOW_SYSTEM,
      },
    },
  ]
}

function supportsBattleDamageCheckTarget(
  currentState: GameState,
  battle: NonNullable<GameState['battle']>,
): boolean {
  if (battle.target.kind === 'player') {
    return battle.target.playerId === battle.defendingPlayerId
  }

  const targetPieceId = battle.target.pieceId

  const targetZone = currentState.zones.find((zone) =>
    zone.occupants.some((occupant) => occupant.pieceId === targetPieceId),
  )

  return targetZone?.kind === 'vanguard_circle'
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
