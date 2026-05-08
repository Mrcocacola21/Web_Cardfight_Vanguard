import type { FormatId } from '@web-vg/shared'
import { describe, expect, it } from 'vitest'

import { RulesInvariantError } from '../errors'
import {
  BOOST_KEYWORD_EFFECT,
  BOOST_KEYWORD_EFFECT_IDENTITY,
  INTERCEPT_KEYWORD_EFFECT_IDENTITY,
  PERSONA_RIDE_KEYWORD_EFFECT,
  TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY,
  coreEffectRegistry,
  createEffectRegistry,
} from '../effects'

import {
  BOOST_KEYWORD,
  INTERCEPT_KEYWORD,
  PERSONA_RIDE_KEYWORD,
  SAMPLE_KEYWORD_MECHANICS,
  TWIN_DRIVE_KEYWORD,
  createKeyword,
  createKeywordMechanicId,
  createKeywordMechanicReference,
  createKeywordMechanicsRegistry,
  defineKeywordMechanic,
  keywordMechanicsRegistry,
  type KeywordMechanicDefinition,
} from './index'

const STANDARD_FORMAT_ID = 'standard' as FormatId
const PREMIUM_FORMAT_ID = 'premium' as FormatId

function makeKeywordMechanic(key: string): KeywordMechanicDefinition {
  const keyword = createKeyword(key)

  return {
    id: createKeywordMechanicId(keyword),
    keyword,
    applicability: {
      scope: 'global',
    },
    bindings: [
      {
        kind: 'effect',
        effectDefinitionId: BOOST_KEYWORD_EFFECT_IDENTITY.id,
        role: 'grants_action',
      },
    ],
  }
}

function bindingEffectIds(
  bindings: readonly { readonly effectDefinitionId: string }[],
): readonly string[] {
  return bindings.map((binding) => binding.effectDefinitionId)
}

describe('@web-vg/rules-core keyword mechanics layer', () => {
  it('creates an empty mapping registry and registers keyword mechanics immutably', () => {
    const registry = createKeywordMechanicsRegistry()
    const mechanic = makeKeywordMechanic('sample-keyword')
    const nextRegistry = registry.register(mechanic)

    expect(registry.size).toBe(0)
    expect(nextRegistry.size).toBe(1)
    expect(nextRegistry.hasMechanic(mechanic.keyword)).toBe(true)
    expect(nextRegistry.hasMechanic({ keyword: mechanic.keyword })).toBe(true)
    expect(nextRegistry.requireMechanic(mechanic.keyword).id).toBe(mechanic.id)
  })

  it('rejects duplicate keyword mechanic registrations', () => {
    const mechanic = makeKeywordMechanic('duplicate-keyword')

    expect(() => createKeywordMechanicsRegistry([mechanic, mechanic])).toThrow(
      RulesInvariantError,
    )
  })

  it('rejects duplicate effect bindings under one keyword mechanic', () => {
    const keyword = createKeyword('duplicate-binding')

    expect(() =>
      defineKeywordMechanic({
        id: createKeywordMechanicId(keyword),
        keyword,
        applicability: {
          scope: 'global',
        },
        bindings: [
          {
            kind: 'effect',
            effectDefinitionId: BOOST_KEYWORD_EFFECT_IDENTITY.id,
            role: 'grants_action',
          },
          {
            kind: 'effect',
            effectDefinitionId: BOOST_KEYWORD_EFFECT_IDENTITY.id,
            role: 'grants_action',
          },
        ],
      }),
    ).toThrow(RulesInvariantError)
  })

  it('resolves stable keyword references to effect bindings', () => {
    expect(keywordMechanicsRegistry.size).toBe(SAMPLE_KEYWORD_MECHANICS.length)
    expect(
      bindingEffectIds(
        keywordMechanicsRegistry.findEffectBindings(BOOST_KEYWORD),
      ),
    ).toEqual([BOOST_KEYWORD_EFFECT_IDENTITY.id])
    expect(
      bindingEffectIds(
        keywordMechanicsRegistry.findEffectBindings(
          createKeywordMechanicReference(INTERCEPT_KEYWORD),
        ),
      ),
    ).toEqual([INTERCEPT_KEYWORD_EFFECT_IDENTITY.id])
  })

  it('allows one stable keyword to expose multiple effect bindings in order', () => {
    const keyword = createKeyword('multi-binding-keyword')
    const mechanic = defineKeywordMechanic({
      id: createKeywordMechanicId(keyword),
      keyword,
      applicability: {
        scope: 'global',
      },
      bindings: [
        {
          kind: 'effect',
          effectDefinitionId: BOOST_KEYWORD_EFFECT_IDENTITY.id,
          role: 'grants_action',
        },
        {
          kind: 'effect',
          effectDefinitionId: INTERCEPT_KEYWORD_EFFECT_IDENTITY.id,
          role: 'enables_guard_source',
        },
      ],
    })
    const registry = createKeywordMechanicsRegistry([mechanic])

    expect(bindingEffectIds(registry.findEffectBindings(keyword))).toEqual([
      BOOST_KEYWORD_EFFECT_IDENTITY.id,
      INTERCEPT_KEYWORD_EFFECT_IDENTITY.id,
    ])
  })

  it('returns empty results for unknown keyword references', () => {
    const unknownKeyword = createKeyword('unknown-keyword')

    expect(keywordMechanicsRegistry.hasMechanic(unknownKeyword)).toBe(false)
    expect(keywordMechanicsRegistry.findEffectBindings(unknownKeyword)).toEqual(
      [],
    )
    expect(
      keywordMechanicsRegistry.resolveEffectDefinitions(
        unknownKeyword,
        coreEffectRegistry,
      ),
    ).toEqual([])
  })

  it('bridges content keywords to registered effect definitions', () => {
    const resolved =
      keywordMechanicsRegistry.resolveEffectDefinitionsForKeywords(
        [BOOST_KEYWORD, TWIN_DRIVE_KEYWORD],
        coreEffectRegistry,
      )

    expect(resolved.map((entry) => entry.keyword)).toEqual([
      BOOST_KEYWORD,
      TWIN_DRIVE_KEYWORD,
    ])
    expect(resolved.map((entry) => entry.effectDefinition.id)).toEqual([
      BOOST_KEYWORD_EFFECT_IDENTITY.id,
      TWIN_DRIVE_KEYWORD_EFFECT_IDENTITY.id,
    ])
    expect(resolved[0]?.effectDefinition).toEqual(BOOST_KEYWORD_EFFECT)
  })

  it('uses format applicability without turning keyword mapping into an adapter', () => {
    expect(
      keywordMechanicsRegistry.findEffectBindings(PERSONA_RIDE_KEYWORD, {
        formatId: STANDARD_FORMAT_ID,
      }),
    ).toHaveLength(1)
    expect(
      keywordMechanicsRegistry.findEffectBindings(PERSONA_RIDE_KEYWORD, {
        formatId: PREMIUM_FORMAT_ID,
      }),
    ).toEqual([])

    const resolved = keywordMechanicsRegistry.resolveEffectDefinitions(
      PERSONA_RIDE_KEYWORD,
      coreEffectRegistry,
      {
        formatId: STANDARD_FORMAT_ID,
      },
    )

    expect(resolved[0]?.effectDefinition).toEqual(PERSONA_RIDE_KEYWORD_EFFECT)
  })

  it('keeps keyword mapping separate from effect registration', () => {
    expect(() =>
      keywordMechanicsRegistry.resolveEffectDefinitions(
        BOOST_KEYWORD,
        createEffectRegistry(),
      ),
    ).toThrow(RulesInvariantError)
  })
})
