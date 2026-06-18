import type { TransitionId } from '../contracts'
import type { GameState } from '../state'
import type { TransitionTimingWindow } from '../transitions'
import { resolveResourceEffectDefinition } from '../resources'

import {
  getDeclarativeEffectOperations,
  type DeclarativeEffectOperation,
  type EffectHandlerKey,
  type ResourceEffectOperation,
} from './effect'
import type {
  EffectHandlerRegistry,
  EffectHandlerResult,
} from './handler-registry'
import type { EffectResolutionQueueItem } from './resolution-queue'

export interface EffectRuntimeDispatchInput {
  readonly currentState: GameState
  readonly queueItem: EffectResolutionQueueItem
  readonly transitionId: TransitionId
  readonly startingSequence: number
  readonly startingTimingWindowSequence: number
  readonly effectHandlers: EffectHandlerRegistry
}

export type EffectRuntimeDispatchResult = EffectHandlerResult

export function resolveEffectRuntimeQueueItem(
  input: EffectRuntimeDispatchInput,
): EffectRuntimeDispatchResult {
  const { strategy } = input.queueItem.effectDefinition.resolution

  switch (strategy.kind) {
    case 'typed_handler':
      return resolveTypedOrHybridHandler(input, strategy.handlerKey)
    case 'hybrid':
      return resolveTypedOrHybridHandler(input, strategy.handlerKey)
    case 'declarative_descriptor':
      return resolveDeclarativeEffectQueueItem(input)
  }
}

function resolveTypedOrHybridHandler(
  input: EffectRuntimeDispatchInput,
  handlerKey: EffectHandlerKey,
): EffectRuntimeDispatchResult {
  const handler = input.effectHandlers.getHandler(handlerKey)

  if (handler === undefined) {
    return {
      ok: false,
      code: 'invalid_action',
      message: `Effect ${input.queueItem.effectDefinition.id} requires runtime handler ${handlerKey}, but no handler is registered.`,
    }
  }

  return handler.resolve({
    currentState: input.currentState,
    queueItem: input.queueItem,
    transitionId: input.transitionId,
    startingSequence: input.startingSequence,
    startingTimingWindowSequence: input.startingTimingWindowSequence,
  })
}

function resolveDeclarativeEffectQueueItem(
  input: EffectRuntimeDispatchInput,
): EffectRuntimeDispatchResult {
  const operations = getDeclarativeEffectOperations(
    input.queueItem.effectDefinition,
  )

  if (operations.length === 0) {
    return {
      ok: true,
      state: input.currentState,
      events: [],
      timingWindows: [],
    }
  }

  if (operations.every(isResourceOperation)) {
    return resolveResourceDeclarativeEffectQueueItem(input, operations)
  }

  return {
    ok: false,
    code: 'invalid_action',
    message: `Effect ${input.queueItem.effectDefinition.id} declares declarative operation(s) that the triggered runtime cannot execute generically yet: ${Array.from(
      new Set(operations.map((operation) => operation.kind)),
    ).join(', ')}.`,
  }
}

function resolveResourceDeclarativeEffectQueueItem(
  input: EffectRuntimeDispatchInput,
  operations: readonly ResourceEffectOperation[],
): EffectRuntimeDispatchResult {
  const sourcePieceId = input.queueItem.sourcePieceId

  if (sourcePieceId === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Effect ${input.queueItem.effectDefinition.id} requires a source piece to resolve resource operation(s): ${operations
        .map((operation) => operation.kind)
        .join(', ')}.`,
    }
  }

  const result = resolveResourceEffectDefinition({
    currentState: input.currentState,
    transitionId: input.transitionId,
    ...(input.queueItem.triggerEvent.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: input.queueItem.triggerEvent.sourceActionId,
        }),
    sourcePieceId,
    effectDefinition: input.queueItem.effectDefinition,
    triggerEventSequence: input.queueItem.triggerEvent.sequence,
    startingSequence: input.startingSequence,
  })

  return result.ok
    ? {
        ...result,
        timingWindows: [] as readonly TransitionTimingWindow[],
      }
    : result
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
