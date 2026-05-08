import type { ActionId, EventId, PieceId, TransitionId } from '../contracts'
import type { EffectResolvedEvent, GameEvent } from '../events'
import type { GameState } from '../state'
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
import {
  CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY,
  CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY,
  PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY,
  coreEffectRegistry,
} from './samples'
import { type EffectRegistry } from './registry'
import { resolvePersonaRideEffect } from './first-effects'
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

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const

export type TriggeredEffectSourceKind = EffectResolutionSourceKind

export interface EventTriggeredResolutionEnvironment {
  readonly effectRegistry: EffectRegistry
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
    .map((effectDefinition) => ({
      sourceKind: 'direct' as const,
      triggerEvent: triggerSource.event,
      timingWindow: triggerSource.timingWindow,
      effectDefinition,
    }))
}

function collectKeywordEffectCandidates(
  state: GameState,
  triggerSource: {
    readonly event: GameEvent
    readonly timingWindow: TransitionTimingWindow
  },
  environment: EventTriggeredResolutionEnvironment,
): readonly TriggeredEffectCandidate[] {
  return resolveTriggerSourcePieceIds(triggerSource.event).flatMap(
    (sourcePieceId) => {
      const sourcePiece = state.pieces.find(
        (piece) => piece.pieceId === sourcePieceId,
      )

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
  },
): TriggeredEffectExecutionResult {
  const { queueItem } = input

  if (
    queueItem.effectDefinition.id === PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY.id &&
    queueItem.triggerEvent.type === 'card.rode' &&
    queueItem.triggerEvent.sourceActionId !== undefined
  ) {
    const result = resolvePersonaRideEffect({
      currentState: state,
      transitionId: input.transitionId,
      sourceActionId: queueItem.triggerEvent.sourceActionId,
      rideEvent: queueItem.triggerEvent,
      effectDefinition: queueItem.effectDefinition,
      startingSequence: input.startingSequence,
    })

    return result.ok
      ? {
          ...result,
          timingWindows: createNestedTimingWindowsForEffectEvents(
            result.events,
            input.startingTimingWindowSequence,
          ),
        }
      : result
  }

  if (
    queueItem.effectDefinition.id === CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id &&
    (queueItem.triggerEvent.type === 'battle.drive_checked' ||
      queueItem.triggerEvent.type === 'battle.damage_checked')
  ) {
    return resolveCheckTriggerRevealEffect(state, {
      transitionId: input.transitionId,
      triggerEvent: queueItem.triggerEvent,
      effectDefinition: queueItem.effectDefinition,
      startingSequence: input.startingSequence,
      ...(queueItem.triggerEvent.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: queueItem.triggerEvent.sourceActionId,
          }),
    })
  }

  if (
    queueItem.effectDefinition.id === CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY.id &&
    queueItem.triggerEvent.type === 'cards.drawn'
  ) {
    return resolveCardsDrawnFinalizeEffect(state, {
      transitionId: input.transitionId,
      triggerEvent: queueItem.triggerEvent,
      effectDefinition: queueItem.effectDefinition,
      startingSequence: input.startingSequence,
      ...(queueItem.triggerEvent.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: queueItem.triggerEvent.sourceActionId,
          }),
    })
  }

  return {
    ok: true,
    state,
    events: [],
    timingWindows: [],
  }
}

function resolveCheckTriggerRevealEffect(
  state: GameState,
  input: {
    readonly transitionId: TransitionId
    readonly sourceActionId?: ActionId
    readonly triggerEvent: Extract<
      GameEvent,
      { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
    >
    readonly effectDefinition: EffectDefinition
    readonly startingSequence: number
  },
): TriggeredEffectExecutionResult {
  const nextState = markCurrentCheckResolvedNone(state, input.triggerEvent)

  if (nextState === state) {
    return {
      ok: true,
      state,
      events: [],
      timingWindows: [],
    }
  }

  return {
    ok: true,
    state: nextState,
    events: [
      createEffectResolvedEvent({
        transitionId: input.transitionId,
        sequence: input.startingSequence,
        effectDefinition: input.effectDefinition,
        triggerEventSequence: input.triggerEvent.sequence,
        operationKinds: ['typed_handler'],
        ...(input.sourceActionId === undefined
          ? {}
          : {
              sourceActionId: input.sourceActionId,
            }),
      }),
    ],
    timingWindows: [],
  }
}

function resolveCardsDrawnFinalizeEffect(
  state: GameState,
  input: {
    readonly transitionId: TransitionId
    readonly sourceActionId?: ActionId
    readonly triggerEvent: Extract<GameEvent, { readonly type: 'cards.drawn' }>
    readonly effectDefinition: EffectDefinition
    readonly startingSequence: number
  },
): TriggeredEffectExecutionResult {
  return {
    ok: true,
    state,
    events: [
      createEffectResolvedEvent({
        transitionId: input.transitionId,
        sequence: input.startingSequence,
        effectDefinition: input.effectDefinition,
        triggerEventSequence: input.triggerEvent.sequence,
        operationKinds: ['typed_handler'],
        ...(input.sourceActionId === undefined
          ? {}
          : {
              sourceActionId: input.sourceActionId,
            }),
      }),
    ],
    timingWindows: [],
  }
}

function markCurrentCheckResolvedNone(
  state: GameState,
  triggerEvent: Extract<
    GameEvent,
    { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
  >,
): GameState {
  const battle = state.battle
  const expectedCheckKind =
    triggerEvent.type === 'battle.drive_checked' ? 'drive' : 'damage'

  if (
    battle === undefined ||
    battle.battleId !== triggerEvent.battleId ||
    battle.lastCheck === undefined ||
    battle.lastCheck.kind !== expectedCheckKind ||
    battle.lastCheck.triggerResolutionState !== 'pending_future_engine'
  ) {
    return state
  }

  return {
    ...state,
    battle: {
      ...battle,
      lastCheck: {
        ...battle.lastCheck,
        triggerResolutionState: 'resolved_none',
      },
    },
  }
}

function createNestedTimingWindowsForEffectEvents(
  events: readonly GameEvent[],
  startingSequence: number,
): readonly TransitionTimingWindow[] {
  let sequence = startingSequence
  const timingWindows: TransitionTimingWindow[] = []

  for (const event of events) {
    if (event.type !== 'cards.drawn') {
      continue
    }

    timingWindows.push({
      sequence,
      point: 'zone.transfer',
      window: 'after',
      relatedEventSequence: event.sequence,
    })
    sequence += 1
  }

  return timingWindows
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
  return (
    definition.id === CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY.id ||
    definition.id === CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id ||
    definition.id === PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY.id
  )
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

function createEffectResolvedEvent(input: {
  readonly transitionId: TransitionId
  readonly sequence: number
  readonly sourceActionId?: ActionId
  readonly effectDefinition: EffectDefinition
  readonly sourcePieceId?: PieceId
  readonly triggerEventSequence?: number
  readonly operationKinds: readonly string[]
}): EffectResolvedEvent {
  return {
    eventId: createEventId(input.transitionId, input.sequence),
    type: 'effect.resolved',
    sequence: input.sequence,
    ...(input.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: input.sourceActionId,
        }),
    origin: {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    effectDefinitionId: input.effectDefinition.id,
    ...(input.sourcePieceId === undefined
      ? {}
      : {
          sourcePieceId: input.sourcePieceId,
        }),
    ...(input.triggerEventSequence === undefined
      ? {}
      : {
          triggerEventSequence: input.triggerEventSequence,
        }),
    operationKinds: input.operationKinds,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
