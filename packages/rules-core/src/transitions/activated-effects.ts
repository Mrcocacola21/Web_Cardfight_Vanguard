import type { ActivateCardEffectAction } from '../actions'
import type {
  EffectContinuationId,
  EventId,
  PieceId,
  PlayerId,
  RequestId,
  TransitionId,
  ZoneId,
  ZoneSlotId,
} from '../contracts'
import type {
  EffectActivatedEvent,
  EffectResolvedEvent,
  GameEvent,
} from '../events'
import type { GameChoiceRequest, GameChoiceResponse } from '../requests'
import type { ZoneLocationReference } from '../references'
import { resolveResourceEffectDefinition } from '../resources'
import type {
  EffectContinuationState,
  GamePieceState,
  GameState,
  PlayerState,
  ZoneState,
} from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPieceLocation,
  findPlayerById,
  resolvePrimaryOpponentPlayerId,
} from '../state'
import type { ZoneTransferIntent, ZoneTransferReason } from '../transfers'
import {
  coreEffectHandlerRegistry,
  coreEffectRegistry,
  getDeclarativeEffectOperations,
  resolveEffectRuntimeQueueItem,
  type BindCardsOperation,
  type BounceCardsOperation,
  type CallCardsOperation,
  type DeclarativeEffectOperation,
  type EffectDefinition,
  type EffectHandlerRegistry,
  type EffectPieceFilter,
  type EffectRegistry,
  type EffectZoneSelector,
  type ImprisonCardsOperation,
  type ResourceEffectOperation,
  type RetireCardsOperation,
  type SearchCardsOperation,
} from '../effects'
import {
  createEffectResolutionQueue,
  dequeueEffectResolutionQueueItem,
} from '../effects/resolution-queue'

import {
  advanceGameStateRevision,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  type TransitionResult,
  type TransitionTimingWindow,
} from './transition'
import {
  createPieceMovedEvents,
  resolveZoneTransferSequence,
} from './zone-transfer'

export interface ActivatedEffectRuntimeEnvironment {
  readonly effectRegistry: EffectRegistry
  readonly effectHandlers: EffectHandlerRegistry
}

interface PreparedActivation {
  readonly action: ActivateCardEffectAction
  readonly actor: PlayerState
  readonly sourcePiece: GamePieceState & { readonly kind: 'card' }
  readonly effectDefinition: EffectDefinition
}

type RuntimeOperationResult =
  | {
      readonly ok: true
      readonly state: GameState
      readonly events: readonly GameEvent[]
      readonly timingWindows: readonly TransitionTimingWindow[]
    }
  | {
      readonly ok: true
      readonly paused: true
      readonly state: GameState
      readonly request: GameChoiceRequest
      readonly continuation: EffectContinuationState
      readonly events: readonly GameEvent[]
      readonly timingWindows: readonly TransitionTimingWindow[]
    }
  | {
      readonly ok: false
      readonly code:
        | 'invalid_action'
        | 'invalid_action_reference'
        | 'invalid_response'
      readonly message: string
    }

interface RuntimeContext {
  readonly transitionId: TransitionId
  readonly sourceActionId: ActivateCardEffectAction['actionId']
  readonly actorPlayerId: PlayerId
  readonly sourcePieceId: PieceId
  readonly effectDefinition: EffectDefinition
  readonly operationKinds: readonly string[]
  readonly initialPendingRequests: readonly GameChoiceRequest[]
}

interface RuntimeCursor {
  readonly nextEventSequence: number
  readonly nextTimingWindowSequence: number
}

interface OperationResolutionContext extends RuntimeContext {
  readonly operationIndex: number
  readonly cursor: RuntimeCursor
  readonly response?: GameChoiceResponse
}

const DEFAULT_ACTIVATED_EFFECT_ENVIRONMENT: ActivatedEffectRuntimeEnvironment =
  {
    effectRegistry: coreEffectRegistry,
    effectHandlers: coreEffectHandlerRegistry,
  }

export function applyActivateCardEffectTransition(
  transitionId: TransitionId,
  currentState: GameState,
  action: ActivateCardEffectAction,
  environment: ActivatedEffectRuntimeEnvironment = DEFAULT_ACTIVATED_EFFECT_ENVIRONMENT,
): TransitionResult {
  const prepared = prepareActivatedEffect(
    transitionId,
    currentState,
    action,
    environment,
  )

  if (!prepared.ok) {
    return prepared.result
  }

  const { actor, effectDefinition, sourcePiece } = prepared.value
  const activatedEvent = createEffectActivatedEvent({
    transitionId,
    sequence: 0,
    action,
  })
  const activationTimingWindows = createTransitionTimingWindowTriplet(
    'effect.activation',
    {
      relatedEventSequence: activatedEvent.sequence,
      pieceId: action.sourcePieceId,
    },
  )

  if (effectDefinition.resolution.strategy.kind !== 'declarative_descriptor') {
    return resolveTypedActivatedEffect({
      transitionId,
      currentState,
      action,
      actor,
      sourcePiece,
      effectDefinition,
      activatedEvent,
      activationTimingWindows,
      environment,
    })
  }

  const result = resolveDeclarativeOperations({
    currentState,
    context: {
      transitionId,
      sourceActionId: action.actionId,
      actorPlayerId: actor.playerId,
      sourcePieceId: sourcePiece.pieceId,
      effectDefinition,
      operationKinds: getDeclarativeEffectOperations(effectDefinition).map(
        (operation) => operation.kind,
      ),
      initialPendingRequests: currentState.pendingRequests,
    },
    startOperationIndex: 0,
    cursor: {
      nextEventSequence: 1,
      nextTimingWindowSequence: activationTimingWindows.length,
    },
  })

  return finalizeActivatedEffectResult({
    transitionId,
    currentState,
    activatedEvent,
    activationTimingWindows,
    result,
  })
}

export function applyActivatedEffectChoiceResponseTransition(input: {
  readonly transitionId: TransitionId
  readonly currentState: GameState
  readonly request: GameChoiceRequest
  readonly response: GameChoiceResponse
  readonly choiceResponseEvent: Extract<
    GameEvent,
    { readonly type: 'choice.response_resolved' }
  >
  readonly remainingRequests: readonly GameChoiceRequest[]
  readonly environment?: ActivatedEffectRuntimeEnvironment
}): TransitionResult {
  const continuationId = input.request.context?.effectContinuationId
  const continuation =
    continuationId === undefined
      ? undefined
      : input.currentState.effectContinuations?.find(
          (candidate) => candidate.continuationId === continuationId,
        )

  if (continuationId === undefined || continuation === undefined) {
    return createInvalidTransitionResult(
      input.transitionId,
      input.currentState,
      'invalid_action_reference',
      `Choice response ${input.response.requestId} does not reference a pending effect continuation.`,
      {
        inputKind: 'choice_response',
      },
    )
  }

  const environment = input.environment ?? DEFAULT_ACTIVATED_EFFECT_ENVIRONMENT
  const effectDefinition = environment.effectRegistry.getDefinition(
    continuation.effectDefinitionId,
  )

  if (effectDefinition === undefined) {
    return createInvalidTransitionResult(
      input.transitionId,
      input.currentState,
      'invalid_action_reference',
      `Effect continuation ${continuation.continuationId} references unknown effect definition ${continuation.effectDefinitionId}.`,
      {
        inputKind: 'choice_response',
      },
    )
  }

  const stateWithoutContinuation: GameState = {
    ...input.currentState,
    status: 'in_progress',
    pendingRequests: input.remainingRequests,
    effectContinuations: (input.currentState.effectContinuations ?? []).filter(
      (candidate) => candidate.continuationId !== continuation.continuationId,
    ),
  }
  const result = resolveDeclarativeOperations({
    currentState: stateWithoutContinuation,
    context: {
      transitionId: input.transitionId,
      sourceActionId: continuation.sourceActionId,
      actorPlayerId: continuation.actorPlayerId,
      sourcePieceId: continuation.sourcePieceId,
      effectDefinition,
      operationKinds: continuation.operationKinds,
      initialPendingRequests: input.remainingRequests,
    },
    startOperationIndex: continuation.operationIndex,
    cursor: {
      nextEventSequence: input.choiceResponseEvent.sequence + 1,
      nextTimingWindowSequence: 3,
    },
    response: input.response,
  })

  if (!result.ok) {
    return createInvalidTransitionResult(
      input.transitionId,
      input.currentState,
      result.code,
      result.message,
      {
        inputKind: 'choice_response',
      },
    )
  }

  const nextState = advanceGameStateRevision(result.state)

  return createTransitionResult(
    input.transitionId,
    nextState,
    [input.choiceResponseEvent, ...result.events],
    {
      inputKind: 'choice_response',
      timingWindows: [
        ...createTransitionTimingWindowTriplet('choice.response', {
          relatedEventSequence: input.choiceResponseEvent.sequence,
          requestId: input.request.requestId,
        }),
        ...result.timingWindows,
      ],
    },
  )
}

function prepareActivatedEffect(
  transitionId: TransitionId,
  currentState: GameState,
  action: ActivateCardEffectAction,
  environment: ActivatedEffectRuntimeEnvironment,
):
  | {
      readonly ok: true
      readonly value: PreparedActivation
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

  const stateIndex = buildGameStateIndex(currentState)
  const actor = findPlayerById(stateIndex, action.actor.playerId)
  const sourcePiece = findPieceById(stateIndex, action.sourcePieceId)
  const effectDefinition = environment.effectRegistry.getDefinition(
    action.effectDefinitionId,
  )

  if (actor === undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
      ),
    }
  }

  if (sourcePiece === undefined || sourcePiece.kind !== 'card') {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} requires a runtime card source ${action.sourcePieceId}.`,
      ),
    }
  }

  if (
    (sourcePiece.controllerPlayerId ?? sourcePiece.ownerPlayerId) !==
    actor.playerId
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} requires player ${actor.playerId} to control source piece ${sourcePiece.pieceId}.`,
      ),
    }
  }

  if (effectDefinition === undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} references unknown effect definition ${action.effectDefinitionId}.`,
      ),
    }
  }

  if (
    sourcePiece.effectDefinitionIds?.includes(action.effectDefinitionId) !==
    true
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} cannot activate effect ${action.effectDefinitionId} because it is not bound to source piece ${sourcePiece.pieceId}.`,
      ),
    }
  }

  if (
    effectDefinition.kind !== 'activated' ||
    effectDefinition.trigger.kind !== 'manual'
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} can only activate manual activated effects.`,
      ),
    }
  }

  return {
    ok: true,
    value: {
      action,
      actor,
      sourcePiece: sourcePiece as GamePieceState & { readonly kind: 'card' },
      effectDefinition,
    },
  }
}

function resolveTypedActivatedEffect(input: {
  readonly transitionId: TransitionId
  readonly currentState: GameState
  readonly action: ActivateCardEffectAction
  readonly actor: PlayerState
  readonly sourcePiece: GamePieceState
  readonly effectDefinition: EffectDefinition
  readonly activatedEvent: EffectActivatedEvent
  readonly activationTimingWindows: readonly TransitionTimingWindow[]
  readonly environment: ActivatedEffectRuntimeEnvironment
}): TransitionResult {
  const queue = createEffectResolutionQueue({
    transitionId: input.transitionId,
    seeds: [
      {
        sourceKind: 'direct',
        triggerEvent: input.activatedEvent,
        timingWindow: input.activationTimingWindows[1]!,
        effectDefinition: input.effectDefinition,
        sourcePieceId: input.sourcePiece.pieceId,
      },
    ],
  })
  const queueItem = dequeueEffectResolutionQueueItem(queue).item

  if (queueItem === undefined) {
    return createInvalidTransitionResult(
      input.transitionId,
      input.currentState,
      'invalid_action_reference',
      `Action ${input.action.type} could not enqueue effect ${input.effectDefinition.id}.`,
    )
  }

  const handlerResult = resolveEffectRuntimeQueueItem({
    currentState: input.currentState,
    queueItem,
    transitionId: input.transitionId,
    startingSequence: 1,
    startingTimingWindowSequence: input.activationTimingWindows.length,
    effectHandlers: input.environment.effectHandlers,
  })

  if (!handlerResult.ok) {
    return createInvalidTransitionResult(
      input.transitionId,
      input.currentState,
      handlerResult.code,
      handlerResult.message,
    )
  }

  return createTransitionResult(
    input.transitionId,
    advanceGameStateRevision(handlerResult.state),
    [input.activatedEvent, ...handlerResult.events],
    {
      timingWindows: [
        ...input.activationTimingWindows,
        ...handlerResult.timingWindows,
      ],
    },
  )
}

function finalizeActivatedEffectResult(input: {
  readonly transitionId: TransitionId
  readonly currentState: GameState
  readonly activatedEvent: EffectActivatedEvent
  readonly activationTimingWindows: readonly TransitionTimingWindow[]
  readonly result: RuntimeOperationResult
}): TransitionResult {
  if (!input.result.ok) {
    return createInvalidTransitionResult(
      input.transitionId,
      input.currentState,
      input.result.code,
      input.result.message,
    )
  }

  return createTransitionResult(
    input.transitionId,
    advanceGameStateRevision(input.result.state),
    [input.activatedEvent, ...input.result.events],
    {
      timingWindows: [
        ...input.activationTimingWindows,
        ...input.result.timingWindows,
      ],
    },
  )
}

function resolveDeclarativeOperations(input: {
  readonly currentState: GameState
  readonly context: RuntimeContext
  readonly startOperationIndex: number
  readonly cursor: RuntimeCursor
  readonly response?: GameChoiceResponse
}): RuntimeOperationResult {
  const operations = getDeclarativeEffectOperations(
    input.context.effectDefinition,
  )
  let workingState = input.currentState
  let cursor = input.cursor
  const events: GameEvent[] = []
  const timingWindows: TransitionTimingWindow[] = []

  for (
    let operationIndex = input.startOperationIndex;
    operationIndex < operations.length;
    operationIndex += 1
  ) {
    const operation = operations[operationIndex]

    if (operation === undefined) {
      continue
    }

    const result = resolveDeclarativeOperation(workingState, operation, {
      ...input.context,
      operationIndex,
      cursor,
      ...(operationIndex === input.startOperationIndex &&
      input.response !== undefined
        ? { response: input.response }
        : {}),
    })

    if (!result.ok) {
      return result
    }

    events.push(...result.events)
    timingWindows.push(...result.timingWindows)
    workingState = result.state

    if ('paused' in result && result.paused) {
      return {
        ...result,
        events,
        timingWindows,
      }
    }

    cursor = advanceCursor(cursor, result.events, result.timingWindows)
  }

  const resolvedEvent = createEffectResolvedEvent({
    transitionId: input.context.transitionId,
    sequence: cursor.nextEventSequence,
    sourceActionId: input.context.sourceActionId,
    sourcePieceId: input.context.sourcePieceId,
    effectDefinition: input.context.effectDefinition,
    operationKinds: input.context.operationKinds,
  })

  return {
    ok: true,
    state: {
      ...workingState,
      status:
        workingState.pendingRequests.length > 0
          ? 'awaiting_choice'
          : 'in_progress',
    },
    events: [...events, resolvedEvent],
    timingWindows,
  }
}

function resolveDeclarativeOperation(
  currentState: GameState,
  operation: DeclarativeEffectOperation,
  context: OperationResolutionContext,
): RuntimeOperationResult {
  if (isResourceOperation(operation)) {
    return resolveResourceOperation(currentState, operation, context)
  }

  switch (operation.kind) {
    case 'search':
      return resolveMoveSelectionOperation(currentState, operation, context)
    case 'call':
      return resolveCallOperation(currentState, operation, context)
    case 'retire':
      return resolveOwnerDestinationOperation(
        currentState,
        operation,
        context,
        'drop',
        'retire',
      )
    case 'bind':
      return resolveBindOperation(currentState, operation, context)
    case 'bounce':
      return resolveOwnerDestinationOperation(
        currentState,
        operation,
        context,
        'hand',
        'bounce',
      )
    case 'imprison':
      return resolveImprisonOperation(currentState, operation, context)
    case 'move_source_to_order_zone':
      return resolveMoveSourceToOrderZoneOperation(currentState, context)
    default:
      return {
        ok: false,
        code: 'invalid_action',
        message: `Declarative operation ${operation.kind} is not supported by the activated effect runtime.`,
      }
  }
}

function resolveResourceOperation(
  currentState: GameState,
  operation: ResourceEffectOperation,
  context: OperationResolutionContext,
): RuntimeOperationResult {
  const resourceEffectDefinition: EffectDefinition = {
    ...context.effectDefinition,
    resolution: {
      ...context.effectDefinition.resolution,
      strategy: {
        kind: 'declarative_descriptor',
        descriptorKey:
          context.effectDefinition.resolution.strategy.kind ===
          'declarative_descriptor'
            ? context.effectDefinition.resolution.strategy.descriptorKey
            : (context.effectDefinition.id as never),
        operations: [operation],
      },
    },
  }
  const resourceResult = resolveResourceEffectDefinition({
    currentState,
    transitionId: context.transitionId,
    sourceActionId: context.sourceActionId,
    sourcePieceId: context.sourcePieceId,
    effectDefinition: resourceEffectDefinition,
    startingSequence: context.cursor.nextEventSequence,
  })

  if (!resourceResult.ok) {
    return resourceResult
  }

  const events = resourceResult.events.filter(
    (event) => event.type !== 'effect.resolved',
  )

  return {
    ok: true,
    state: resourceResult.state,
    events,
    timingWindows: [],
  }
}

function resolveMoveSelectionOperation(
  currentState: GameState,
  operation: SearchCardsOperation,
  context: OperationResolutionContext,
): RuntimeOperationResult {
  const source = resolveZoneSelector(currentState, operation.from, context)
  const destination = resolveZoneSelector(currentState, operation.to, context)

  if (!source.ok) {
    return source
  }

  if (!destination.ok) {
    return destination
  }

  const selection = resolveSelectedPieces(
    currentState,
    operation,
    source.zone,
    context,
  )

  if (!selection.ok) {
    return selection
  }

  if (selection.paused) {
    return selection
  }

  return movePieces(currentState, {
    context,
    pieceIds: selection.pieceIds,
    transfers: selection.pieceIds.map((pieceId) => ({
      pieceId,
      from: {
        zoneId: source.zone.zoneId,
      },
      to: {
        zoneId: destination.zone.zoneId,
      },
      reason: operation.reason ?? 'search',
    })),
  })
}

function resolveCallOperation(
  currentState: GameState,
  operation: CallCardsOperation,
  context: OperationResolutionContext,
): RuntimeOperationResult {
  const source = resolveZoneSelector(currentState, operation.from, context)

  if (!source.ok) {
    return source
  }

  const selection = resolveSelectedPieces(
    currentState,
    operation,
    source.zone,
    context,
  )

  if (!selection.ok) {
    return selection
  }

  if (selection.paused) {
    return selection
  }

  const sourceController = resolvePlayer(
    currentState,
    'source_controller',
    context,
  )

  if (!sourceController.ok) {
    return sourceController
  }

  const rearGuardZone = findOwnedZoneByKind(
    buildGameStateIndex(currentState),
    sourceController.player,
    'rear_guard_circle',
  )

  if (rearGuardZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Call operation requires player ${sourceController.player.playerId} to own a rear-guard circle zone.`,
    }
  }

  const openSlotIds = resolveOpenSlotIds(rearGuardZone)

  if (openSlotIds.length < selection.pieceIds.length) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Call operation requires ${selection.pieceIds.length} open rear-guard circle(s), but only ${openSlotIds.length} are available.`,
    }
  }

  const moveResult = movePieces(currentState, {
    context,
    pieceIds: selection.pieceIds,
    transfers: selection.pieceIds.map((pieceId, index) => ({
      pieceId,
      from: {
        zoneId: source.zone.zoneId,
      },
      to: {
        zoneId: rearGuardZone.zoneId,
        slotId: openSlotIds[index]!,
      },
      reason: operation.reason ?? 'call',
    })),
  })

  if (!moveResult.ok) {
    return moveResult
  }

  return {
    ...moveResult,
    state: {
      ...moveResult.state,
      pieces: moveResult.state.pieces.map((piece) =>
        selection.pieceIds.includes(piece.pieceId)
          ? {
              ...piece,
              controllerPlayerId: sourceController.player.playerId,
            }
          : piece,
      ),
    },
  }
}

function resolveOwnerDestinationOperation(
  currentState: GameState,
  operation: RetireCardsOperation | BounceCardsOperation,
  context: OperationResolutionContext,
  destinationKind: 'drop' | 'hand',
  reason: ZoneTransferReason,
): RuntimeOperationResult {
  const source = resolveZoneSelector(currentState, operation.from, context)

  if (!source.ok) {
    return source
  }

  const selection = resolveSelectedPieces(
    currentState,
    operation,
    source.zone,
    context,
  )

  if (!selection.ok) {
    return selection
  }

  if (selection.paused) {
    return selection
  }

  return movePiecesToOwnerZone(currentState, {
    context,
    pieceIds: selection.pieceIds,
    fromZoneId: source.zone.zoneId,
    destinationKind,
    reason,
  })
}

function resolveBindOperation(
  currentState: GameState,
  operation: BindCardsOperation,
  context: OperationResolutionContext,
): RuntimeOperationResult {
  const source = resolveZoneSelector(currentState, operation.from, context)

  if (!source.ok) {
    return source
  }

  const selection = resolveSelectedPieces(
    currentState,
    operation,
    source.zone,
    context,
  )

  if (!selection.ok) {
    return selection
  }

  if (selection.paused) {
    return selection
  }

  if (operation.toPlayer === 'owner') {
    return movePiecesToOwnerZone(currentState, {
      context,
      pieceIds: selection.pieceIds,
      fromZoneId: source.zone.zoneId,
      destinationKind: 'bind',
      reason: 'bind',
    })
  }

  const destinationPlayer = resolvePlayer(
    currentState,
    operation.toPlayer,
    context,
  )

  if (!destinationPlayer.ok) {
    return destinationPlayer
  }

  const bindZone = findOwnedZoneByKind(
    buildGameStateIndex(currentState),
    destinationPlayer.player,
    'bind',
  )

  if (bindZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Bind operation requires player ${destinationPlayer.player.playerId} to own a bind zone.`,
    }
  }

  return movePieces(currentState, {
    context,
    pieceIds: selection.pieceIds,
    transfers: selection.pieceIds.map((pieceId) => ({
      pieceId,
      from: {
        zoneId: source.zone.zoneId,
      },
      to: {
        zoneId: bindZone.zoneId,
      },
      reason: 'bind',
    })),
  })
}

function resolveImprisonOperation(
  currentState: GameState,
  operation: ImprisonCardsOperation,
  context: OperationResolutionContext,
): RuntimeOperationResult {
  const source = resolveZoneSelector(currentState, operation.from, context)

  if (!source.ok) {
    return source
  }

  const selection = resolveSelectedPieces(
    currentState,
    operation,
    source.zone,
    context,
  )

  if (!selection.ok) {
    return selection
  }

  if (selection.paused) {
    return selection
  }

  const sourceController = resolvePlayer(
    currentState,
    'source_controller',
    context,
  )

  if (!sourceController.ok) {
    return sourceController
  }

  const prisonZone = findOwnedZoneByKind(
    buildGameStateIndex(currentState),
    sourceController.player,
    'prison',
  )

  if (prisonZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Imprison operation requires player ${sourceController.player.playerId} to own a prison zone.`,
    }
  }

  return movePieces(currentState, {
    context,
    pieceIds: selection.pieceIds,
    transfers: selection.pieceIds.map((pieceId) => ({
      pieceId,
      from: {
        zoneId: source.zone.zoneId,
      },
      to: {
        zoneId: prisonZone.zoneId,
      },
      reason: 'imprison',
    })),
  })
}

function resolveMoveSourceToOrderZoneOperation(
  currentState: GameState,
  context: OperationResolutionContext,
): RuntimeOperationResult {
  const stateIndex = buildGameStateIndex(currentState)
  const sourcePiece = findPieceById(stateIndex, context.sourcePieceId)
  const sourceLocation = findPieceLocation(stateIndex, context.sourcePieceId)
  const sourceController = resolvePlayer(
    currentState,
    'source_controller',
    context,
  )

  if (sourcePiece === undefined || sourceLocation === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Order-zone operation requires source piece ${context.sourcePieceId} to remain in the game state.`,
    }
  }

  if (!sourceController.ok) {
    return sourceController
  }

  const orderZone = findOwnedZoneByKind(
    stateIndex,
    sourceController.player,
    'order_zone',
  )

  if (orderZone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Order-zone operation requires player ${sourceController.player.playerId} to own an order zone.`,
    }
  }

  return movePieces(currentState, {
    context,
    pieceIds: [context.sourcePieceId],
    transfers: [
      {
        pieceId: context.sourcePieceId,
        from: createLocationFromZoneOccupant(sourceLocation.zone),
        to: {
          zoneId: orderZone.zoneId,
        },
        reason: 'order_zone',
      },
    ],
  })
}

function resolveSelectedPieces(
  currentState: GameState,
  operation:
    | SearchCardsOperation
    | CallCardsOperation
    | RetireCardsOperation
    | BindCardsOperation
    | BounceCardsOperation
    | ImprisonCardsOperation,
  sourceZone: ZoneState,
  context: OperationResolutionContext,
):
  | {
      readonly ok: true
      readonly paused?: false
      readonly pieceIds: readonly PieceId[]
    }
  | Extract<RuntimeOperationResult, { readonly ok: false }>
  | Extract<RuntimeOperationResult, { readonly paused: true }> {
  const eligiblePieceIds = sourceZone.occupants
    .map((occupant) => occupant.pieceId)
    .filter((pieceId) =>
      pieceMatchesFilter(currentState, pieceId, operation.filter, context),
    )
  const maxSelections = Math.min(
    operation.maxSelections,
    eligiblePieceIds.length,
  )

  if (eligiblePieceIds.length < operation.minSelections) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Effect operation ${operation.kind} requires ${operation.minSelections} eligible piece(s), but only ${eligiblePieceIds.length} are available.`,
    }
  }

  if (operation.selection === 'deterministic_first') {
    return {
      ok: true,
      pieceIds: eligiblePieceIds.slice(0, maxSelections),
    }
  }

  if (context.response !== undefined) {
    if (context.response.type === 'answer.pass') {
      return {
        ok: true,
        pieceIds: [],
      }
    }

    if (context.response.type !== 'answer.pieces') {
      return {
        ok: false,
        code: 'invalid_response',
        message: `Effect operation ${operation.kind} expected a piece-selection response.`,
      }
    }

    return {
      ok: true,
      pieceIds: context.response.selectedPieceIds,
    }
  }

  const requestId = createRequestId(
    context.transitionId,
    context.operationIndex,
  )
  const continuationId = createContinuationId(
    context.transitionId,
    context.operationIndex,
  )
  const responderPlayerId = sourceZone.ownerPlayerId ?? context.actorPlayerId
  const request: GameChoiceRequest = {
    requestId,
    type: 'choose.pieces',
    responderPlayerId,
    purpose: 'effect',
    visibility:
      sourceZone.visibility === 'public' ? 'public' : 'responder-only',
    minSelections: operation.minSelections,
    maxSelections,
    eligiblePieceIds,
    fromZoneIds: [sourceZone.zoneId],
    allowPass: operation.minSelections === 0,
    context: {
      sourceActionId: context.sourceActionId,
      effectContinuationId: continuationId,
      relatedPieceIds: uniquePieceIds([
        context.sourcePieceId,
        ...eligiblePieceIds,
      ]),
      relatedZoneIds: [sourceZone.zoneId],
    },
  }
  const continuation: EffectContinuationState = {
    continuationId,
    requestId,
    sourceActionId: context.sourceActionId,
    sourcePieceId: context.sourcePieceId,
    effectDefinitionId: context.effectDefinition.id,
    actorPlayerId: context.actorPlayerId,
    operationIndex: context.operationIndex,
    operationKinds: context.operationKinds,
  }

  return {
    ok: true,
    paused: true,
    state: {
      ...currentState,
      status: 'awaiting_choice',
      pendingRequests: [request, ...context.initialPendingRequests],
      effectContinuations: [
        ...(currentState.effectContinuations ?? []),
        continuation,
      ],
    },
    request,
    continuation,
    events: [],
    timingWindows: [],
  }
}

function movePieces(
  currentState: GameState,
  input: {
    readonly context: OperationResolutionContext
    readonly pieceIds: readonly PieceId[]
    readonly transfers: readonly ZoneTransferIntent[]
  },
): RuntimeOperationResult {
  if (input.pieceIds.length === 0) {
    return {
      ok: true,
      state: currentState,
      events: [],
      timingWindows: [],
    }
  }

  const transferResult = resolveZoneTransferSequence(
    currentState,
    input.transfers,
  )

  if (!transferResult.ok) {
    return transferResult
  }

  const events = createPieceMovedEvents(
    input.context.transitionId,
    transferResult.transfers,
    {
      kind: 'system',
      system: 'automatic-flow',
    },
    {
      sourceActionId: input.context.sourceActionId,
      startingSequence: input.context.cursor.nextEventSequence,
    },
  )
  const timingWindows = events.flatMap((event, index) =>
    createTransitionTimingWindowTriplet('zone.transfer', {
      startingSequence:
        input.context.cursor.nextTimingWindowSequence + index * 3,
      relatedEventSequence: event.sequence,
      pieceId: event.pieceId,
    }),
  )

  return {
    ok: true,
    state: {
      ...currentState,
      zones: transferResult.zones,
      pieceStates: transferResult.pieceStates,
    },
    events,
    timingWindows,
  }
}

function movePiecesToOwnerZone(
  currentState: GameState,
  input: {
    readonly context: OperationResolutionContext
    readonly pieceIds: readonly PieceId[]
    readonly fromZoneId: ZoneId
    readonly destinationKind: 'bind' | 'drop' | 'hand'
    readonly reason: ZoneTransferReason
  },
): RuntimeOperationResult {
  const stateIndex = buildGameStateIndex(currentState)
  const transfers: ZoneTransferIntent[] = []

  for (const pieceId of input.pieceIds) {
    const piece = findPieceById(stateIndex, pieceId)

    if (piece?.ownerPlayerId === undefined) {
      return {
        ok: false,
        code: 'invalid_action_reference',
        message: `Effect operation requires selected piece ${pieceId} to have an owner.`,
      }
    }

    const destinationZone = findOwnedZoneByKind(
      stateIndex,
      piece.ownerPlayerId,
      input.destinationKind,
    )

    if (destinationZone === undefined) {
      return {
        ok: false,
        code: 'invalid_action_reference',
        message: `Effect operation requires owner ${piece.ownerPlayerId} to have a ${input.destinationKind} zone.`,
      }
    }

    transfers.push({
      pieceId,
      from: {
        zoneId: input.fromZoneId,
      },
      to: {
        zoneId: destinationZone.zoneId,
      },
      reason: input.reason,
    })
  }

  return movePieces(currentState, {
    context: input.context,
    pieceIds: input.pieceIds,
    transfers,
  })
}

function resolveZoneSelector(
  currentState: GameState,
  selector: EffectZoneSelector,
  context: RuntimeContext,
):
  | {
      readonly ok: true
      readonly zone: ZoneState
    }
  | Extract<RuntimeOperationResult, { readonly ok: false }> {
  const player = resolvePlayer(currentState, selector.player, context)

  if (!player.ok) {
    return player
  }

  const zone = findOwnedZoneByKind(
    buildGameStateIndex(currentState),
    player.player,
    selector.kind,
  )

  if (zone === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Effect operation requires player ${player.player.playerId} to own a ${selector.kind} zone.`,
    }
  }

  return {
    ok: true,
    zone,
  }
}

function resolvePlayer(
  currentState: GameState,
  selector: 'source_controller' | 'opponent',
  context: Pick<RuntimeContext, 'sourcePieceId'>,
):
  | {
      readonly ok: true
      readonly player: PlayerState
    }
  | Extract<RuntimeOperationResult, { readonly ok: false }> {
  const stateIndex = buildGameStateIndex(currentState)
  const sourcePiece = findPieceById(stateIndex, context.sourcePieceId)
  const sourceControllerPlayerId =
    sourcePiece?.controllerPlayerId ?? sourcePiece?.ownerPlayerId
  const playerId =
    selector === 'source_controller'
      ? sourceControllerPlayerId
      : sourceControllerPlayerId === undefined
        ? undefined
        : resolvePrimaryOpponentPlayerId(stateIndex, sourceControllerPlayerId)

  if (playerId === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Effect operation could not resolve ${selector} player from source piece ${context.sourcePieceId}.`,
    }
  }

  const player = findPlayerById(stateIndex, playerId)

  if (player === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Effect operation resolved unknown ${selector} player ${playerId}.`,
    }
  }

  return {
    ok: true,
    player,
  }
}

function pieceMatchesFilter(
  currentState: GameState,
  pieceId: PieceId,
  filter: EffectPieceFilter | undefined,
  context: RuntimeContext,
): boolean {
  if (filter === undefined) {
    return true
  }

  const stateIndex = buildGameStateIndex(currentState)
  const piece = findPieceById(stateIndex, pieceId)

  if (piece === undefined) {
    return false
  }

  if (filter.cardTypes !== undefined || filter.grades !== undefined) {
    const stats = currentState.cardStats?.cards.find(
      (card) => card.cardDefinitionId === piece.cardDefinitionId,
    )

    if (stats === undefined) {
      return false
    }

    if (
      filter.cardTypes !== undefined &&
      !filter.cardTypes.includes(stats.cardType)
    ) {
      return false
    }

    if (filter.grades !== undefined && !filter.grades.includes(stats.grade)) {
      return false
    }
  }

  if (filter.controller !== undefined) {
    const player = resolvePlayer(currentState, filter.controller, context)

    if (
      !player.ok ||
      (piece.controllerPlayerId ?? piece.ownerPlayerId) !==
        player.player.playerId
    ) {
      return false
    }
  }

  if (filter.owner !== undefined) {
    const player = resolvePlayer(currentState, filter.owner, context)

    if (!player.ok || piece.ownerPlayerId !== player.player.playerId) {
      return false
    }
  }

  return true
}

function resolveOpenSlotIds(zone: ZoneState): readonly ZoneSlotId[] {
  const occupiedSlotIds = new Set(
    zone.occupants
      .map((occupant) => occupant.slotId)
      .filter((slotId): slotId is ZoneSlotId => slotId !== undefined),
  )

  return (zone.layout.slotIds ?? []).filter(
    (slotId) => !occupiedSlotIds.has(slotId),
  )
}

function uniquePieceIds(pieceIds: readonly PieceId[]): readonly PieceId[] {
  return Array.from(new Set(pieceIds))
}

function advanceCursor(
  cursor: RuntimeCursor,
  events: readonly GameEvent[],
  timingWindows: readonly TransitionTimingWindow[],
): RuntimeCursor {
  return {
    nextEventSequence:
      events.length === 0
        ? cursor.nextEventSequence
        : Math.max(...events.map((event) => event.sequence)) + 1,
    nextTimingWindowSequence:
      timingWindows.length === 0
        ? cursor.nextTimingWindowSequence
        : Math.max(...timingWindows.map((window) => window.sequence)) + 1,
  }
}

function isResourceOperation(
  operation: DeclarativeEffectOperation,
): operation is ResourceEffectOperation {
  return (
    operation.kind === 'counter_blast' ||
    operation.kind === 'counter_charge' ||
    operation.kind === 'energy_blast' ||
    operation.kind === 'soul_blast' ||
    operation.kind === 'soul_charge'
  )
}

function createLocationFromZoneOccupant(
  zone: ZoneState,
): ZoneLocationReference {
  return {
    zoneId: zone.zoneId,
  }
}

function createEffectActivatedEvent(input: {
  readonly transitionId: TransitionId
  readonly sequence: number
  readonly action: ActivateCardEffectAction
}): EffectActivatedEvent {
  return {
    eventId: createEventId(input.transitionId, input.sequence),
    type: 'effect.activated',
    sequence: input.sequence,
    sourceActionId: input.action.actionId,
    origin: {
      kind: 'player',
      playerId: input.action.actor.playerId,
    },
    playerId: input.action.actor.playerId,
    sourcePieceId: input.action.sourcePieceId,
    effectDefinitionId: input.action.effectDefinitionId,
  }
}

function createEffectResolvedEvent(input: {
  readonly transitionId: TransitionId
  readonly sequence: number
  readonly sourceActionId: ActivateCardEffectAction['actionId']
  readonly effectDefinition: EffectDefinition
  readonly sourcePieceId: PieceId
  readonly operationKinds: readonly string[]
}): EffectResolvedEvent {
  return {
    eventId: createEventId(input.transitionId, input.sequence),
    type: 'effect.resolved',
    sequence: input.sequence,
    sourceActionId: input.sourceActionId,
    origin: {
      kind: 'system',
      system: 'automatic-flow',
    },
    effectDefinitionId: input.effectDefinition.id,
    sourcePieceId: input.sourcePieceId,
    operationKinds: input.operationKinds,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}

function createRequestId(
  transitionId: TransitionId,
  operationIndex: number,
): RequestId {
  return `${transitionId}:request:effect:${operationIndex}` as RequestId
}

function createContinuationId(
  transitionId: TransitionId,
  operationIndex: number,
): EffectContinuationId {
  return `${transitionId}:continuation:${operationIndex}` as EffectContinuationId
}
