import type { Brand, FormatId, Keyword } from '@web-vg/shared'

import type { EffectDefinitionId } from '../contracts'
import { assertRulesInvariant } from '../errors'
import type { EventType, GameEvent } from '../events'
import type {
  EffectTimingPoint,
  EffectTimingWindow,
  TransitionTimingWindow,
} from '../transitions'

export type EffectNamespace = Brand<string, 'RulesEffectNamespace'>
export type EffectKey = Brand<string, 'RulesEffectKey'>
export type EffectTag = Brand<string, 'RulesEffectTag'>
export type EffectHandlerKey = Brand<string, 'RulesEffectHandlerKey'>
export type EffectDescriptorKey = Brand<string, 'RulesEffectDescriptorKey'>

export interface EffectIdentity {
  readonly namespace: EffectNamespace
  readonly key: EffectKey
  readonly id: EffectDefinitionId
}

export type EffectDefinitionReference = EffectDefinitionId | EffectIdentity

export type EffectKind =
  | 'triggered'
  | 'activated'
  | 'continuous'
  | 'replacement'

export type EffectResolutionModel =
  | 'automatic'
  | 'optional'
  | 'continuous'
  | 'replacement'

export interface EffectTimingBinding {
  readonly point: EffectTimingPoint
  readonly window: EffectTimingWindow
}

export interface EventEffectTrigger {
  readonly kind: 'event'
  readonly eventTypes: readonly EventType[]
}

export interface TimingEffectTrigger {
  readonly kind: 'timing'
  readonly points: readonly EffectTimingPoint[]
}

export interface ManualEffectTrigger {
  readonly kind: 'manual'
}

export interface StaticEffectTrigger {
  readonly kind: 'static'
}

export type EffectTrigger =
  | EventEffectTrigger
  | TimingEffectTrigger
  | ManualEffectTrigger
  | StaticEffectTrigger

export type EffectRepresentationKind = 'typed' | 'declarative' | 'hybrid'

export type EffectFamily =
  | 'auto_ability'
  | 'battle_action'
  | 'check_modifier'
  | 'ride'
  | 'trigger_resolution'
  | (string & {})

export type DeclarativeEffectSubject =
  | 'source_unit'
  | 'source_controller'
  | 'front_row_units'

export type DeclarativeEffectDuration =
  | 'immediate'
  | 'during_current_check'
  | 'until_end_of_turn'

export interface AdjustCheckCountOperation {
  readonly kind: 'adjust_check_count'
  readonly check: 'drive' | 'damage'
  readonly mode: 'add'
  readonly amount: number
  readonly subject: Extract<DeclarativeEffectSubject, 'source_unit'>
  readonly duration: Extract<DeclarativeEffectDuration, 'during_current_check'>
}

export interface DrawCardsOperation {
  readonly kind: 'draw_cards'
  readonly count: number
  readonly player: Extract<DeclarativeEffectSubject, 'source_controller'>
  readonly duration: Extract<DeclarativeEffectDuration, 'immediate'>
}

export interface ApplyPowerModifierOperation {
  readonly kind: 'apply_power_modifier'
  readonly amount: number
  readonly target: Extract<DeclarativeEffectSubject, 'front_row_units'>
  readonly duration: Extract<DeclarativeEffectDuration, 'until_end_of_turn'>
}

export type DeclarativeEffectOperation =
  | AdjustCheckCountOperation
  | DrawCardsOperation
  | ApplyPowerModifierOperation

export interface TypedEffectExecutionStrategy {
  readonly kind: 'typed_handler'
  readonly handlerKey: EffectHandlerKey
  readonly family?: EffectFamily
}

export interface DeclarativeEffectExecutionStrategy {
  readonly kind: 'declarative_descriptor'
  readonly descriptorKey: EffectDescriptorKey
  readonly operations: readonly DeclarativeEffectOperation[]
}

export interface HybridEffectExecutionStrategy {
  readonly kind: 'hybrid'
  readonly handlerKey: EffectHandlerKey
  readonly descriptorKey: EffectDescriptorKey
  readonly family?: EffectFamily
  readonly operations: readonly DeclarativeEffectOperation[]
}

export type EffectExecutionStrategy =
  | TypedEffectExecutionStrategy
  | DeclarativeEffectExecutionStrategy
  | HybridEffectExecutionStrategy

export interface EffectResolutionDescriptor {
  readonly model: EffectResolutionModel
  readonly strategy: EffectExecutionStrategy
}

export type EffectApplicabilityScope = 'global' | 'format' | 'card' | 'keyword'

export interface EffectApplicability {
  readonly scope: EffectApplicabilityScope
  readonly formatIds?: readonly FormatId[]
}

export interface EffectDefinition {
  readonly id: EffectDefinitionId
  readonly identity: EffectIdentity
  readonly kind: EffectKind
  readonly trigger: EffectTrigger
  readonly timing: readonly EffectTimingBinding[]
  readonly applicability: EffectApplicability
  readonly resolution: EffectResolutionDescriptor
  readonly keywords?: readonly Keyword[]
  readonly tags?: readonly EffectTag[]
}

export type TypedEffectDefinition = EffectDefinition & {
  readonly resolution: EffectResolutionDescriptor & {
    readonly strategy: TypedEffectExecutionStrategy
  }
}

export type DeclarativeEffectDefinition = EffectDefinition & {
  readonly resolution: EffectResolutionDescriptor & {
    readonly strategy: DeclarativeEffectExecutionStrategy
  }
}

export type HybridEffectDefinition = EffectDefinition & {
  readonly resolution: EffectResolutionDescriptor & {
    readonly strategy: HybridEffectExecutionStrategy
  }
}

const EFFECT_ID_PREFIX = 'effect'
const EFFECT_ID_SEGMENT_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/

export function createEffectIdentity(
  namespace: string,
  key: string,
): EffectIdentity {
  assertEffectIdSegment(namespace, 'Effect namespace')
  assertEffectIdSegment(key, 'Effect key')

  const typedNamespace = namespace as EffectNamespace
  const typedKey = key as EffectKey
  const id =
    `${EFFECT_ID_PREFIX}:${typedNamespace}:${typedKey}` as EffectDefinitionId

  return Object.freeze({
    namespace: typedNamespace,
    key: typedKey,
    id,
  })
}

export function createEffectHandlerKey(value: string): EffectHandlerKey {
  assertEffectIdSegment(value, 'Effect handler key')

  return value as EffectHandlerKey
}

export function createEffectDescriptorKey(value: string): EffectDescriptorKey {
  assertEffectIdSegment(value, 'Effect descriptor key')

  return value as EffectDescriptorKey
}

export function createEffectTag(value: string): EffectTag {
  assertEffectIdSegment(value, 'Effect tag')

  return value as EffectTag
}

export function createEffectTimingBinding(
  point: EffectTimingPoint,
  window: EffectTimingWindow,
): EffectTimingBinding {
  return Object.freeze({
    point,
    window,
  })
}

export function resolveEffectDefinitionId(
  reference: EffectDefinitionReference,
): EffectDefinitionId {
  return typeof reference === 'string' ? reference : reference.id
}

export function defineEffectDefinition(
  definition: EffectDefinition,
): EffectDefinition {
  assertEffectIdentity(definition.identity)
  assertRulesInvariant(
    definition.id === definition.identity.id,
    `Effect definition ${definition.id} must use the id derived from its identity descriptor.`,
  )
  assertTriggerInvariant(definition)
  assertTimingInvariant(definition)
  assertApplicabilityInvariant(definition)
  assertResolutionInvariant(definition)

  const normalized: EffectDefinition = {
    id: definition.id,
    identity: definition.identity,
    kind: definition.kind,
    trigger: normalizeTrigger(definition.trigger),
    timing: freezeArray(definition.timing.map(normalizeTimingBinding)),
    applicability: normalizeApplicability(definition.applicability),
    resolution: normalizeResolution(definition.resolution),
    ...(definition.keywords === undefined
      ? {}
      : {
          keywords: freezeArray(definition.keywords),
        }),
    ...(definition.tags === undefined
      ? {}
      : {
          tags: freezeArray(definition.tags),
        }),
  }

  return Object.freeze(normalized)
}

export function effectDefinitionMatchesEvent(
  definition: EffectDefinition,
  event: GameEvent | EventType,
): boolean {
  if (definition.trigger.kind !== 'event') {
    return false
  }

  const eventType = typeof event === 'string' ? event : event.type

  return definition.trigger.eventTypes.includes(eventType)
}

export function effectDefinitionMatchesTimingWindow(
  definition: EffectDefinition,
  timingWindow: TransitionTimingWindow | EffectTimingBinding,
): boolean {
  return definition.timing.some(
    (binding) =>
      binding.point === timingWindow.point &&
      binding.window === timingWindow.window,
  )
}

export function getEffectRepresentationKind(
  definition: EffectDefinition,
): EffectRepresentationKind {
  switch (definition.resolution.strategy.kind) {
    case 'typed_handler':
      return 'typed'
    case 'declarative_descriptor':
      return 'declarative'
    case 'hybrid':
      return 'hybrid'
  }
}

export function isTypedEffectDefinition(
  definition: EffectDefinition,
): definition is TypedEffectDefinition {
  return definition.resolution.strategy.kind === 'typed_handler'
}

export function isDeclarativeEffectDefinition(
  definition: EffectDefinition,
): definition is DeclarativeEffectDefinition {
  return definition.resolution.strategy.kind === 'declarative_descriptor'
}

export function isHybridEffectDefinition(
  definition: EffectDefinition,
): definition is HybridEffectDefinition {
  return definition.resolution.strategy.kind === 'hybrid'
}

export function getDeclarativeEffectOperations(
  definition: EffectDefinition,
): readonly DeclarativeEffectOperation[] {
  switch (definition.resolution.strategy.kind) {
    case 'typed_handler':
      return []
    case 'declarative_descriptor':
    case 'hybrid':
      return definition.resolution.strategy.operations
  }
}

function assertEffectIdentity(identity: EffectIdentity): void {
  assertEffectIdSegment(identity.namespace, 'Effect namespace')
  assertEffectIdSegment(identity.key, 'Effect key')
  assertRulesInvariant(
    identity.id ===
      (`${EFFECT_ID_PREFIX}:${identity.namespace}:${identity.key}` as EffectDefinitionId),
    `Effect identity ${identity.namespace}:${identity.key} must derive a stable effect id.`,
  )
}

function assertEffectIdSegment(value: string, label: string): void {
  assertRulesInvariant(
    EFFECT_ID_SEGMENT_PATTERN.test(value),
    `${label} must be a lowercase structured key segment.`,
  )
}

function assertTriggerInvariant(definition: EffectDefinition): void {
  switch (definition.trigger.kind) {
    case 'event':
      assertRulesInvariant(
        definition.trigger.eventTypes.length > 0,
        `Effect definition ${definition.id} must declare at least one event type for event triggers.`,
      )
      assertUniqueValues(
        definition.trigger.eventTypes,
        `Effect definition ${definition.id} must not repeat event trigger types.`,
      )
      return
    case 'timing':
      assertRulesInvariant(
        definition.trigger.points.length > 0,
        `Effect definition ${definition.id} must declare at least one timing point for timing triggers.`,
      )
      assertUniqueValues(
        definition.trigger.points,
        `Effect definition ${definition.id} must not repeat timing trigger points.`,
      )
      return
    case 'manual':
    case 'static':
      return
  }
}

function assertTimingInvariant(definition: EffectDefinition): void {
  assertUniqueValues(
    definition.timing.map((binding) => `${binding.point}:${binding.window}`),
    `Effect definition ${definition.id} must not repeat timing bindings.`,
  )
}

function assertApplicabilityInvariant(definition: EffectDefinition): void {
  if (definition.applicability.formatIds !== undefined) {
    assertUniqueValues(
      definition.applicability.formatIds,
      `Effect definition ${definition.id} must not repeat format applicability ids.`,
    )
  }
}

function assertResolutionInvariant(definition: EffectDefinition): void {
  const { strategy } = definition.resolution

  switch (strategy.kind) {
    case 'typed_handler':
      assertEffectIdSegment(strategy.handlerKey, 'Effect handler key')
      return
    case 'declarative_descriptor':
      assertEffectIdSegment(strategy.descriptorKey, 'Effect descriptor key')
      assertDeclarativeOperationsInvariant(definition)
      return
    case 'hybrid':
      assertEffectIdSegment(strategy.handlerKey, 'Effect handler key')
      assertEffectIdSegment(strategy.descriptorKey, 'Effect descriptor key')
      assertDeclarativeOperationsInvariant(definition)
      return
  }
}

function assertDeclarativeOperationsInvariant(
  definition: EffectDefinition,
): void {
  const operations = getDeclarativeEffectOperations(definition)

  assertRulesInvariant(
    operations.length > 0,
    `Effect definition ${definition.id} must declare at least one declarative operation.`,
  )

  for (const operation of operations) {
    assertDeclarativeOperationInvariant(definition, operation)
  }
}

function assertDeclarativeOperationInvariant(
  definition: EffectDefinition,
  operation: DeclarativeEffectOperation,
): void {
  switch (operation.kind) {
    case 'adjust_check_count':
      assertSafeNonZeroInteger(
        operation.amount,
        `Effect definition ${definition.id} adjust_check_count amount`,
      )
      return
    case 'draw_cards':
      assertRulesInvariant(
        Number.isSafeInteger(operation.count) && operation.count > 0,
        `Effect definition ${definition.id} draw_cards count must be a positive safe integer.`,
      )
      return
    case 'apply_power_modifier':
      assertSafeNonZeroInteger(
        operation.amount,
        `Effect definition ${definition.id} apply_power_modifier amount`,
      )
      return
  }
}

function normalizeTrigger(trigger: EffectTrigger): EffectTrigger {
  switch (trigger.kind) {
    case 'event':
      return Object.freeze({
        kind: trigger.kind,
        eventTypes: freezeArray(trigger.eventTypes),
      })
    case 'timing':
      return Object.freeze({
        kind: trigger.kind,
        points: freezeArray(trigger.points),
      })
    case 'manual':
    case 'static':
      return Object.freeze({
        kind: trigger.kind,
      })
  }
}

function normalizeTimingBinding(
  binding: EffectTimingBinding,
): EffectTimingBinding {
  return createEffectTimingBinding(binding.point, binding.window)
}

function normalizeApplicability(
  applicability: EffectApplicability,
): EffectApplicability {
  return Object.freeze({
    scope: applicability.scope,
    ...(applicability.formatIds === undefined
      ? {}
      : {
          formatIds: freezeArray(applicability.formatIds),
        }),
  })
}

function normalizeResolution(
  resolution: EffectResolutionDescriptor,
): EffectResolutionDescriptor {
  return Object.freeze({
    model: resolution.model,
    strategy: normalizeExecutionStrategy(resolution.strategy),
  })
}

function normalizeExecutionStrategy(
  strategy: EffectExecutionStrategy,
): EffectExecutionStrategy {
  switch (strategy.kind) {
    case 'typed_handler':
      return Object.freeze({ ...strategy })
    case 'declarative_descriptor':
      return Object.freeze({
        ...strategy,
        operations: freezeArray(
          strategy.operations.map(normalizeDeclarativeOperation),
        ),
      })
    case 'hybrid':
      return Object.freeze({
        ...strategy,
        operations: freezeArray(
          strategy.operations.map(normalizeDeclarativeOperation),
        ),
      })
  }
}

function normalizeDeclarativeOperation(
  operation: DeclarativeEffectOperation,
): DeclarativeEffectOperation {
  return Object.freeze({ ...operation })
}

function assertSafeNonZeroInteger(value: number, label: string): void {
  assertRulesInvariant(
    Number.isSafeInteger(value) && value !== 0,
    `${label} must be a non-zero safe integer.`,
  )
}

function assertUniqueValues(values: readonly string[], message: string): void {
  assertRulesInvariant(new Set(values).size === values.length, message)
}

function freezeArray<TValue>(values: readonly TValue[]): readonly TValue[] {
  return Object.freeze([...values])
}
