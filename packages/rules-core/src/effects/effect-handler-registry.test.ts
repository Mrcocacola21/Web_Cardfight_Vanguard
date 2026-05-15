import { describe, expect, it } from 'vitest'

import { RulesInvariantError } from '../errors'

import {
  createEffectHandlerKey,
  createEffectHandlerRegistry,
  createEffectIdentity,
  createEffectTimingBinding,
  defineEffectDefinition,
  resolveEffectDefinitionHandlerKey,
  type EffectDefinition,
  type EffectHandler,
  type EffectHandlerKey,
} from './index'

function makeNoopHandler(key: EffectHandlerKey): EffectHandler {
  return {
    key,
    resolve(input) {
      return {
        ok: true,
        state: input.currentState,
        events: [],
        timingWindows: [],
      }
    },
  }
}

function makeTypedEffectDefinition(
  key: string,
  handlerKey: EffectHandlerKey,
): EffectDefinition {
  const identity = createEffectIdentity('test', key)

  return defineEffectDefinition({
    id: identity.id,
    identity,
    kind: 'triggered',
    trigger: {
      kind: 'event',
      eventTypes: ['battle.attack_declared'],
    },
    timing: [createEffectTimingBinding('battle.attack', 'after')],
    applicability: {
      scope: 'global',
    },
    resolution: {
      model: 'automatic',
      strategy: {
        kind: 'typed_handler',
        handlerKey,
      },
    },
  })
}

describe('@web-vg/rules-core effect handler registry', () => {
  it('registers runtime handlers immutably by handler key', () => {
    const handlerKey = createEffectHandlerKey('test.runtime.handler')
    const handler = makeNoopHandler(handlerKey)
    const registry = createEffectHandlerRegistry()
    const nextRegistry = registry.register(handler)

    expect(registry.size).toBe(0)
    expect(nextRegistry.size).toBe(1)
    expect(nextRegistry.hasHandler(handlerKey)).toBe(true)
    expect(nextRegistry.getHandler(handlerKey)).toBe(handler)
    expect(nextRegistry.requireHandler(handlerKey)).toBe(handler)
    expect(nextRegistry.listHandlers()).toEqual([handler])
  })

  it('rejects duplicate runtime handler keys', () => {
    const handlerKey = createEffectHandlerKey('test.runtime.duplicate')
    const handler = makeNoopHandler(handlerKey)

    expect(() => createEffectHandlerRegistry([handler, handler])).toThrow(
      RulesInvariantError,
    )
  })

  it('validates missing handlers for typed and hybrid definitions explicitly', () => {
    const handlerKey = createEffectHandlerKey('test.runtime.required')
    const definition = makeTypedEffectDefinition(
      'requires-runtime-handler',
      handlerKey,
    )
    const emptyRegistry = createEffectHandlerRegistry()
    const populatedRegistry = createEffectHandlerRegistry([
      makeNoopHandler(handlerKey),
    ])

    expect(resolveEffectDefinitionHandlerKey(definition)).toBe(handlerKey)
    expect(() =>
      emptyRegistry.assertHasHandlersForEffectDefinitions([definition]),
    ).toThrow(RulesInvariantError)
    expect(() =>
      populatedRegistry.assertHasHandlersForEffectDefinitions([definition]),
    ).not.toThrow()
  })
})
