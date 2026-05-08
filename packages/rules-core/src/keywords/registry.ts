import type { FormatId, Keyword } from '@web-vg/shared'

import { assertRulesInvariant } from '../errors'
import type { EffectDefinition, EffectRegistry } from '../effects'

import {
  defineKeywordMechanic,
  keywordMechanicAppliesToFormat,
  resolveKeywordBindingApplicability,
  resolveKeywordMechanicInput,
  type KeywordEffectBinding,
  type KeywordMechanicBinding,
  type KeywordMechanicDefinition,
  type KeywordMechanicInput,
} from './keyword'

export interface KeywordMechanicLookupOptions {
  readonly formatId?: FormatId
}

export interface ResolvedKeywordEffectBinding {
  readonly keyword: Keyword
  readonly mechanic: KeywordMechanicDefinition
  readonly binding: KeywordEffectBinding
  readonly effectDefinition: EffectDefinition
}

export class KeywordMechanicsRegistry {
  private readonly mechanicsByKeyword: ReadonlyMap<
    Keyword,
    KeywordMechanicDefinition
  >

  private readonly keywords: readonly Keyword[]

  constructor(
    mechanicsByKeyword: ReadonlyMap<
      Keyword,
      KeywordMechanicDefinition
    > = new Map(),
    keywords: readonly Keyword[] = [],
  ) {
    this.mechanicsByKeyword = mechanicsByKeyword
    this.keywords = keywords
  }

  get size(): number {
    return this.keywords.length
  }

  register(
    definitionInput: KeywordMechanicDefinition,
  ): KeywordMechanicsRegistry {
    const definition = defineKeywordMechanic(definitionInput)

    assertRulesInvariant(
      !this.mechanicsByKeyword.has(definition.keyword),
      `Keyword mechanic ${definition.keyword} is already registered.`,
    )

    const mechanicsByKeyword = new Map(this.mechanicsByKeyword)
    mechanicsByKeyword.set(definition.keyword, definition)

    return new KeywordMechanicsRegistry(mechanicsByKeyword, [
      ...this.keywords,
      definition.keyword,
    ])
  }

  hasMechanic(input: KeywordMechanicInput): boolean {
    return this.mechanicsByKeyword.has(resolveKeywordMechanicInput(input))
  }

  getMechanic(
    input: KeywordMechanicInput,
  ): KeywordMechanicDefinition | undefined {
    return this.mechanicsByKeyword.get(resolveKeywordMechanicInput(input))
  }

  requireMechanic(input: KeywordMechanicInput): KeywordMechanicDefinition {
    const keyword = resolveKeywordMechanicInput(input)
    const definition = this.mechanicsByKeyword.get(keyword)

    assertRulesInvariant(
      definition !== undefined,
      `Keyword mechanic ${keyword} is not registered.`,
    )

    return definition
  }

  listMechanics(): readonly KeywordMechanicDefinition[] {
    return this.keywords.map((keyword) => this.requireMechanic(keyword))
  }

  findEffectBindings(
    input: KeywordMechanicInput,
    options: KeywordMechanicLookupOptions = {},
  ): readonly KeywordEffectBinding[] {
    const definition = this.getMechanic(input)

    if (definition === undefined) {
      return []
    }

    return definition.bindings
      .filter(isEffectBinding)
      .filter((binding) =>
        keywordMechanicAppliesToFormat(
          resolveKeywordBindingApplicability(definition, binding),
          options.formatId,
        ),
      )
  }

  resolveEffectDefinitions(
    input: KeywordMechanicInput,
    effectRegistry: EffectRegistry,
    options: KeywordMechanicLookupOptions = {},
  ): readonly ResolvedKeywordEffectBinding[] {
    const mechanic = this.getMechanic(input)

    if (mechanic === undefined) {
      return []
    }

    return this.findEffectBindings(input, options).map((binding) => ({
      keyword: mechanic.keyword,
      mechanic,
      binding,
      effectDefinition: effectRegistry.requireDefinition(
        binding.effectDefinitionId,
      ),
    }))
  }

  resolveEffectDefinitionsForKeywords(
    inputs: readonly KeywordMechanicInput[],
    effectRegistry: EffectRegistry,
    options: KeywordMechanicLookupOptions = {},
  ): readonly ResolvedKeywordEffectBinding[] {
    const resolved: ResolvedKeywordEffectBinding[] = []

    for (const input of inputs) {
      resolved.push(
        ...this.resolveEffectDefinitions(input, effectRegistry, options),
      )
    }

    return resolved
  }
}

export function createKeywordMechanicsRegistry(
  definitions: readonly KeywordMechanicDefinition[] = [],
): KeywordMechanicsRegistry {
  return definitions.reduce(
    (registry, definition) => registry.register(definition),
    new KeywordMechanicsRegistry(),
  )
}

function isEffectBinding(
  binding: KeywordMechanicBinding,
): binding is KeywordEffectBinding {
  return binding.kind === 'effect'
}
