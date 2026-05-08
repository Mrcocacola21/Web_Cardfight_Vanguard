import type { Brand } from '@web-vg/shared'

import type { EffectDefinitionId, PieceId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type { TransitionTimingWindow } from '../transitions/transition'

import type { EffectDefinition } from './effect'

export const DEFAULT_EFFECT_RESOLUTION_QUEUE_MAX_DEPTH = 4

export type EffectResolutionQueuePolicy = 'staged_fifo'
export type EffectResolutionSourceKind = 'direct' | 'keyword'
export type EffectResolutionQueueItemId = Brand<
  string,
  'EffectResolutionQueueItemId'
>

export interface EffectResolutionQueueItemSeed {
  readonly sourceKind: EffectResolutionSourceKind
  readonly triggerEvent: GameEvent
  readonly timingWindow: TransitionTimingWindow
  readonly effectDefinition: EffectDefinition
  readonly sourcePieceId?: PieceId
}

export interface EffectResolutionQueueItem extends EffectResolutionQueueItemSeed {
  readonly itemId: EffectResolutionQueueItemId
  readonly insertionSequence: number
  readonly depth: number
  readonly effectDefinitionId: EffectDefinitionId
  readonly parentItemId?: EffectResolutionQueueItemId
}

export interface EffectResolutionQueue {
  readonly policy: EffectResolutionQueuePolicy
  readonly items: readonly EffectResolutionQueueItem[]
  readonly nextInsertionSequence: number
  readonly maxDepth: number
}

export function createEffectResolutionQueue(options: {
  readonly transitionId: TransitionId
  readonly seeds?: readonly EffectResolutionQueueItemSeed[]
  readonly maxDepth?: number
}): EffectResolutionQueue {
  return enqueueEffectResolutionQueueItems(
    {
      policy: 'staged_fifo',
      items: [],
      nextInsertionSequence: 0,
      maxDepth: options.maxDepth ?? DEFAULT_EFFECT_RESOLUTION_QUEUE_MAX_DEPTH,
    },
    {
      transitionId: options.transitionId,
      seeds: options.seeds ?? [],
    },
  )
}

export function enqueueEffectResolutionQueueItems(
  queue: EffectResolutionQueue,
  input: {
    readonly transitionId: TransitionId
    readonly seeds: readonly EffectResolutionQueueItemSeed[]
    readonly parentItem?: EffectResolutionQueueItem
  },
): EffectResolutionQueue {
  const depth = input.parentItem === undefined ? 0 : input.parentItem.depth + 1

  if (depth > queue.maxDepth || input.seeds.length === 0) {
    return queue
  }

  const orderedSeeds = [...input.seeds].sort(
    compareEffectResolutionQueueItemSeeds,
  )
  let nextInsertionSequence = queue.nextInsertionSequence
  const items = [...queue.items]

  for (const seed of orderedSeeds) {
    items.push({
      ...seed,
      itemId: createEffectResolutionQueueItemId(
        input.transitionId,
        nextInsertionSequence,
      ),
      insertionSequence: nextInsertionSequence,
      depth,
      effectDefinitionId: seed.effectDefinition.id,
      ...(input.parentItem === undefined
        ? {}
        : {
            parentItemId: input.parentItem.itemId,
          }),
    })
    nextInsertionSequence += 1
  }

  return {
    ...queue,
    items,
    nextInsertionSequence,
  }
}

export function dequeueEffectResolutionQueueItem(
  queue: EffectResolutionQueue,
): {
  readonly item?: EffectResolutionQueueItem
  readonly queue: EffectResolutionQueue
} {
  const [item, ...items] = queue.items

  return {
    ...(item === undefined ? {} : { item }),
    queue: {
      ...queue,
      items,
    },
  }
}

export function hasQueuedEffectResolutionItems(
  queue: EffectResolutionQueue,
): boolean {
  return queue.items.length > 0
}

export function compareEffectResolutionQueueItems(
  left: EffectResolutionQueueItem,
  right: EffectResolutionQueueItem,
): number {
  return left.insertionSequence - right.insertionSequence
}

export function compareEffectResolutionQueueItemSeeds(
  left: EffectResolutionQueueItemSeed,
  right: EffectResolutionQueueItemSeed,
): number {
  return (
    left.triggerEvent.sequence - right.triggerEvent.sequence ||
    left.timingWindow.sequence - right.timingWindow.sequence ||
    sourceKindRank(left.sourceKind) - sourceKindRank(right.sourceKind) ||
    left.effectDefinition.id.localeCompare(right.effectDefinition.id) ||
    (left.sourcePieceId ?? '').localeCompare(right.sourcePieceId ?? '')
  )
}

function sourceKindRank(sourceKind: EffectResolutionSourceKind): number {
  return sourceKind === 'direct' ? 0 : 1
}

function createEffectResolutionQueueItemId(
  transitionId: TransitionId,
  insertionSequence: number,
): EffectResolutionQueueItemId {
  return `${transitionId}:effect-queue:${insertionSequence}` as EffectResolutionQueueItemId
}
