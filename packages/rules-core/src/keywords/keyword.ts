import type { Brand, FormatId, Keyword } from '@web-vg/shared'

import type { EffectDefinitionId } from '../contracts'
import { assertRulesInvariant } from '../errors'
import type { EffectTimingBinding } from '../effects'

export type KeywordMechanicId = Brand<string, 'RulesKeywordMechanicId'>
export type KeywordMechanicTag = Brand<string, 'RulesKeywordMechanicTag'>

export interface KeywordMechanicReference {
  readonly keyword: Keyword
}

export type KeywordMechanicInput = Keyword | KeywordMechanicReference

export type KeywordMechanicApplicabilityScope = 'global' | 'format'

export interface KeywordMechanicApplicability {
  readonly scope: KeywordMechanicApplicabilityScope
  readonly formatIds?: readonly FormatId[]
}

export type KeywordMechanicEffectRole =
  | 'grants_action'
  | 'enables_guard_source'
  | 'modifies_check'
  | 'triggers_resolution'

export interface KeywordEffectBinding {
  readonly kind: 'effect'
  readonly effectDefinitionId: EffectDefinitionId
  readonly role: KeywordMechanicEffectRole
  readonly timing?: readonly EffectTimingBinding[]
  readonly applicability?: KeywordMechanicApplicability
}

export type KeywordMechanicBinding = KeywordEffectBinding

export interface KeywordMechanicDefinition {
  readonly id: KeywordMechanicId
  readonly keyword: Keyword
  readonly applicability: KeywordMechanicApplicability
  readonly bindings: readonly KeywordMechanicBinding[]
  readonly tags?: readonly KeywordMechanicTag[]
}

const KEYWORD_MECHANIC_ID_PREFIX = 'keyword'
const KEYWORD_SEGMENT_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/

export function createKeyword(value: string): Keyword {
  assertKeywordSegment(value, 'Keyword')

  return value as Keyword
}

export function createKeywordMechanicReference(
  value: string | Keyword,
): KeywordMechanicReference {
  const keyword = typeof value === 'string' ? createKeyword(value) : value

  assertKeywordSegment(keyword, 'Keyword')

  return Object.freeze({
    keyword,
  })
}

export function createKeywordMechanicId(keyword: Keyword): KeywordMechanicId {
  assertKeywordSegment(keyword, 'Keyword')

  return `${KEYWORD_MECHANIC_ID_PREFIX}:${keyword}` as KeywordMechanicId
}

export function createKeywordMechanicTag(value: string): KeywordMechanicTag {
  assertKeywordSegment(value, 'Keyword mechanic tag')

  return value as KeywordMechanicTag
}

export function resolveKeywordMechanicInput(
  input: KeywordMechanicInput,
): Keyword {
  return typeof input === 'string' ? input : input.keyword
}

export function defineKeywordMechanic(
  definition: KeywordMechanicDefinition,
): KeywordMechanicDefinition {
  assertKeywordSegment(definition.keyword, 'Keyword')
  assertRulesInvariant(
    definition.id === createKeywordMechanicId(definition.keyword),
    `Keyword mechanic ${definition.id} must use the id derived from its keyword.`,
  )
  assertApplicabilityInvariant(definition.applicability, definition.keyword)
  assertRulesInvariant(
    definition.bindings.length > 0,
    `Keyword mechanic ${definition.keyword} must declare at least one binding.`,
  )
  assertUniqueValues(
    definition.bindings.map((binding) => binding.effectDefinitionId),
    `Keyword mechanic ${definition.keyword} must not repeat effect bindings.`,
  )

  const normalized: KeywordMechanicDefinition = {
    id: definition.id,
    keyword: definition.keyword,
    applicability: normalizeApplicability(definition.applicability),
    bindings: freezeArray(definition.bindings.map(normalizeBinding)),
    ...(definition.tags === undefined
      ? {}
      : {
          tags: freezeArray(definition.tags),
        }),
  }

  return Object.freeze(normalized)
}

export function keywordMechanicAppliesToFormat(
  applicability: KeywordMechanicApplicability,
  formatId: FormatId | undefined,
): boolean {
  if (formatId === undefined) {
    return true
  }

  if (applicability.scope === 'global') {
    return true
  }

  return applicability.formatIds?.includes(formatId) ?? false
}

export function resolveKeywordBindingApplicability(
  definition: KeywordMechanicDefinition,
  binding: KeywordMechanicBinding,
): KeywordMechanicApplicability {
  return binding.applicability ?? definition.applicability
}

function normalizeBinding(
  binding: KeywordMechanicBinding,
): KeywordMechanicBinding {
  return Object.freeze({
    kind: binding.kind,
    effectDefinitionId: binding.effectDefinitionId,
    role: binding.role,
    ...(binding.timing === undefined
      ? {}
      : {
          timing: freezeArray(binding.timing),
        }),
    ...(binding.applicability === undefined
      ? {}
      : {
          applicability: normalizeApplicability(binding.applicability),
        }),
  })
}

function normalizeApplicability(
  applicability: KeywordMechanicApplicability,
): KeywordMechanicApplicability {
  assertApplicabilityInvariant(applicability)

  return Object.freeze({
    scope: applicability.scope,
    ...(applicability.formatIds === undefined
      ? {}
      : {
          formatIds: freezeArray(applicability.formatIds),
        }),
  })
}

function assertApplicabilityInvariant(
  applicability: KeywordMechanicApplicability,
  keyword?: Keyword,
): void {
  const label =
    keyword === undefined
      ? 'Keyword mechanic applicability'
      : `Keyword mechanic ${keyword} applicability`

  if (applicability.scope === 'global') {
    assertRulesInvariant(
      applicability.formatIds === undefined,
      `${label} must not declare format ids for global scope.`,
    )
    return
  }

  assertRulesInvariant(
    applicability.formatIds !== undefined && applicability.formatIds.length > 0,
    `${label} must declare at least one format id for format scope.`,
  )
  assertUniqueValues(
    applicability.formatIds,
    `${label} must not repeat format ids.`,
  )
}

function assertKeywordSegment(value: string, label: string): void {
  assertRulesInvariant(
    KEYWORD_SEGMENT_PATTERN.test(value),
    `${label} must be a lowercase structured key segment.`,
  )
}

function assertUniqueValues(values: readonly string[], message: string): void {
  assertRulesInvariant(new Set(values).size === values.length, message)
}

function freezeArray<TValue>(values: readonly TValue[]): readonly TValue[] {
  return Object.freeze([...values])
}
