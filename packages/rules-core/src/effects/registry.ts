import type { EffectDefinitionId } from '../contracts'
import { assertRulesInvariant } from '../errors'
import type { EventType, GameEvent } from '../events'
import type { TransitionTimingWindow } from '../transitions'

import {
  defineEffectDefinition,
  effectDefinitionMatchesEvent,
  effectDefinitionMatchesTimingWindow,
  resolveEffectDefinitionId,
  type EffectDefinition,
  type EffectDefinitionReference,
  type EffectTimingBinding,
} from './effect'

export interface EffectRegistryLookupContext {
  readonly event?: GameEvent | EventType
  readonly timingWindow?: TransitionTimingWindow | EffectTimingBinding
}

export class EffectRegistry {
  private readonly definitionsById: ReadonlyMap<
    EffectDefinitionId,
    EffectDefinition
  >

  private readonly definitionIds: readonly EffectDefinitionId[]

  constructor(
    definitionsById: ReadonlyMap<
      EffectDefinitionId,
      EffectDefinition
    > = new Map(),
    definitionIds: readonly EffectDefinitionId[] = [],
  ) {
    this.definitionsById = definitionsById
    this.definitionIds = definitionIds
  }

  get size(): number {
    return this.definitionIds.length
  }

  register(definitionInput: EffectDefinition): EffectRegistry {
    const definition = defineEffectDefinition(definitionInput)

    assertRulesInvariant(
      !this.definitionsById.has(definition.id),
      `Effect definition ${definition.id} is already registered.`,
    )

    const definitionsById = new Map(this.definitionsById)
    definitionsById.set(definition.id, definition)

    return new EffectRegistry(definitionsById, [
      ...this.definitionIds,
      definition.id,
    ])
  }

  hasDefinition(reference: EffectDefinitionReference): boolean {
    return this.definitionsById.has(resolveEffectDefinitionId(reference))
  }

  getDefinition(
    reference: EffectDefinitionReference,
  ): EffectDefinition | undefined {
    return this.definitionsById.get(resolveEffectDefinitionId(reference))
  }

  requireDefinition(reference: EffectDefinitionReference): EffectDefinition {
    const id = resolveEffectDefinitionId(reference)
    const definition = this.definitionsById.get(id)

    assertRulesInvariant(
      definition !== undefined,
      `Effect definition ${id} is not registered.`,
    )

    return definition
  }

  listDefinitions(): readonly EffectDefinition[] {
    return this.definitionIds.map((id) => this.requireDefinition(id))
  }

  findDefinitionsByEvent(
    event: GameEvent | EventType,
  ): readonly EffectDefinition[] {
    return this.listDefinitions().filter((definition) =>
      effectDefinitionMatchesEvent(definition, event),
    )
  }

  findDefinitionsByTimingWindow(
    timingWindow: TransitionTimingWindow | EffectTimingBinding,
  ): readonly EffectDefinition[] {
    return this.listDefinitions().filter((definition) =>
      effectDefinitionMatchesTimingWindow(definition, timingWindow),
    )
  }

  findCandidateDefinitions(
    context: EffectRegistryLookupContext,
  ): readonly EffectDefinition[] {
    const candidateIds = new Set<EffectDefinitionId>()

    if (context.event !== undefined) {
      for (const definition of this.findDefinitionsByEvent(context.event)) {
        candidateIds.add(definition.id)
      }
    }

    if (context.timingWindow !== undefined) {
      for (const definition of this.findDefinitionsByTimingWindow(
        context.timingWindow,
      )) {
        candidateIds.add(definition.id)
      }
    }

    return this.definitionIds
      .filter((id) => candidateIds.has(id))
      .map((id) => this.requireDefinition(id))
  }
}

export function createEffectRegistry(
  definitions: readonly EffectDefinition[] = [],
): EffectRegistry {
  return definitions.reduce(
    (registry, definition) => registry.register(definition),
    new EffectRegistry(),
  )
}
