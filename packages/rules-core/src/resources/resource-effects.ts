import type {
  ActionId,
  EventId,
  PieceId,
  PlayerId,
  TransitionId,
} from '../contracts'
import type { EffectResolvedEvent, GameEvent, ResourceEvent } from '../events'
import type { GameState, PlayerState, ZoneState } from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPlayerById,
} from '../state'
import {
  drawTopPiecesBetweenZones,
  movePiecesByIdBetweenZones,
} from '../transitions/ordered-zone-operations'
import { createPieceMovedEvents } from '../transitions/zone-transfer'
import {
  getDeclarativeEffectOperations,
  type DeclarativeEffectOperation,
  type EffectDefinition,
  type ResourceEffectOperation,
} from '../effects/effect'

import {
  isFaceDownDamageCard,
  isFaceUpDamageCard,
  setDamageCardFace,
} from './resource-state'

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const

export type ResourceEffectResolutionResult =
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

export interface ResourceEffectResolutionInput {
  readonly currentState: GameState
  readonly transitionId: TransitionId
  readonly sourceActionId?: ActionId
  readonly sourcePieceId: PieceId
  readonly effectDefinition: EffectDefinition
  readonly triggerEventSequence?: number
  readonly startingSequence?: number
}

interface ResourceOperationContext {
  readonly transitionId: TransitionId
  readonly sourceActionId?: ActionId
  readonly sourcePieceId: PieceId
  readonly startingSequence: number
}

type ResourceOperationResult =
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

export function effectDefinitionHasResourceOperations(
  effectDefinition: EffectDefinition,
): boolean {
  return getResourceOperations(effectDefinition).length > 0
}

export function resolveResourceEffectDefinition(
  input: ResourceEffectResolutionInput,
): ResourceEffectResolutionResult {
  if (input.currentState.status === 'completed') {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Effect ${input.effectDefinition.id} cannot resolve resource operations after the match is completed.`,
    }
  }

  const operations = getResourceOperations(input.effectDefinition)

  if (operations.length === 0) {
    return {
      ok: true,
      state: input.currentState,
      events: [],
    }
  }

  let workingState = input.currentState
  const startingSequence = input.startingSequence ?? 0
  const events: GameEvent[] = [
    createEffectResolvedEvent({
      transitionId: input.transitionId,
      sequence: startingSequence,
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      sourcePieceId: input.sourcePieceId,
      effectDefinition: input.effectDefinition,
      ...(input.triggerEventSequence === undefined
        ? {}
        : {
            triggerEventSequence: input.triggerEventSequence,
          }),
      operationKinds: operations.map((operation) => operation.kind),
    }),
  ]

  for (const operation of operations) {
    const result = applyResourceOperation(workingState, operation, {
      transitionId: input.transitionId,
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      sourcePieceId: input.sourcePieceId,
      startingSequence: startingSequence + events.length,
    })

    if (!result.ok) {
      return result
    }

    workingState = result.state
    events.push(...result.events)
  }

  return {
    ok: true,
    state: workingState,
    events,
  }
}

function getResourceOperations(
  effectDefinition: EffectDefinition,
): readonly ResourceEffectOperation[] {
  return getDeclarativeEffectOperations(effectDefinition).filter(
    isResourceOperation,
  )
}

function isResourceOperation(
  operation: DeclarativeEffectOperation,
): operation is ResourceEffectOperation {
  return (
    operation.kind === 'counter_blast' ||
    operation.kind === 'counter_charge' ||
    operation.kind === 'soul_blast' ||
    operation.kind === 'soul_charge'
  )
}

function applyResourceOperation(
  currentState: GameState,
  operation: ResourceEffectOperation,
  context: ResourceOperationContext,
): ResourceOperationResult {
  const playerResolution = resolveSourceController(
    currentState,
    context.sourcePieceId,
  )

  if (!playerResolution.ok) {
    return playerResolution
  }

  switch (operation.kind) {
    case 'counter_blast':
      return applyCounterBlastOperation(
        currentState,
        playerResolution.player,
        operation.count,
        context,
      )
    case 'counter_charge':
      return applyCounterChargeOperation(
        currentState,
        playerResolution.player,
        operation.count,
        context,
      )
    case 'soul_blast':
      return applySoulBlastOperation(
        currentState,
        playerResolution.player,
        operation.count,
        context,
      )
    case 'soul_charge':
      return applySoulChargeOperation(
        currentState,
        playerResolution.player,
        operation.count,
        context,
      )
  }
}

function applyCounterBlastOperation(
  currentState: GameState,
  player: PlayerState,
  count: number,
  context: ResourceOperationContext,
): ResourceOperationResult {
  const stateIndex = buildGameStateIndex(currentState)
  const damageZone = findOwnedZoneByKind(stateIndex, player, 'damage')

  if (damageZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Counter Blast requires player ${player.playerId} to own a damage zone.`,
    }
  }

  const faceUpPieceIds = damageZone.occupants
    .map((occupant) => occupant.pieceId)
    .filter((pieceId) => isFaceUpDamageCard(currentState, pieceId))

  if (faceUpPieceIds.length < count) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Counter Blast ${count} requires ${count} face-up damage card(s), but player ${player.playerId} has ${faceUpPieceIds.length}.`,
    }
  }

  const selectedPieceIds = faceUpPieceIds.slice(0, count)
  let nextPieceStates = currentState.pieceStates

  for (const pieceId of selectedPieceIds) {
    nextPieceStates = setDamageCardFace(nextPieceStates, pieceId, 'face_down')
  }

  return {
    ok: true,
    state: {
      ...currentState,
      pieceStates: nextPieceStates,
    },
    events: [
      createResourceEvent(context, {
        type: 'resource.counter_blasted',
        sequence: context.startingSequence,
        playerId: player.playerId,
        fromZoneId: damageZone.zoneId,
        pieceIds: selectedPieceIds,
        count,
      }),
    ],
  }
}

function applyCounterChargeOperation(
  currentState: GameState,
  player: PlayerState,
  count: number,
  context: ResourceOperationContext,
): ResourceOperationResult {
  const stateIndex = buildGameStateIndex(currentState)
  const damageZone = findOwnedZoneByKind(stateIndex, player, 'damage')

  if (damageZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Counter Charge requires player ${player.playerId} to own a damage zone.`,
    }
  }

  const faceDownPieceIds = damageZone.occupants
    .map((occupant) => occupant.pieceId)
    .filter((pieceId) => isFaceDownDamageCard(currentState, pieceId))

  if (faceDownPieceIds.length < count) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Counter Charge ${count} requires ${count} face-down damage card(s), but player ${player.playerId} has ${faceDownPieceIds.length}.`,
    }
  }

  const selectedPieceIds = faceDownPieceIds.slice(0, count)
  let nextPieceStates = currentState.pieceStates

  for (const pieceId of selectedPieceIds) {
    nextPieceStates = setDamageCardFace(nextPieceStates, pieceId, 'face_up')
  }

  return {
    ok: true,
    state: {
      ...currentState,
      pieceStates: nextPieceStates,
    },
    events: [
      createResourceEvent(context, {
        type: 'resource.counter_charged',
        sequence: context.startingSequence,
        playerId: player.playerId,
        toZoneId: damageZone.zoneId,
        pieceIds: selectedPieceIds,
        count,
      }),
    ],
  }
}

function applySoulBlastOperation(
  currentState: GameState,
  player: PlayerState,
  count: number,
  context: ResourceOperationContext,
): ResourceOperationResult {
  const stateIndex = buildGameStateIndex(currentState)
  const soulZone = findOwnedZoneByKind(stateIndex, player, 'soul')
  const dropZone = findOwnedZoneByKind(stateIndex, player, 'drop')

  if (soulZone === undefined || dropZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Soul Blast requires player ${player.playerId} to own soul and drop zones.`,
    }
  }

  if (soulZone.occupants.length < count) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Soul Blast ${count} requires ${count} soul card(s), but player ${player.playerId} has ${soulZone.occupants.length}.`,
    }
  }

  const selectedPieceIds = soulZone.occupants
    .slice(0, count)
    .map((occupant) => occupant.pieceId)
  const moveResult = movePiecesByIdBetweenZones(
    currentState,
    selectedPieceIds,
    soulZone.zoneId,
    dropZone.zoneId,
    'soul_blast',
  )

  if (!moveResult.ok) {
    return moveResult
  }

  const movedEvents = createPieceMovedEvents(
    context.transitionId,
    moveResult.movedPieces,
    createSystemOrigin(),
    {
      ...(context.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: context.sourceActionId,
          }),
      startingSequence: context.startingSequence,
    },
  )

  return {
    ok: true,
    state: {
      ...currentState,
      zones: moveResult.zones,
      pieceStates: moveResult.pieceStates,
    },
    events: [
      ...movedEvents,
      createResourceEvent(context, {
        type: 'resource.soul_blasted',
        sequence: context.startingSequence + movedEvents.length,
        playerId: player.playerId,
        fromZoneId: soulZone.zoneId,
        toZoneId: dropZone.zoneId,
        pieceIds: selectedPieceIds,
        count,
      }),
    ],
  }
}

function applySoulChargeOperation(
  currentState: GameState,
  player: PlayerState,
  count: number,
  context: ResourceOperationContext,
): ResourceOperationResult {
  const stateIndex = buildGameStateIndex(currentState)
  const deckZone = findOwnedZoneByKind(stateIndex, player, 'deck')
  const soulZone = findOwnedZoneByKind(stateIndex, player, 'soul')

  if (deckZone === undefined || soulZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Soul Charge requires player ${player.playerId} to own deck and soul zones.`,
    }
  }

  if (deckZone.occupants.length < count) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Soul Charge ${count} requires ${count} deck card(s), but player ${player.playerId} has ${deckZone.occupants.length}.`,
    }
  }

  const moveResult = drawTopPiecesBetweenZones(
    currentState,
    deckZone.zoneId,
    soulZone.zoneId,
    count,
    'soul_charge',
  )

  if (!moveResult.ok) {
    return moveResult
  }

  const selectedPieceIds = moveResult.movedPieces.map(
    (movement) => movement.pieceId,
  )
  const movedEvents = createPieceMovedEvents(
    context.transitionId,
    moveResult.movedPieces,
    createSystemOrigin(),
    {
      ...(context.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: context.sourceActionId,
          }),
      startingSequence: context.startingSequence,
    },
  )

  return {
    ok: true,
    state: {
      ...currentState,
      zones: moveResult.zones,
      pieceStates: moveResult.pieceStates,
    },
    events: [
      ...movedEvents,
      createResourceEvent(context, {
        type: 'resource.soul_charged',
        sequence: context.startingSequence + movedEvents.length,
        playerId: player.playerId,
        fromZoneId: deckZone.zoneId,
        toZoneId: soulZone.zoneId,
        pieceIds: selectedPieceIds,
        count,
      }),
    ],
  }
}

function resolveSourceController(
  currentState: GameState,
  sourcePieceId: PieceId,
):
  | {
      readonly ok: true
      readonly player: PlayerState
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action_reference'
      readonly message: string
    } {
  const stateIndex = buildGameStateIndex(currentState)
  const sourcePiece = findPieceById(stateIndex, sourcePieceId)
  const controllerPlayerId = sourcePiece?.controllerPlayerId

  if (controllerPlayerId === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Resource effect requires source piece ${sourcePieceId} to have a controller.`,
    }
  }

  const player = findPlayerById(stateIndex, controllerPlayerId)

  if (player === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Resource effect references unknown controller ${controllerPlayerId}.`,
    }
  }

  return {
    ok: true,
    player,
  }
}

function createResourceEvent(
  context: ResourceOperationContext,
  input:
    | {
        readonly type: 'resource.counter_blasted'
        readonly sequence: number
        readonly playerId: PlayerId
        readonly fromZoneId: ZoneState['zoneId']
        readonly pieceIds: readonly PieceId[]
        readonly count: number
      }
    | {
        readonly type: 'resource.counter_charged'
        readonly sequence: number
        readonly playerId: PlayerId
        readonly toZoneId: ZoneState['zoneId']
        readonly pieceIds: readonly PieceId[]
        readonly count: number
      }
    | {
        readonly type: 'resource.soul_blasted' | 'resource.soul_charged'
        readonly sequence: number
        readonly playerId: PlayerId
        readonly fromZoneId: ZoneState['zoneId']
        readonly toZoneId: ZoneState['zoneId']
        readonly pieceIds: readonly PieceId[]
        readonly count: number
      },
): ResourceEvent {
  return {
    eventId: createEventId(context.transitionId, input.sequence),
    type: input.type,
    sequence: input.sequence,
    ...(context.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: context.sourceActionId,
        }),
    origin: createSystemOrigin(),
    playerId: input.playerId,
    ...(input.type === 'resource.counter_charged'
      ? {
          toZoneId: input.toZoneId,
        }
      : {
          fromZoneId: input.fromZoneId,
        }),
    ...(input.type === 'resource.counter_blasted' ||
    input.type === 'resource.counter_charged'
      ? {}
      : {
          toZoneId: input.toZoneId,
        }),
    pieceIds: input.pieceIds,
    count: input.count,
  } as ResourceEvent
}

function createEffectResolvedEvent(input: {
  readonly transitionId: TransitionId
  readonly sequence: number
  readonly sourceActionId?: ActionId
  readonly effectDefinition: EffectDefinition
  readonly sourcePieceId: PieceId
  readonly triggerEventSequence?: number
  readonly operationKinds: readonly string[]
}): EffectResolvedEvent {
  return {
    eventId: createEventId(input.transitionId, input.sequence),
    type: 'effect.resolved',
    sequence: input.sequence,
    ...(input.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: input.sourceActionId,
        }),
    origin: createSystemOrigin(),
    effectDefinitionId: input.effectDefinition.id,
    sourcePieceId: input.sourcePieceId,
    ...(input.triggerEventSequence === undefined
      ? {}
      : {
          triggerEventSequence: input.triggerEventSequence,
        }),
    operationKinds: input.operationKinds,
  }
}

function createSystemOrigin(): Extract<
  GameEvent['origin'],
  { readonly kind: 'system' }
> {
  return {
    kind: 'system',
    system: AUTOMATIC_FLOW_SYSTEM,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
