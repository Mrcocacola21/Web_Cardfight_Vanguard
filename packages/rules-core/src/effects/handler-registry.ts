import type { TransitionId } from '../contracts'
import { assertRulesInvariant } from '../errors'
import type { GameEvent } from '../events'
import type { GameState } from '../state'
import type { TransitionTimingWindow } from '../transitions'

import type { EffectDefinition, EffectHandlerKey } from './effect'
import type { EffectResolutionQueueItem } from './resolution-queue'

export type EffectHandlerResult =
  | {
      readonly ok: true
      readonly state: GameState
      readonly events: readonly GameEvent[]
      readonly timingWindows: readonly TransitionTimingWindow[]
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    }

export interface EffectHandlerInput {
  readonly currentState: GameState
  readonly queueItem: EffectResolutionQueueItem
  readonly transitionId: TransitionId
  readonly startingSequence: number
  readonly startingTimingWindowSequence: number
}

export interface EffectHandler {
  readonly key: EffectHandlerKey
  resolve(input: EffectHandlerInput): EffectHandlerResult
}

export class EffectHandlerRegistry {
  private readonly handlersByKey: ReadonlyMap<EffectHandlerKey, EffectHandler>

  private readonly handlerKeys: readonly EffectHandlerKey[]

  constructor(
    handlersByKey: ReadonlyMap<EffectHandlerKey, EffectHandler> = new Map(),
    handlerKeys: readonly EffectHandlerKey[] = [],
  ) {
    this.handlersByKey = handlersByKey
    this.handlerKeys = handlerKeys
  }

  get size(): number {
    return this.handlerKeys.length
  }

  register(handler: EffectHandler): EffectHandlerRegistry {
    assertRulesInvariant(
      !this.handlersByKey.has(handler.key),
      `Effect handler ${handler.key} is already registered.`,
    )

    const handlersByKey = new Map(this.handlersByKey)
    handlersByKey.set(handler.key, handler)

    return new EffectHandlerRegistry(handlersByKey, [
      ...this.handlerKeys,
      handler.key,
    ])
  }

  hasHandler(key: EffectHandlerKey): boolean {
    return this.handlersByKey.has(key)
  }

  getHandler(key: EffectHandlerKey): EffectHandler | undefined {
    return this.handlersByKey.get(key)
  }

  requireHandler(key: EffectHandlerKey): EffectHandler {
    const handler = this.handlersByKey.get(key)

    assertRulesInvariant(
      handler !== undefined,
      `Effect handler ${key} is not registered.`,
    )

    return handler
  }

  listHandlers(): readonly EffectHandler[] {
    return this.handlerKeys.map((key) => this.requireHandler(key))
  }

  assertHasHandlersForEffectDefinitions(
    definitions: readonly EffectDefinition[],
  ): void {
    const missingKeys = Array.from(
      new Set(
        definitions
          .map((definition) => resolveEffectDefinitionHandlerKey(definition))
          .filter((key): key is EffectHandlerKey => key !== undefined)
          .filter((key) => !this.hasHandler(key)),
      ),
    )

    assertRulesInvariant(
      missingKeys.length === 0,
      `Missing effect runtime handler(s): ${missingKeys.join(', ')}.`,
    )
  }
}

export function createEffectHandlerRegistry(
  handlers: readonly EffectHandler[] = [],
): EffectHandlerRegistry {
  return handlers.reduce(
    (registry, handler) => registry.register(handler),
    new EffectHandlerRegistry(),
  )
}

export function resolveEffectDefinitionHandlerKey(
  definition: EffectDefinition,
): EffectHandlerKey | undefined {
  const { strategy } = definition.resolution

  switch (strategy.kind) {
    case 'typed_handler':
      return strategy.handlerKey
    case 'hybrid':
      return strategy.handlerKey
    case 'declarative_descriptor':
      return undefined
  }
}
