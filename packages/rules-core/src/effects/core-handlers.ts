import type { ActionId, EventId, PieceId, TransitionId } from '../contracts'
import type { EffectResolvedEvent, GameEvent } from '../events'
import type { TransitionTimingWindow } from '../transitions'

import { createEffectHandlerKey, type EffectDefinition } from './effect'
import { resolvePersonaRideEffect } from './first-effects'
import {
  createEffectHandlerRegistry,
  type EffectHandler,
  type EffectHandlerResult,
} from './handler-registry'
import {
  UNIT_ATTACK_AUTO_EFFECT,
  CHECK_TRIGGER_REVEAL_EFFECT,
  CARDS_DRAWN_FINALIZE_EFFECT,
  PERSONA_RIDE_KEYWORD_EFFECT,
} from './samples'
import { resolveCheckTriggerRevealEffect } from './trigger-resolution'

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const

export const UNIT_ATTACK_AUTO_EFFECT_HANDLER_KEY = createEffectHandlerKey(
  'core.auto.when-unit-attacks',
)
export const CHECK_TRIGGER_REVEAL_EFFECT_HANDLER_KEY = createEffectHandlerKey(
  'core.check.resolve-revealed-triggers',
)
export const CARDS_DRAWN_FINALIZE_EFFECT_HANDLER_KEY = createEffectHandlerKey(
  'core.draw.finalize-cards-drawn',
)
export const PERSONA_RIDE_EFFECT_HANDLER_KEY = createEffectHandlerKey(
  'keyword.persona-ride.on-ride',
)

const unitAttackAutoHandler: EffectHandler = {
  key: UNIT_ATTACK_AUTO_EFFECT_HANDLER_KEY,
  resolve(input) {
    if (input.queueItem.triggerEvent.type !== 'battle.attack_declared') {
      return createHandlerEventMismatch(
        input.queueItem.effectDefinition,
        input.queueItem.triggerEvent,
        ['battle.attack_declared'],
      )
    }

    return {
      ok: true,
      state: input.currentState,
      events: [],
      timingWindows: [],
    }
  },
}

const checkTriggerRevealHandler: EffectHandler = {
  key: CHECK_TRIGGER_REVEAL_EFFECT_HANDLER_KEY,
  resolve(input) {
    if (
      input.queueItem.triggerEvent.type !== 'battle.drive_checked' &&
      input.queueItem.triggerEvent.type !== 'battle.damage_checked'
    ) {
      return createHandlerEventMismatch(
        input.queueItem.effectDefinition,
        input.queueItem.triggerEvent,
        ['battle.drive_checked', 'battle.damage_checked'],
      )
    }

    return resolveCheckTriggerRevealEffect(input.currentState, {
      transitionId: input.transitionId,
      triggerEvent: input.queueItem.triggerEvent,
      effectDefinition: input.queueItem.effectDefinition,
      startingSequence: input.startingSequence,
      startingTimingWindowSequence: input.startingTimingWindowSequence,
      ...(input.queueItem.triggerEvent.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.queueItem.triggerEvent.sourceActionId,
          }),
    })
  },
}

const cardsDrawnFinalizeHandler: EffectHandler = {
  key: CARDS_DRAWN_FINALIZE_EFFECT_HANDLER_KEY,
  resolve(input) {
    if (input.queueItem.triggerEvent.type !== 'cards.drawn') {
      return createHandlerEventMismatch(
        input.queueItem.effectDefinition,
        input.queueItem.triggerEvent,
        ['cards.drawn'],
      )
    }

    return {
      ok: true,
      state: input.currentState,
      events: [
        createEffectResolvedEvent({
          transitionId: input.transitionId,
          sequence: input.startingSequence,
          ...(input.queueItem.triggerEvent.sourceActionId === undefined
            ? {}
            : {
                sourceActionId: input.queueItem.triggerEvent.sourceActionId,
              }),
          effectDefinition: input.queueItem.effectDefinition,
          triggerEventSequence: input.queueItem.triggerEvent.sequence,
          operationKinds: ['typed_handler'],
        }),
      ],
      timingWindows: [],
    }
  },
}

const personaRideHandler: EffectHandler = {
  key: PERSONA_RIDE_EFFECT_HANDLER_KEY,
  resolve(input) {
    if (input.queueItem.triggerEvent.type !== 'card.rode') {
      return createHandlerEventMismatch(
        input.queueItem.effectDefinition,
        input.queueItem.triggerEvent,
        ['card.rode'],
      )
    }

    const sourceActionId = input.queueItem.triggerEvent.sourceActionId

    if (sourceActionId === undefined) {
      return {
        ok: false,
        code: 'invalid_action_reference',
        message: `Effect ${input.queueItem.effectDefinition.id} requires a source action to resolve Persona Ride.`,
      }
    }

    const result = resolvePersonaRideEffect({
      currentState: input.currentState,
      transitionId: input.transitionId,
      sourceActionId,
      rideEvent: input.queueItem.triggerEvent,
      effectDefinition: input.queueItem.effectDefinition,
      startingSequence: input.startingSequence,
    })

    return result.ok
      ? {
          ...result,
          timingWindows: createNestedTimingWindowsForEffectEvents(
            result.events,
            input.startingTimingWindowSequence,
          ),
        }
      : result
  },
}

export const CORE_EFFECT_HANDLERS: readonly EffectHandler[] = [
  unitAttackAutoHandler,
  checkTriggerRevealHandler,
  cardsDrawnFinalizeHandler,
  personaRideHandler,
]

export const coreEffectHandlerRegistry =
  createEffectHandlerRegistry(CORE_EFFECT_HANDLERS)

coreEffectHandlerRegistry.assertHasHandlersForEffectDefinitions([
  UNIT_ATTACK_AUTO_EFFECT,
  CHECK_TRIGGER_REVEAL_EFFECT,
  CARDS_DRAWN_FINALIZE_EFFECT,
  PERSONA_RIDE_KEYWORD_EFFECT,
])

function createHandlerEventMismatch(
  effectDefinition: EffectDefinition,
  event: GameEvent,
  expectedTypes: readonly GameEvent['type'][],
): EffectHandlerResult {
  return {
    ok: false,
    code: 'invalid_action_reference',
    message: `Effect ${effectDefinition.id} handler received event ${event.type}, but expected ${expectedTypes.join(
      ' or ',
    )}.`,
  }
}

function createNestedTimingWindowsForEffectEvents(
  events: readonly GameEvent[],
  startingSequence: number,
): readonly TransitionTimingWindow[] {
  let sequence = startingSequence
  const timingWindows: TransitionTimingWindow[] = []

  for (const event of events) {
    if (event.type !== 'cards.drawn') {
      continue
    }

    timingWindows.push({
      sequence,
      point: 'zone.transfer',
      window: 'after',
      relatedEventSequence: event.sequence,
    })
    sequence += 1
  }

  return timingWindows
}

function createEffectResolvedEvent(input: {
  readonly transitionId: TransitionId
  readonly sequence: number
  readonly sourceActionId?: ActionId
  readonly effectDefinition: EffectDefinition
  readonly sourcePieceId?: PieceId
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
    origin: {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    effectDefinitionId: input.effectDefinition.id,
    ...(input.sourcePieceId === undefined
      ? {}
      : {
          sourcePieceId: input.sourcePieceId,
        }),
    ...(input.triggerEventSequence === undefined
      ? {}
      : {
          triggerEventSequence: input.triggerEventSequence,
        }),
    operationKinds: input.operationKinds,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
