import type { DamageCheckAction, DriveCheckAction } from '../actions'
import type { ActionId, EventId, TransitionId } from '../contracts'
import {
  VANGUARD_DAMAGE_DEFEAT_THRESHOLD,
  resolvePlayerDamageState,
} from '../damage'
import { resolveDriveCheckCountEffects } from '../effects/first-effects'
import type { GameEvent } from '../events'
import type {
  BattleCheckState,
  BattleDamageState,
  GamePieceState,
  GameState,
  GameStateIndex,
  PlayerState,
  ZoneState,
} from '../state'
import {
  buildGameStateIndex,
  findPieceById,
  findPieceLocation,
  findPlayerById,
  findZoneById,
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
  type PieceZoneMovement,
} from './ordered-zone-operations'
import { resolveDeckOutLoss, shouldResolveDeckOutLoss } from './deck-out'
import { createPieceMovedEvents } from './zone-transfer'

const TRIGGER_RESOLUTION_STATE = 'pending_resolution' as const
const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const

interface BaseCheckSummaryEventFields {
  readonly battleId: NonNullable<GameState['battle']>['battleId']
  readonly playerId: PlayerState['playerId']
  readonly fromZoneId: ZoneState['zoneId']
  readonly toZoneId: ZoneState['zoneId']
  readonly revealedCards: BattleCheckState['revealedCards']
  readonly triggerResolutionState: BattleCheckState['triggerResolutionState']
}

interface DriveCheckSummaryEventFields extends BaseCheckSummaryEventFields {
  readonly type: 'battle.drive_checked'
}

interface DamageCheckSummaryEventFields extends BaseCheckSummaryEventFields {
  readonly type: 'battle.damage_checked'
  readonly damage: BattleDamageState
}

type CheckSummaryEventFields =
  | DriveCheckSummaryEventFields
  | DamageCheckSummaryEventFields

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

  const stateIndex = buildGameStateIndex(currentState)
  const attackerZone = findZoneById(stateIndex, battle.attackerZoneId)

  if (attackerZone?.kind !== 'vanguard_circle') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} currently supports drive checks only for vanguard attacks.`,
    )
  }

  const actingPlayer = findPlayerById(stateIndex, action.playerId)

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
    stateIndex,
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
  const sourceZone = findZoneById(stateIndex, action.fromZoneId)

  if (
    sourceZone !== undefined &&
    shouldResolveDeckOutLoss(sourceZone, effectResolution.count)
  ) {
    const deckOutResult = resolveDeckOutLoss({
      transitionId,
      currentState,
      playerId: action.playerId,
      fromZoneId: action.fromZoneId,
      requiredCount: effectResolution.count,
      availableCount: sourceZone.occupants.length,
      reason: 'drive_check',
      sourceActionId: action.actionId,
      system: action.actor.system,
      startingSequence: effectResolution.events.length,
    })

    if (!deckOutResult.ok) {
      return createInvalidTransitionResult(
        transitionId,
        currentState,
        deckOutResult.code,
        deckOutResult.message,
      )
    }

    return createTransitionResult(
      transitionId,
      advanceGameStateRevision(deckOutResult.state),
      [...effectResolution.events, ...deckOutResult.events],
    )
  }

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
    stateIndex,
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

  if (battle.status !== 'combat_resolved') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} is only available after combat comparison under the current battle flow foundation.`,
    )
  }

  if (battle.combat?.result !== 'hit') {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} requires battle ${battle.battleId} to have an explicit hit result.`,
    )
  }

  const expectedDamageCheckCount = battle.combat.damageCheckCount

  if (
    !Number.isSafeInteger(action.count) ||
    action.count !== expectedDamageCheckCount
  ) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} count ${action.count} must match battle ${battle.battleId} derived damage check count ${expectedDamageCheckCount}.`,
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

  const stateIndex = buildGameStateIndex(currentState)

  if (!supportsBattleDamageCheckTarget(stateIndex, battle)) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action',
      `Action ${action.type} currently supports damage checks only when the battle target is the defending player or the defending vanguard.`,
    )
  }

  const defendingPlayer = findPlayerById(stateIndex, action.playerId)

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
    stateIndex,
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

  const sourceZone = findZoneById(stateIndex, action.fromZoneId)

  if (
    sourceZone !== undefined &&
    shouldResolveDeckOutLoss(sourceZone, expectedDamageCheckCount)
  ) {
    const deckOutResult = resolveDeckOutLoss({
      transitionId,
      currentState,
      playerId: action.playerId,
      fromZoneId: action.fromZoneId,
      requiredCount: expectedDamageCheckCount,
      availableCount: sourceZone.occupants.length,
      reason: 'damage_check',
      sourceActionId: action.actionId,
      system: action.actor.system,
    })

    if (!deckOutResult.ok) {
      return createInvalidTransitionResult(
        transitionId,
        currentState,
        deckOutResult.code,
        deckOutResult.message,
      )
    }

    return createTransitionResult(
      transitionId,
      advanceGameStateRevision(deckOutResult.state),
      deckOutResult.events,
    )
  }

  const drawResult = drawTopPiecesBetweenZones(
    currentState,
    action.fromZoneId,
    action.toZoneId,
    expectedDamageCheckCount,
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

  const damageBefore = resolvePlayerDamageState(currentState, action.playerId)

  if (!damageBefore.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      damageBefore.issue.message,
    )
  }

  const stateAfterDamageMovement: GameState = {
    ...currentState,
    zones: drawResult.zones,
    pieceStates: drawResult.pieceStates,
  }
  const damageAfter = resolvePlayerDamageState(
    stateAfterDamageMovement,
    action.playerId,
  )

  if (!damageAfter.ok) {
    return createInvalidTransitionResult(
      transitionId,
      currentState,
      'invalid_action_reference',
      damageAfter.issue.message,
    )
  }

  const damage: BattleDamageState = {
    playerId: action.playerId,
    damageZoneId: damageAfter.damage.damageZoneId,
    damageBefore: damageBefore.damage.damageCount,
    damageAfter: damageAfter.damage.damageCount,
    defeatThreshold: VANGUARD_DAMAGE_DEFEAT_THRESHOLD,
    outcome: damageAfter.damage.isDefeatedByDamage ? 'lethal' : 'non_lethal',
  }
  const checkState = createBattleCheckState(
    stateIndex,
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
      damage,
    },
  })
  const checkEvents = createCheckEvents(
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
      damage,
    },
  )
  const events: readonly GameEvent[] = [
    ...checkEvents,
    {
      eventId: createEventId(transitionId, checkEvents.length),
      type: 'player.damage_changed',
      sequence: checkEvents.length,
      sourceActionId: action.actionId,
      origin: {
        kind: 'system',
        system: AUTOMATIC_FLOW_SYSTEM,
      },
      playerId: action.playerId,
      battleId: battle.battleId,
      damageZoneId: damage.damageZoneId,
      previousDamage: damage.damageBefore,
      nextDamage: damage.damageAfter,
      defeatThreshold: damage.defeatThreshold,
      outcome: damage.outcome,
      movedPieceIds: drawResult.movedPieces.map((movement) => movement.pieceId),
    },
  ]

  return createTransitionResult(transitionId, nextState, events, {
    timingWindows: createTransitionTimingWindowTriplet('battle.damage_check', {
      relatedEventSequence: drawResult.movedPieces.length,
      battleId: battle.battleId,
    }),
  })
}

function resolveOwnedCheckZones(
  label: string,
  player: PlayerState,
  stateIndex: GameStateIndex,
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
  const sourceZone = findZoneById(stateIndex, fromZoneId)
  const destinationZone = findZoneById(stateIndex, toZoneId)

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
  stateIndex: GameStateIndex,
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
      const piece = findPieceById(stateIndex, pieceId)

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
  stateIndex: GameStateIndex,
  battle: NonNullable<GameState['battle']>,
): boolean {
  if (battle.target.kind === 'player') {
    return battle.target.playerId === battle.defendingPlayerId
  }

  const targetPieceId = battle.target.pieceId
  const targetZone = findPieceLocation(stateIndex, targetPieceId)?.zone

  return targetZone?.kind === 'vanguard_circle'
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
