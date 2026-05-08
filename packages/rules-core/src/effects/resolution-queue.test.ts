import { describe, expect, it } from 'vitest'

import type { AttackDeclaredEvent } from '../events'
import type { TransitionTimingWindow } from '../transitions'

import {
  CHECK_TRIGGER_REVEAL_EFFECT,
  PERSONA_RIDE_KEYWORD_EFFECT,
  TWIN_DRIVE_KEYWORD_EFFECT,
} from './samples'
import {
  createEffectResolutionQueue,
  dequeueEffectResolutionQueueItem,
  enqueueEffectResolutionQueueItems,
  hasQueuedEffectResolutionItems,
  type EffectResolutionQueueItemSeed,
} from './resolution-queue'

function makeTriggerEvent(sequence: number): AttackDeclaredEvent {
  return {
    eventId: `event-${sequence}` as AttackDeclaredEvent['eventId'],
    type: 'battle.attack_declared',
    sequence,
    origin: {
      kind: 'player',
      playerId: 'player-1' as AttackDeclaredEvent['origin']['playerId'],
    },
    battleId: 'battle-1' as AttackDeclaredEvent['battleId'],
    attackerPieceId: 'piece-attacker' as AttackDeclaredEvent['attackerPieceId'],
    target: {
      kind: 'player',
      playerId: 'player-2' as Extract<
        AttackDeclaredEvent['target'],
        { readonly kind: 'player' }
      >['playerId'],
    },
  }
}

function makeTimingWindow(
  sequence: number,
  relatedEventSequence: number,
): TransitionTimingWindow {
  return {
    sequence,
    point: 'battle.attack',
    window: 'after',
    relatedEventSequence,
  }
}

function makeSeed(
  input: Partial<EffectResolutionQueueItemSeed> & {
    readonly eventSequence: number
    readonly timingSequence: number
  },
): EffectResolutionQueueItemSeed {
  return {
    sourceKind: input.sourceKind ?? 'direct',
    triggerEvent: input.triggerEvent ?? makeTriggerEvent(input.eventSequence),
    timingWindow:
      input.timingWindow ??
      makeTimingWindow(input.timingSequence, input.eventSequence),
    effectDefinition: input.effectDefinition ?? CHECK_TRIGGER_REVEAL_EFFECT,
    ...(input.sourcePieceId === undefined
      ? {}
      : {
          sourcePieceId: input.sourcePieceId,
        }),
  }
}

describe('@web-vg/rules-core effect resolution queue', () => {
  it('creates queue items in deterministic staged order instead of caller order', () => {
    const queue = createEffectResolutionQueue({
      transitionId: 'transition-queue-order' as Parameters<
        typeof createEffectResolutionQueue
      >[0]['transitionId'],
      seeds: [
        makeSeed({
          eventSequence: 2,
          timingSequence: 2,
          sourceKind: 'keyword',
          effectDefinition: PERSONA_RIDE_KEYWORD_EFFECT,
          sourcePieceId: 'piece-persona' as NonNullable<
            EffectResolutionQueueItemSeed['sourcePieceId']
          >,
        }),
        makeSeed({
          eventSequence: 1,
          timingSequence: 2,
          sourceKind: 'keyword',
          effectDefinition: TWIN_DRIVE_KEYWORD_EFFECT,
          sourcePieceId: 'piece-twin-drive' as NonNullable<
            EffectResolutionQueueItemSeed['sourcePieceId']
          >,
        }),
        makeSeed({
          eventSequence: 1,
          timingSequence: 1,
          sourceKind: 'direct',
          effectDefinition: CHECK_TRIGGER_REVEAL_EFFECT,
        }),
      ],
    })

    expect(queue.policy).toBe('staged_fifo')
    expect(queue.items.map((item) => item.effectDefinition.id)).toEqual([
      CHECK_TRIGGER_REVEAL_EFFECT.id,
      TWIN_DRIVE_KEYWORD_EFFECT.id,
      PERSONA_RIDE_KEYWORD_EFFECT.id,
    ])
    expect(queue.items.map((item) => item.insertionSequence)).toEqual([0, 1, 2])
    expect(queue.items.map((item) => item.depth)).toEqual([0, 0, 0])
  })

  it('consumes items FIFO and appends nested work to the tail', () => {
    const queue = createEffectResolutionQueue({
      transitionId: 'transition-queue-fifo' as Parameters<
        typeof createEffectResolutionQueue
      >[0]['transitionId'],
      seeds: [
        makeSeed({
          eventSequence: 0,
          timingSequence: 0,
          effectDefinition: CHECK_TRIGGER_REVEAL_EFFECT,
        }),
        makeSeed({
          eventSequence: 1,
          timingSequence: 1,
          effectDefinition: PERSONA_RIDE_KEYWORD_EFFECT,
          sourceKind: 'keyword',
        }),
      ],
    })
    const first = dequeueEffectResolutionQueueItem(queue)

    expect(first.item?.effectDefinition.id).toBe(CHECK_TRIGGER_REVEAL_EFFECT.id)
    if (first.item === undefined) {
      throw new Error('Expected first queue item.')
    }

    const withNested = enqueueEffectResolutionQueueItems(first.queue, {
      transitionId: 'transition-queue-fifo' as Parameters<
        typeof createEffectResolutionQueue
      >[0]['transitionId'],
      parentItem: first.item,
      seeds: [
        makeSeed({
          eventSequence: 2,
          timingSequence: 2,
          effectDefinition: CHECK_TRIGGER_REVEAL_EFFECT,
        }),
      ],
    })

    expect(withNested.items.map((item) => item.effectDefinition.id)).toEqual([
      PERSONA_RIDE_KEYWORD_EFFECT.id,
      CHECK_TRIGGER_REVEAL_EFFECT.id,
    ])
    expect(withNested.items[1]?.parentItemId).toBe(first.item.itemId)
    expect(withNested.items[1]?.depth).toBe(1)
  })

  it('handles empty and depth-bounded queues calmly', () => {
    const emptyQueue = createEffectResolutionQueue({
      transitionId: 'transition-queue-empty' as Parameters<
        typeof createEffectResolutionQueue
      >[0]['transitionId'],
    })

    expect(hasQueuedEffectResolutionItems(emptyQueue)).toBe(false)
    expect(dequeueEffectResolutionQueueItem(emptyQueue).item).toBeUndefined()

    const rootQueue = createEffectResolutionQueue({
      transitionId: 'transition-queue-depth' as Parameters<
        typeof createEffectResolutionQueue
      >[0]['transitionId'],
      maxDepth: 0,
      seeds: [
        makeSeed({
          eventSequence: 0,
          timingSequence: 0,
        }),
      ],
    })
    const root = dequeueEffectResolutionQueueItem(rootQueue)
    if (root.item === undefined) {
      throw new Error('Expected root queue item.')
    }
    const bounded = enqueueEffectResolutionQueueItems(root.queue, {
      transitionId: 'transition-queue-depth' as Parameters<
        typeof createEffectResolutionQueue
      >[0]['transitionId'],
      parentItem: root.item,
      seeds: [
        makeSeed({
          eventSequence: 1,
          timingSequence: 1,
        }),
      ],
    })

    expect(root.item?.depth).toBe(0)
    expect(bounded.items).toEqual([])
  })
})
