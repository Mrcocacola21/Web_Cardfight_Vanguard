import type { FormatId } from '@web-vg/shared'
import { describe, expect, it } from 'vitest'

import { RulesInvariantError } from '../errors'
import {
  PERSONA_RIDE_KEYWORD,
  TWIN_DRIVE_KEYWORD,
  keywordMechanicsRegistry,
} from '../keywords'

import {
  BOOST_KEYWORD_EFFECT,
  BOOST_KEYWORD_EFFECT_IDENTITY,
  PERSONA_RIDE_KEYWORD_EFFECT,
  PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY,
  TWIN_DRIVE_KEYWORD_EFFECT,
  TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY,
  coreEffectRegistry,
  createEffectDescriptorKey,
  createEffectHandlerKey,
  createEffectIdentity,
  createEffectRegistry,
  defineEffectDefinition,
  getDeclarativeEffectOperations,
  getEffectRepresentationKind,
  isDeclarativeEffectDefinition,
  isHybridEffectDefinition,
  isTypedEffectDefinition,
  type DeclarativeEffectOperation,
  type EffectDefinition,
} from './index'

const STANDARD_FORMAT_ID = 'standard' as FormatId

function makeDeclarativeCheckEffect(
  key: string,
  operations: readonly DeclarativeEffectOperation[],
): EffectDefinition {
  const identity = createEffectIdentity('test', key)

  return {
    id: identity.id,
    identity,
    kind: 'continuous',
    trigger: {
      kind: 'static',
    },
    timing: [
      {
        point: 'battle.drive_check',
        window: 'before',
      },
    ],
    applicability: {
      scope: 'global',
    },
    resolution: {
      model: 'continuous',
      strategy: {
        kind: 'declarative_descriptor',
        descriptorKey: createEffectDescriptorKey(`test.${key}`),
        operations,
      },
    },
  }
}

describe('@web-vg/rules-core hybrid effect model', () => {
  it('classifies typed, declarative, and hybrid effects under one definition contract', () => {
    expect(getEffectRepresentationKind(BOOST_KEYWORD_EFFECT)).toBe('typed')
    expect(getEffectRepresentationKind(TWIN_DRIVE_KEYWORD_EFFECT)).toBe(
      'declarative',
    )
    expect(getEffectRepresentationKind(PERSONA_RIDE_KEYWORD_EFFECT)).toBe(
      'hybrid',
    )

    expect(isTypedEffectDefinition(BOOST_KEYWORD_EFFECT)).toBe(true)
    expect(isDeclarativeEffectDefinition(TWIN_DRIVE_KEYWORD_EFFECT)).toBe(true)
    expect(isHybridEffectDefinition(PERSONA_RIDE_KEYWORD_EFFECT)).toBe(true)
  })

  it('registers and looks up all representations through the same effect registry', () => {
    const typed = coreEffectRegistry.requireDefinition(
      BOOST_KEYWORD_EFFECT_IDENTITY,
    )
    const declarative = coreEffectRegistry.requireDefinition(
      TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY,
    )
    const hybrid = coreEffectRegistry.requireDefinition(
      PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY,
    )

    expect(getEffectRepresentationKind(typed)).toBe('typed')
    expect(getEffectRepresentationKind(declarative)).toBe('declarative')
    expect(getEffectRepresentationKind(hybrid)).toBe('hybrid')
  })

  it('keeps declarative operation metadata stable after registration', () => {
    const operations: DeclarativeEffectOperation[] = [
      {
        kind: 'adjust_check_count',
        check: 'drive',
        mode: 'add',
        amount: 1,
        subject: 'source_unit',
        duration: 'during_current_check',
      },
    ]
    const effect = makeDeclarativeCheckEffect('stable-check-count', operations)
    const registry = createEffectRegistry([effect])

    operations.push({
      kind: 'draw_cards',
      count: 1,
      player: 'source_controller',
      duration: 'immediate',
    })

    const storedEffect = registry.requireDefinition(effect.id)
    const storedOperations = getDeclarativeEffectOperations(storedEffect)

    expect(Object.isFrozen(storedOperations)).toBe(true)
    expect(Object.isFrozen(storedOperations[0])).toBe(true)
    expect(storedOperations).toEqual([
      {
        kind: 'adjust_check_count',
        check: 'drive',
        mode: 'add',
        amount: 1,
        subject: 'source_unit',
        duration: 'during_current_check',
      },
    ])
  })

  it('rejects unbounded declarative descriptors without operations', () => {
    expect(() =>
      defineEffectDefinition(
        makeDeclarativeCheckEffect('empty-declarative', []),
      ),
    ).toThrow(RulesInvariantError)
  })

  it('rejects invalid declarative operation payloads', () => {
    expect(() =>
      defineEffectDefinition(
        makeDeclarativeCheckEffect('zero-check-count', [
          {
            kind: 'adjust_check_count',
            check: 'drive',
            mode: 'add',
            amount: 0,
            subject: 'source_unit',
            duration: 'during_current_check',
          },
        ]),
      ),
    ).toThrow(RulesInvariantError)
  })

  it('lets keyword mechanics point to declarative and hybrid effect models without caring about internals', () => {
    const resolved =
      keywordMechanicsRegistry.resolveEffectDefinitionsForKeywords(
        [TWIN_DRIVE_KEYWORD, PERSONA_RIDE_KEYWORD],
        coreEffectRegistry,
        {
          formatId: STANDARD_FORMAT_ID,
        },
      )

    expect(resolved.map((entry) => entry.effectDefinition.id)).toEqual([
      TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY.id,
      PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY.id,
    ])
    expect(
      resolved.map((entry) =>
        getEffectRepresentationKind(entry.effectDefinition),
      ),
    ).toEqual(['declarative', 'hybrid'])
  })

  it('keeps typed effects procedural without forcing declarative payloads', () => {
    expect(getDeclarativeEffectOperations(BOOST_KEYWORD_EFFECT)).toEqual([])

    if (BOOST_KEYWORD_EFFECT.resolution.strategy.kind === 'typed_handler') {
      expect(BOOST_KEYWORD_EFFECT.resolution.strategy.handlerKey).toBe(
        createEffectHandlerKey('keyword.boost.commit'),
      )
      expect(BOOST_KEYWORD_EFFECT.resolution.strategy.family).toBe(
        'battle_action',
      )
    }
  })
})
