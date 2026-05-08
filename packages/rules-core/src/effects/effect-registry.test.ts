import { describe, expect, it } from 'vitest'

import type { AttackDeclaredEvent, EventType } from '../events'
import { RulesInvariantError } from '../errors'

import {
  CHECK_TRIGGER_REVEAL_EFFECT,
  CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY,
  CORE_EFFECT_DEFINITIONS,
  UNIT_ATTACK_AUTO_EFFECT,
  UNIT_ATTACK_AUTO_EFFECT_IDENTITY,
  coreEffectRegistry,
  createEffectHandlerKey,
  createEffectIdentity,
  createEffectRegistry,
  createEffectTimingBinding,
  type EffectDefinition,
} from './index'

function makeAttackDeclaredEvent(): AttackDeclaredEvent {
  return {
    eventId: 'event-attack' as AttackDeclaredEvent['eventId'],
    type: 'battle.attack_declared',
    sequence: 0,
    origin: {
      kind: 'player',
      playerId: 'player-1' as AttackDeclaredEvent['origin']['playerId'],
    },
    battleId: 'battle-1' as AttackDeclaredEvent['battleId'],
    attackerPieceId: 'piece-1' as AttackDeclaredEvent['attackerPieceId'],
    target: {
      kind: 'player',
      playerId: 'player-2' as Extract<
        AttackDeclaredEvent['target'],
        { readonly kind: 'player' }
      >['playerId'],
    },
  }
}

function makeTriggeredEffectDefinition(
  key: string,
  options: {
    readonly eventTypes?: readonly EventType[]
    readonly timing?: readonly EffectDefinition['timing'][number][]
  } = {},
): EffectDefinition {
  const identity = createEffectIdentity('test', key)

  return {
    id: identity.id,
    identity,
    kind: 'triggered',
    trigger: {
      kind: 'event',
      eventTypes: options.eventTypes ?? ['battle.attack_declared'],
    },
    timing: options.timing ?? [
      createEffectTimingBinding('battle.attack', 'after'),
    ],
    applicability: {
      scope: 'global',
    },
    resolution: {
      model: 'automatic',
      strategy: {
        kind: 'typed_handler',
        handlerKey: createEffectHandlerKey(`test.${key}`),
      },
    },
  }
}

function ids(
  definitions: readonly EffectDefinition[],
): readonly EffectDefinition['id'][] {
  return definitions.map((definition) => definition.id)
}

describe('@web-vg/rules-core effect registry', () => {
  it('creates an empty registry and registers definitions immutably', () => {
    const registry = createEffectRegistry()
    const effect = makeTriggeredEffectDefinition('attack-auto')
    const nextRegistry = registry.register(effect)

    expect(registry.size).toBe(0)
    expect(nextRegistry.size).toBe(1)
    expect(nextRegistry.hasDefinition(effect.id)).toBe(true)
    expect(nextRegistry.hasDefinition(effect.identity)).toBe(true)
    expect(nextRegistry.getDefinition(effect.id)?.id).toBe(effect.id)
    expect(nextRegistry.requireDefinition(effect.identity).id).toBe(effect.id)
  })

  it('rejects duplicate effect definition ids', () => {
    const effect = makeTriggeredEffectDefinition('duplicate')

    expect(() => createEffectRegistry([effect, effect])).toThrow(
      RulesInvariantError,
    )
  })

  it('keeps registered metadata stable after caller-owned arrays change', () => {
    const eventTypes: EventType[] = ['battle.attack_declared']
    const timing = [createEffectTimingBinding('battle.attack', 'after')]
    const effect = makeTriggeredEffectDefinition('stable-metadata', {
      eventTypes,
      timing,
    })
    const registry = createEffectRegistry([effect])

    eventTypes.push('battle.completed')
    timing.push(createEffectTimingBinding('battle.completion', 'after'))

    const storedEffect = registry.requireDefinition(effect.id)

    expect(Object.isFrozen(storedEffect)).toBe(true)
    expect(Object.isFrozen(storedEffect.timing)).toBe(true)
    expect(storedEffect.timing).toEqual([
      {
        point: 'battle.attack',
        window: 'after',
      },
    ])
    expect(storedEffect.trigger.kind).toBe('event')

    if (storedEffect.trigger.kind === 'event') {
      expect(Object.isFrozen(storedEffect.trigger.eventTypes)).toBe(true)
      expect(storedEffect.trigger.eventTypes).toEqual([
        'battle.attack_declared',
      ])
    }
  })

  it('finds candidate definitions through event and timing contracts', () => {
    const effect = makeTriggeredEffectDefinition('attack-candidate')
    const registry = createEffectRegistry([effect])
    const timingWindow = {
      sequence: 2,
      window: 'after',
      point: 'battle.attack',
      relatedEventSequence: 0,
      battleId: 'battle-1' as NonNullable<AttackDeclaredEvent['battleId']>,
      pieceId: 'piece-1' as AttackDeclaredEvent['attackerPieceId'],
    } as const

    expect(
      ids(registry.findDefinitionsByEvent(makeAttackDeclaredEvent())),
    ).toEqual([effect.id])
    expect(ids(registry.findDefinitionsByTimingWindow(timingWindow))).toEqual([
      effect.id,
    ])
    expect(
      ids(
        registry.findCandidateDefinitions({
          event: makeAttackDeclaredEvent(),
          timingWindow,
        }),
      ),
    ).toEqual([effect.id])
  })

  it('exposes core sample effects through the registry', () => {
    expect(coreEffectRegistry.size).toBe(CORE_EFFECT_DEFINITIONS.length)
    expect(
      coreEffectRegistry.requireDefinition(UNIT_ATTACK_AUTO_EFFECT_IDENTITY).id,
    ).toBe(UNIT_ATTACK_AUTO_EFFECT.id)
    expect(
      coreEffectRegistry.requireDefinition(CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY)
        .id,
    ).toBe(CHECK_TRIGGER_REVEAL_EFFECT.id)
    expect(
      ids(coreEffectRegistry.findDefinitionsByEvent('battle.drive_checked')),
    ).toContain(CHECK_TRIGGER_REVEAL_EFFECT.id)
    expect(
      ids(
        coreEffectRegistry.findDefinitionsByTimingWindow(
          createEffectTimingBinding('battle.damage_check', 'after'),
        ),
      ),
    ).toContain(CHECK_TRIGGER_REVEAL_EFFECT.id)
  })
})
