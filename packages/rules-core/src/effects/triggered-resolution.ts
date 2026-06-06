import type { PieceId, TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type { GameState } from '../state'
import { buildGameStateIndex, findPieceById } from '../state'
import type {
  AppliedTransitionResult,
  TransitionResult,
  TransitionTimingWindow,
} from '../transitions/transition'
import {
  createInvalidTransitionResult,
  createTransitionResult,
} from '../transitions/transition'
import { type KeywordMechanicsRegistry } from '../keywords/registry'
import { keywordMechanicsRegistry } from '../keywords/samples'

import {
  effectDefinitionMatchesEvent,
  effectDefinitionMatchesTimingWindow,
  type EffectDefinition,
} from './effect'
import { coreEffectHandlerRegistry } from './core-handlers'
import type { EffectHandlerRegistry } from './handler-registry'
import { type EffectRegistry } from './registry'
import { resolveEffectRuntimeQueueItem } from './runtime-dispatch'
import { coreEffectRegistry } from './samples'
import {
  compareEffectResolutionQueueItemSeeds,
  createEffectResolutionQueue,
  dequeueEffectResolutionQueueItem,
  enqueueEffectResolutionQueueItems,
  hasQueuedEffectResolutionItems,
  type EffectResolutionQueueItem,
  type EffectResolutionQueueItemSeed,
  type EffectResolutionSourceKind,
} from './resolution-queue'

export type TriggeredEffectSourceKind = EffectResolutionSourceKind

export interface EventTriggeredResolutionEnvironment {
  readonly effectRegistry: EffectRegistry
  readonly effectHandlers?: EffectHandlerRegistry
  readonly keywordMechanics: KeywordMechanicsRegistry
}

export type TriggeredEffectCandidate = EffectResolutionQueueItemSeed

export interface EventTriggeredResolutionInput {
  readonly currentState: GameState
  readonly result: TransitionResult
  readonly environment?: EventTriggeredResolutionEnvironment
}

type TriggeredEffectExecutionResult =
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

const DEFAULT_TRIGGERED_RESOLUTION_ENVIRONMENT: EventTriggeredResolutionEnvironment =
  {
    effectRegistry: coreEffectRegistry,
    effectHandlers: coreEffectHandlerRegistry,
    keywordMechanics: keywordMechanicsRegistry,
  }

export function resolveEventTriggeredEffects(
  input: EventTriggeredResolutionInput,
): TransitionResult {
  if (input.result.status !== 'applied') {
    return input.result
  }

  const environment =
    input.environment ?? DEFAULT_TRIGGERED_RESOLUTION_ENVIRONMENT
  const candidates = collectEventTriggeredEffectCandidates(
    input.result,
    environment,
  )

  if (candidates.length === 0) {
    return input.result
  }

  let workingState = input.result.nextState
  let queue = createEffectResolutionQueue({
    transitionId: input.result.transitionId,
    seeds: candidates,
  })
  const events: GameEvent[] = [...input.result.events]
  const timingWindows: TransitionTimingWindow[] = [
    ...input.result.timingWindows,
  ]

  while (hasQueuedEffectResolutionItems(queue)) {
    const dequeued = dequeueEffectResolutionQueueItem(queue)
    const queueItem = dequeued.item
    queue = dequeued.queue

    if (queueItem === undefined) {
      break
    }

    const executionResult = resolveTriggeredEffectQueueItem(workingState, {
      queueItem,
      transitionId: input.result.transitionId,
      startingSequence: events.length,
      startingTimingWindowSequence:
        resolveNextTimingWindowSequence(timingWindows),
      effectHandlers: environment.effectHandlers ?? coreEffectHandlerRegistry,
    })

    if (!executionResult.ok) {
      return createInvalidTransitionResult(
        input.result.transitionId,
        input.currentState,
        executionResult.code,
        executionResult.message,
        {
          inputKind: input.result.inputKind,
        },
      )
    }

    workingState = executionResult.state
    events.push(...executionResult.events)
    timingWindows.push(...executionResult.timingWindows)

    if (
      workingState.status === 'completed' ||
      workingState.status === 'awaiting_choice'
    ) {
      break
    }

    const nestedCandidates = collectEventTriggeredEffectCandidatesFromSources(
      workingState,
      collectTriggerSourcesFromEventsAndTimingWindows(
        executionResult.events,
        executionResult.timingWindows,
      ),
      environment,
    )
    queue = enqueueEffectResolutionQueueItems(queue, {
      transitionId: input.result.transitionId,
      seeds: nestedCandidates,
      parentItem: queueItem,
    })
  }

  if (
    events.length === input.result.events.length &&
    timingWindows.length === input.result.timingWindows.length &&
    workingState === input.result.nextState
  ) {
    return input.result
  }

  return createTransitionResult(
    input.result.transitionId,
    workingState,
    events,
    {
      inputKind: input.result.inputKind,
      timingWindows,
    },
  )
}

export function collectEventTriggeredEffectCandidates(
  result: AppliedTransitionResult,
  environment: EventTriggeredResolutionEnvironment = DEFAULT_TRIGGERED_RESOLUTION_ENVIRONMENT,
): readonly TriggeredEffectCandidate[] {
  return collectEventTriggeredEffectCandidatesFromSources(
    result.nextState,
    collectTriggerSourcesFromEventsAndTimingWindows(
      result.events,
      result.timingWindows,
    ),
    environment,
  )
}

function collectEventTriggeredEffectCandidatesFromSources(
  state: GameState,
  triggerSources: readonly {
    readonly event: GameEvent
    readonly timingWindow: TransitionTimingWindow
  }[],
  environment: EventTriggeredResolutionEnvironment,
): readonly TriggeredEffectCandidate[] {
  const candidates: TriggeredEffectCandidate[] = []
  const seen = new Set<string>()

  for (const triggerSource of triggerSources) {
    for (const candidate of collectDirectEffectCandidates(
      state,
      triggerSource,
      environment,
    )) {
      pushUniqueCandidate(candidates, seen, candidate)
    }

    for (const candidate of collectKeywordEffectCandidates(
      state,
      triggerSource,
      environment,
    )) {
      pushUniqueCandidate(candidates, seen, candidate)
    }
  }

  return candidates.sort(compareEffectResolutionQueueItemSeeds)
}

function collectTriggerSourcesFromEventsAndTimingWindows(
  events: readonly GameEvent[],
  timingWindows: readonly TransitionTimingWindow[],
): readonly {
  readonly event: GameEvent
  readonly timingWindow: TransitionTimingWindow
}[] {
  return events.flatMap((event) =>
    timingWindows
      .filter(
        (timingWindow) => timingWindow.relatedEventSequence === event.sequence,
      )
      .map((timingWindow) => ({
        event,
        timingWindow,
      })),
  )
}

function collectDirectEffectCandidates(
  state: GameState,
  triggerSource: {
    readonly event: GameEvent
    readonly timingWindow: TransitionTimingWindow
  },
  environment: EventTriggeredResolutionEnvironment,
): readonly TriggeredEffectCandidate[] {
  return environment.effectRegistry
    .listDefinitions()
    .filter((definition) => definition.applicability.scope === 'global')
    .filter((definition) => isCurrentlyResolvableTriggeredEffect(definition))
    .filter((definition) => effectDefinitionAppliesToState(definition, state))
    .filter(
      (definition) =>
        effectDefinitionMatchesEvent(definition, triggerSource.event) &&
        effectDefinitionMatchesTimingWindow(
          definition,
          triggerSource.timingWindow,
        ),
    )
    .map((effectDefinition) => {
      const sourcePieceId = resolveTriggerSourcePieceIds(triggerSource.event)[0]

      return {
        sourceKind: 'direct' as const,
        triggerEvent: triggerSource.event,
        timingWindow: triggerSource.timingWindow,
        effectDefinition,
        ...(sourcePieceId === undefined ? {} : { sourcePieceId }),
      }
    })
}

function collectKeywordEffectCandidates(
  state: GameState,
  triggerSource: {
    readonly event: GameEvent
    readonly timingWindow: TransitionTimingWindow
  },
  environment: EventTriggeredResolutionEnvironment,
): readonly TriggeredEffectCandidate[] {
  const stateIndex = buildGameStateIndex(state)

  return resolveTriggerSourcePieceIds(triggerSource.event).flatMap(
    (sourcePieceId) => {
      const sourcePiece = findPieceById(stateIndex, sourcePieceId)

      if (sourcePiece?.keywords === undefined) {
        return []
      }

      return environment.keywordMechanics
        .resolveEffectDefinitionsForKeywords(
          sourcePiece.keywords,
          environment.effectRegistry,
          {
            formatId: state.formatId,
          },
        )
        .map((resolved) => resolved.effectDefinition)
        .filter((definition) =>
          isCurrentlyResolvableTriggeredEffect(definition),
        )
        .filter((definition) =>
          effectDefinitionAppliesToState(definition, state),
        )
        .filter(
          (definition) =>
            effectDefinitionMatchesEvent(definition, triggerSource.event) &&
            effectDefinitionMatchesTimingWindow(
              definition,
              triggerSource.timingWindow,
            ),
        )
        .map((effectDefinition) => ({
          sourceKind: 'keyword' as const,
          triggerEvent: triggerSource.event,
          timingWindow: triggerSource.timingWindow,
          effectDefinition,
          sourcePieceId,
        }))
    },
  )
}

function resolveTriggeredEffectQueueItem(
  state: GameState,
  input: {
    readonly queueItem: EffectResolutionQueueItem
    readonly transitionId: TransitionId
    readonly startingSequence: number
    readonly startingTimingWindowSequence: number
    readonly effectHandlers: EffectHandlerRegistry
  },
): TriggeredEffectExecutionResult {
  return resolveEffectRuntimeQueueItem({
    currentState: state,
    queueItem: input.queueItem,
    transitionId: input.transitionId,
    startingSequence: input.startingSequence,
    startingTimingWindowSequence: input.startingTimingWindowSequence,
    effectHandlers: input.effectHandlers,
  })
}

function resolveNextTimingWindowSequence(
  timingWindows: readonly TransitionTimingWindow[],
): number {
  return timingWindows.length === 0
    ? 0
    : Math.max(...timingWindows.map((timingWindow) => timingWindow.sequence)) +
        1
}

function resolveTriggerSourcePieceIds(event: GameEvent): readonly PieceId[] {
  switch (event.type) {
    case 'card.rode':
    case 'card.called':
    case 'card.played':
      return [event.pieceId]
    case 'battle.attack_declared':
      return [event.attackerPieceId]
    case 'battle.boost_declared':
      return [event.boosterPieceId]
    case 'battle.guard_declared':
      return event.guardianPieceIds
    default:
      return []
  }
}

function isCurrentlyResolvableTriggeredEffect(
  definition: EffectDefinition,
): boolean {
  return definition.resolution.model === 'automatic'
}

function effectDefinitionAppliesToState(
  definition: EffectDefinition,
  state: GameState,
): boolean {
  return (
    definition.applicability.formatIds === undefined ||
    definition.applicability.formatIds.includes(state.formatId)
  )
}

function pushUniqueCandidate(
  candidates: TriggeredEffectCandidate[],
  seen: Set<string>,
  candidate: TriggeredEffectCandidate,
): void {
  const key = [
    candidate.triggerEvent.sequence,
    candidate.timingWindow.sequence,
    candidate.sourceKind,
    candidate.sourcePieceId ?? '',
    candidate.effectDefinition.id,
  ].join('|')

  if (seen.has(key)) {
    return
  }

  seen.add(key)
  candidates.push(candidate)
}
