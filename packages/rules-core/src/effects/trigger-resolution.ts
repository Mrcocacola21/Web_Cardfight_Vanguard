import type { TriggerType } from '@web-vg/shared'

import { resolveGamePieceCardStats } from '../cards'
import type {
  ActionId,
  EffectDefinitionId,
  EventId,
  PieceId,
  PlayerId,
  RequestId,
  TransitionId,
} from '../contracts'
import {
  VANGUARD_DAMAGE_DEFEAT_THRESHOLD,
  resolvePlayerDamageState,
} from '../damage'
import type {
  EffectResolvedEvent,
  GameEvent,
  TriggerResolutionOutcome,
} from '../events'
import type {
  BattleCheckKind,
  CheckTriggerResolutionState,
  GamePieceState,
  GamePieceStatusState,
  GameState,
  TriggerResolutionContinuationState,
  ZoneState,
} from '../state'
import {
  buildGameStateIndex,
  findOwnedZoneByKind,
  findPieceById,
  findPieceLocation,
  findPlayerById,
  listOwnedZonesByKind,
  resolvePrimaryOpponentPlayerId,
} from '../state'
import {
  drawTopPiecesBetweenZones,
  movePiecesByIdBetweenZones,
} from '../transitions/ordered-zone-operations'
import {
  resolveDeckOutLoss,
  shouldResolveDeckOutLoss,
} from '../transitions/deck-out'
import { applyStandPieceStateChange } from '../transitions/piece-state-flags'
import type { TransitionTimingWindow } from '../transitions/transition'
import { createPieceMovedEvents } from '../transitions/zone-transfer'
import type { TriggerChoiceRequest, TriggerChoiceResponse } from '../requests'

import type { EffectDefinition } from './effect'

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const
const PENDING_TRIGGER_RESOLUTION_STATE = 'pending_resolution' as const
const AWAITING_TRIGGER_CHOICE_STATE = 'awaiting_choice' as const

export const TRIGGER_POWER_BONUS = 10000
export const TRIGGER_CRITICAL_BONUS = 1
export const OVER_TRIGGER_POWER_BONUS = 100_000_000

export const TRIGGER_EFFECT_OPERATION_KINDS = {
  critical: ['trigger_power', 'trigger_critical'],
  draw: ['trigger_power', 'trigger_draw'],
  front: ['trigger_front_power'],
  heal: ['trigger_power', 'trigger_heal'],
  stand: ['trigger_power', 'trigger_stand'],
  over: ['trigger_over_power', 'trigger_over_draw'],
} as const satisfies Record<TriggerType, readonly string[]>

export type CheckTriggerRevealEffectResolutionResult =
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

export type CheckTriggerChoiceResponseResolutionResult =
  | {
      readonly ok: true
      readonly state: GameState
      readonly events: readonly GameEvent[]
      readonly timingWindows: readonly TransitionTimingWindow[]
    }
  | {
      readonly ok: false
      readonly code:
        | 'invalid_action'
        | 'invalid_action_reference'
        | 'request_response_mismatch'
      readonly message: string
    }

interface CheckTriggerRevealEffectInput {
  readonly transitionId: TransitionId
  readonly sourceActionId?: ActionId
  readonly triggerEvent: Extract<
    GameEvent,
    { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
  >
  readonly effectDefinition: EffectDefinition
  readonly startingSequence: number
  readonly startingTimingWindowSequence: number
}

interface SingleTriggerResolution {
  readonly state: GameState
  readonly events: readonly GameEvent[]
  readonly operationKinds: readonly string[]
}

interface TriggerResolutionContext {
  readonly transitionId: TransitionId
  readonly sourceActionId?: ActionId
  readonly triggerEvent: Extract<
    GameEvent,
    { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
  >
  readonly checkKind: BattleCheckKind
  readonly playerId: PlayerId
  readonly revealedPiece: GamePieceState
  readonly triggerType: TriggerType
}

interface DrawConsequenceResult {
  readonly state: GameState
  readonly events: readonly GameEvent[]
  readonly drawnPieceIds: readonly PieceId[]
}

interface HealConsequenceResult {
  readonly state: GameState
  readonly events: readonly GameEvent[]
  readonly healedPieceId?: PieceId
  readonly condition: {
    readonly met: boolean
    readonly playerDamage: number
    readonly opponentDamage: number
  }
}

interface TriggerChoicePlan {
  readonly request: TriggerChoiceRequest
  readonly continuation: TriggerResolutionContinuationState
}

interface TriggerResumeInput {
  readonly transitionId: TransitionId
  readonly request: TriggerChoiceRequest
  readonly response: TriggerChoiceResponse
  readonly startingSequence: number
  readonly startingTimingWindowSequence: number
}

export function resolveCheckTriggerRevealEffect(
  state: GameState,
  input: CheckTriggerRevealEffectInput,
): CheckTriggerRevealEffectResolutionResult {
  const checkKind =
    input.triggerEvent.type === 'battle.drive_checked' ? 'drive' : 'damage'

  if (!canResolveCurrentCheck(state, input.triggerEvent, checkKind)) {
    return {
      ok: true,
      state,
      events: [],
      timingWindows: [],
    }
  }

  let workingState = state
  const events: GameEvent[] = []
  const operationKinds: string[] = []
  let resolvedTriggers = 0

  for (
    let revealedCardIndex = 0;
    revealedCardIndex < input.triggerEvent.revealedCards.length;
    revealedCardIndex += 1
  ) {
    const revealedCard = input.triggerEvent.revealedCards[revealedCardIndex]

    if (revealedCard === undefined) {
      continue
    }

    const stateIndex = buildGameStateIndex(workingState)
    const revealedPiece = findPieceById(stateIndex, revealedCard.pieceId)

    if (revealedPiece === undefined) {
      continue
    }

    const statsResolution = resolveGamePieceCardStats(
      workingState,
      revealedPiece,
    )

    if (!statsResolution.ok || statsResolution.stats.triggerType === null) {
      continue
    }

    const triggerType = statsResolution.stats.triggerType
    const triggerContext: TriggerResolutionContext = {
      transitionId: input.transitionId,
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      triggerEvent: input.triggerEvent,
      checkKind,
      playerId: input.triggerEvent.playerId,
      revealedPiece,
      triggerType,
    }

    events.push(
      createTriggerRevealedEvent(triggerContext, {
        sequence: input.startingSequence + events.length,
        sourceCheckEventSequence: input.triggerEvent.sequence,
      }),
    )

    const choicePlan = createTriggerChoicePlan(workingState, triggerContext, {
      requestId: createTriggerChoiceRequestId(
        input.transitionId,
        input.triggerEvent.sequence,
        revealedCardIndex,
      ),
      effectDefinitionId: input.effectDefinition.id,
      sourceCheckEventSequence: input.triggerEvent.sequence,
      revealedCardIndex,
      nextRevealedCardIndex: revealedCardIndex + 1,
      resolvedTriggers,
      operationKinds,
    })

    if (choicePlan !== undefined) {
      return {
        ok: true,
        state: applyTriggerChoiceInterruption(
          workingState,
          input.triggerEvent,
          checkKind,
          choicePlan,
          workingState.pendingRequests,
        ),
        events,
        timingWindows: createNestedTimingWindowsForTriggerEvents(
          events,
          input.startingTimingWindowSequence,
        ),
      }
    }

    const triggerResolution = resolveSingleTrigger(
      workingState,
      triggerContext,
      {
        startingSequence: input.startingSequence + events.length,
      },
    )

    workingState = triggerResolution.state
    events.push(...triggerResolution.events)
    operationKinds.push(...triggerResolution.operationKinds)
    resolvedTriggers += 1

    if (workingState.status === 'completed') {
      return {
        ok: true,
        state: workingState,
        events,
        timingWindows: createNestedTimingWindowsForTriggerEvents(
          events,
          input.startingTimingWindowSequence,
        ),
      }
    }
  }

  const nextTriggerResolutionState =
    resolvedTriggers > 0 ? 'resolved_triggers' : 'resolved_none'
  workingState = markCurrentCheckResolved(
    workingState,
    input.triggerEvent,
    checkKind,
    nextTriggerResolutionState,
  )

  if (workingState === state && events.length === 0) {
    return {
      ok: true,
      state,
      events: [],
      timingWindows: [],
    }
  }

  events.push(
    createEffectResolvedEvent({
      transitionId: input.transitionId,
      sequence: input.startingSequence + events.length,
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      effectDefinitionId: input.effectDefinition.id,
      triggerEventSequence: input.triggerEvent.sequence,
      operationKinds:
        operationKinds.length === 0
          ? ['trigger_check_none']
          : Array.from(new Set(operationKinds)),
    }),
  )

  return {
    ok: true,
    state: workingState,
    events,
    timingWindows: createNestedTimingWindowsForTriggerEvents(
      events,
      input.startingTimingWindowSequence,
    ),
  }
}

export function resolveCheckTriggerChoiceResponse(
  state: GameState,
  input: TriggerResumeInput,
): CheckTriggerChoiceResponseResolutionResult {
  const battle = state.battle
  const lastCheck = battle?.lastCheck
  const continuation = lastCheck?.triggerContinuation

  if (
    battle === undefined ||
    lastCheck === undefined ||
    continuation === undefined ||
    lastCheck.triggerResolutionState !== AWAITING_TRIGGER_CHOICE_STATE ||
    continuation.requestId !== input.request.requestId ||
    input.request.battleId !== battle.battleId ||
    input.request.checkKind !== lastCheck.kind ||
    input.request.revealedPieceId !== continuation.revealedPieceId ||
    input.request.triggerType !== continuation.triggerType
  ) {
    return {
      ok: false,
      code: 'request_response_mismatch',
      message: `Pending trigger request ${input.request.requestId} no longer matches the current trigger continuation.`,
    }
  }

  const triggerEvent = createSyntheticCheckEventForContinuation(
    input.transitionId,
    battle,
    lastCheck,
    continuation,
  )

  if (triggerEvent === undefined) {
    return {
      ok: false,
      code: 'request_response_mismatch',
      message: `Pending trigger request ${input.request.requestId} cannot reconstruct its source check event.`,
    }
  }

  const stateIndex = buildGameStateIndex(state)
  const revealedPiece = findPieceById(stateIndex, continuation.revealedPieceId)

  if (revealedPiece === undefined) {
    return {
      ok: false,
      code: 'invalid_action_reference',
      message: `Pending trigger request ${input.request.requestId} references missing revealed piece ${continuation.revealedPieceId}.`,
    }
  }

  const remainingRequests = state.pendingRequests.slice(1)
  const {
    triggerContinuation: _triggerContinuation,
    ...lastCheckWithoutContinuation
  } = lastCheck
  let workingState: GameState = {
    ...state,
    status: remainingRequests.length > 0 ? 'awaiting_choice' : 'in_progress',
    pendingRequests: remainingRequests,
    battle: {
      ...battle,
      lastCheck: {
        ...lastCheckWithoutContinuation,
        triggerResolutionState: PENDING_TRIGGER_RESOLUTION_STATE,
      },
    },
  }
  const events: GameEvent[] = []
  const operationKinds = [...continuation.operationKinds]
  let resolvedTriggers = continuation.resolvedTriggers
  const triggerContext: TriggerResolutionContext = {
    transitionId: input.transitionId,
    ...(continuation.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: continuation.sourceActionId,
        }),
    triggerEvent,
    checkKind: lastCheck.kind,
    playerId: lastCheck.playerId,
    revealedPiece,
    triggerType: continuation.triggerType,
  }
  const currentResolution = resolveSingleTriggerFromChoice(
    workingState,
    triggerContext,
    continuation,
    input.response,
    {
      startingSequence: input.startingSequence,
    },
  )

  workingState = currentResolution.state
  events.push(...currentResolution.events)
  operationKinds.push(...currentResolution.operationKinds)
  resolvedTriggers += 1

  if (workingState.status === 'completed') {
    return {
      ok: true,
      state: workingState,
      events,
      timingWindows: createNestedTimingWindowsForTriggerEvents(
        events,
        input.startingTimingWindowSequence,
      ),
    }
  }

  return continueTriggerResolutionAfterChoice(workingState, {
    transitionId: input.transitionId,
    ...(continuation.sourceActionId === undefined
      ? {}
      : { sourceActionId: continuation.sourceActionId }),
    triggerEvent,
    checkKind: lastCheck.kind,
    effectDefinitionId: continuation.effectDefinitionId,
    startingSequence: input.startingSequence + events.length,
    startingTimingWindowSequence: input.startingTimingWindowSequence,
    startRevealedCardIndex: continuation.nextRevealedCardIndex,
    resolvedTriggers,
    operationKinds,
    events,
  })
}

function continueTriggerResolutionAfterChoice(
  state: GameState,
  input: {
    readonly transitionId: TransitionId
    readonly sourceActionId?: ActionId
    readonly triggerEvent: Extract<
      GameEvent,
      { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
    >
    readonly checkKind: BattleCheckKind
    readonly effectDefinitionId: EffectDefinitionId
    readonly startingSequence: number
    readonly startingTimingWindowSequence: number
    readonly startRevealedCardIndex: number
    readonly resolvedTriggers: number
    readonly operationKinds: readonly string[]
    readonly events: readonly GameEvent[]
  },
): CheckTriggerRevealEffectResolutionResult {
  let workingState = state
  const events: GameEvent[] = [...input.events]
  const operationKinds: string[] = [...input.operationKinds]
  let resolvedTriggers = input.resolvedTriggers

  for (
    let revealedCardIndex = input.startRevealedCardIndex;
    revealedCardIndex < input.triggerEvent.revealedCards.length;
    revealedCardIndex += 1
  ) {
    const revealedCard = input.triggerEvent.revealedCards[revealedCardIndex]

    if (revealedCard === undefined) {
      continue
    }

    const stateIndex = buildGameStateIndex(workingState)
    const revealedPiece = findPieceById(stateIndex, revealedCard.pieceId)

    if (revealedPiece === undefined) {
      continue
    }

    const statsResolution = resolveGamePieceCardStats(
      workingState,
      revealedPiece,
    )

    if (!statsResolution.ok || statsResolution.stats.triggerType === null) {
      continue
    }

    const triggerType = statsResolution.stats.triggerType
    const triggerContext: TriggerResolutionContext = {
      transitionId: input.transitionId,
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      triggerEvent: input.triggerEvent,
      checkKind: input.checkKind,
      playerId: input.triggerEvent.playerId,
      revealedPiece,
      triggerType,
    }

    events.push(
      createTriggerRevealedEvent(triggerContext, {
        sequence: input.startingSequence + events.length - input.events.length,
        sourceCheckEventSequence: input.triggerEvent.sequence,
      }),
    )

    const choicePlan = createTriggerChoicePlan(workingState, triggerContext, {
      requestId: createTriggerChoiceRequestId(
        input.transitionId,
        input.triggerEvent.sequence,
        revealedCardIndex,
      ),
      effectDefinitionId: input.effectDefinitionId,
      sourceCheckEventSequence: input.triggerEvent.sequence,
      revealedCardIndex,
      nextRevealedCardIndex: revealedCardIndex + 1,
      resolvedTriggers,
      operationKinds,
    })

    if (choicePlan !== undefined) {
      return {
        ok: true,
        state: applyTriggerChoiceInterruption(
          workingState,
          input.triggerEvent,
          input.checkKind,
          choicePlan,
          workingState.pendingRequests,
        ),
        events,
        timingWindows: createNestedTimingWindowsForTriggerEvents(
          events,
          input.startingTimingWindowSequence,
        ),
      }
    }

    const triggerResolution = resolveSingleTrigger(
      workingState,
      triggerContext,
      {
        startingSequence:
          input.startingSequence + events.length - input.events.length,
      },
    )

    workingState = triggerResolution.state
    events.push(...triggerResolution.events)
    operationKinds.push(...triggerResolution.operationKinds)
    resolvedTriggers += 1

    if (workingState.status === 'completed') {
      return {
        ok: true,
        state: workingState,
        events,
        timingWindows: createNestedTimingWindowsForTriggerEvents(
          events,
          input.startingTimingWindowSequence,
        ),
      }
    }
  }

  const nextTriggerResolutionState =
    resolvedTriggers > 0 ? 'resolved_triggers' : 'resolved_none'
  workingState = markCurrentCheckResolved(
    workingState,
    input.triggerEvent,
    input.checkKind,
    nextTriggerResolutionState,
  )
  events.push(
    createEffectResolvedEvent({
      transitionId: input.transitionId,
      sequence: input.startingSequence + events.length - input.events.length,
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      effectDefinitionId: input.effectDefinitionId,
      triggerEventSequence: input.triggerEvent.sequence,
      operationKinds:
        operationKinds.length === 0
          ? ['trigger_check_none']
          : Array.from(new Set(operationKinds)),
    }),
  )

  return {
    ok: true,
    state: workingState,
    events,
    timingWindows: createNestedTimingWindowsForTriggerEvents(
      events,
      input.startingTimingWindowSequence,
    ),
  }
}

function resolveSingleTrigger(
  state: GameState,
  context: TriggerResolutionContext,
  options: {
    readonly startingSequence: number
  },
): SingleTriggerResolution {
  switch (context.triggerType) {
    case 'critical':
      return resolveCriticalTrigger(state, context, options)
    case 'draw':
      return resolveDrawTrigger(state, context, options)
    case 'front':
      return resolveFrontTrigger(state, context, options)
    case 'heal':
      return resolveHealTrigger(state, context, options)
    case 'stand':
      return resolveStandTrigger(state, context, options)
    case 'over':
      return resolveOverTrigger(state, context, options)
  }
}

function resolveSingleTriggerFromChoice(
  state: GameState,
  context: TriggerResolutionContext,
  continuation: TriggerResolutionContinuationState,
  response: TriggerChoiceResponse,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  switch (context.triggerType) {
    case 'critical':
      return resolveCriticalTriggerFromChoice(state, context, response, options)
    case 'draw':
      return resolveDrawTriggerFromChoice(state, context, response, options)
    case 'heal':
      return resolveHealTriggerFromChoice(
        state,
        context,
        continuation,
        response,
        options,
      )
    case 'stand':
      return resolveStandTriggerFromChoice(state, context, response, options)
    case 'front':
    case 'over':
      return resolveSingleTrigger(state, context, options)
  }
}

function resolveCriticalTriggerFromChoice(
  state: GameState,
  context: TriggerResolutionContext,
  response: TriggerChoiceResponse,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const powerTargetPieceId = response.powerTargetPieceIds?.[0]
  const criticalTargetPieceId = response.criticalTargetPieceId
  let nextState = state

  if (powerTargetPieceId !== undefined) {
    nextState = applyRuntimePieceModifiers(nextState, [powerTargetPieceId], {
      powerModifier: TRIGGER_POWER_BONUS,
    })
  }

  if (criticalTargetPieceId !== undefined) {
    nextState = applyRuntimePieceModifiers(nextState, [criticalTargetPieceId], {
      criticalModifier: TRIGGER_CRITICAL_BONUS,
    })
  }

  return {
    state: nextState,
    events: [
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence,
        outcome:
          powerTargetPieceId === undefined &&
          criticalTargetPieceId === undefined
            ? 'not_applicable'
            : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds:
          powerTargetPieceId === undefined ? [] : [powerTargetPieceId],
        criticalAmount: TRIGGER_CRITICAL_BONUS,
        ...(criticalTargetPieceId === undefined
          ? {}
          : {
              criticalTargetPieceId,
            }),
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.critical,
  }
}

function resolveDrawTriggerFromChoice(
  state: GameState,
  context: TriggerResolutionContext,
  response: TriggerChoiceResponse,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceId = response.powerTargetPieceIds?.[0]
  let workingState =
    targetPieceId === undefined
      ? state
      : applyRuntimePieceModifiers(state, [targetPieceId], {
          powerModifier: TRIGGER_POWER_BONUS,
        })
  const drawResult = applyDrawConsequence(workingState, context, {
    startingSequence: options.startingSequence,
  })
  workingState = drawResult.state

  if (workingState.status === 'completed') {
    return {
      state: workingState,
      events: drawResult.events,
      operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.draw,
    }
  }

  return {
    state: workingState,
    events: [
      ...drawResult.events,
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence + drawResult.events.length,
        outcome:
          targetPieceId === undefined && drawResult.drawnPieceIds.length === 0
            ? 'not_applicable'
            : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceId === undefined ? [] : [targetPieceId],
        drawnPieceIds: drawResult.drawnPieceIds,
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.draw,
  }
}

function resolveHealTriggerFromChoice(
  state: GameState,
  context: TriggerResolutionContext,
  continuation: TriggerResolutionContinuationState,
  response: TriggerChoiceResponse,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceId = response.powerTargetPieceIds?.[0]
  let workingState =
    targetPieceId === undefined
      ? state
      : applyRuntimePieceModifiers(state, [targetPieceId], {
          powerModifier: TRIGGER_POWER_BONUS,
        })
  const healResult = applyHealConsequence(workingState, context, {
    startingSequence: options.startingSequence,
    ...(response.healTargetPieceId === undefined
      ? {}
      : { healPieceId: response.healTargetPieceId }),
  })
  workingState = healResult.state

  return {
    state: workingState,
    events: [
      ...healResult.events,
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence + healResult.events.length,
        outcome:
          targetPieceId === undefined &&
          healResult.healedPieceId === undefined &&
          continuation.healCondition?.met !== true
            ? 'not_applicable'
            : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceId === undefined ? [] : [targetPieceId],
        ...(healResult.healedPieceId === undefined
          ? {}
          : {
              healedPieceId: healResult.healedPieceId,
            }),
        healCondition: healResult.condition,
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.heal,
  }
}

function resolveStandTriggerFromChoice(
  state: GameState,
  context: TriggerResolutionContext,
  response: TriggerChoiceResponse,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceId = response.powerTargetPieceIds?.[0]
  let workingState =
    targetPieceId === undefined
      ? state
      : applyRuntimePieceModifiers(state, [targetPieceId], {
          powerModifier: TRIGGER_POWER_BONUS,
        })
  const standTargetPieceId = response.standTargetPieceId
  const standEvents: readonly GameEvent[] =
    standTargetPieceId === undefined
      ? []
      : resolveStandConsequence(workingState, context, standTargetPieceId, {
          sequence: options.startingSequence,
        })

  if (standTargetPieceId !== undefined) {
    const standChange = applyStandPieceStateChange(
      workingState,
      standTargetPieceId,
      context.transitionId,
      options.startingSequence,
      {
        kind: 'system',
        system: AUTOMATIC_FLOW_SYSTEM,
      },
      context.sourceActionId,
    )

    if (standChange.ok) {
      workingState = {
        ...workingState,
        pieceStates: standChange.pieceStates,
      }
    }
  }

  return {
    state: workingState,
    events: [
      ...standEvents,
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence + standEvents.length,
        outcome:
          targetPieceId === undefined && standTargetPieceId === undefined
            ? 'not_applicable'
            : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceId === undefined ? [] : [targetPieceId],
        ...(standTargetPieceId === undefined
          ? {}
          : {
              stoodPieceId: standTargetPieceId,
            }),
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.stand,
  }
}

function resolveCriticalTrigger(
  state: GameState,
  context: TriggerResolutionContext,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceId = resolvePrimaryTriggerTargetPieceId(state, context)
  const nextState =
    targetPieceId === undefined
      ? state
      : applyRuntimePieceModifiers(state, [targetPieceId], {
          powerModifier: TRIGGER_POWER_BONUS,
          criticalModifier: TRIGGER_CRITICAL_BONUS,
        })

  return {
    state: nextState,
    events: [
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence,
        outcome: targetPieceId === undefined ? 'not_applicable' : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceId === undefined ? [] : [targetPieceId],
        criticalAmount: TRIGGER_CRITICAL_BONUS,
        ...(targetPieceId === undefined
          ? {}
          : {
              criticalTargetPieceId: targetPieceId,
            }),
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.critical,
  }
}

function resolveDrawTrigger(
  state: GameState,
  context: TriggerResolutionContext,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceId = resolvePrimaryTriggerTargetPieceId(state, context)
  let workingState =
    targetPieceId === undefined
      ? state
      : applyRuntimePieceModifiers(state, [targetPieceId], {
          powerModifier: TRIGGER_POWER_BONUS,
        })
  const drawResult = applyDrawConsequence(workingState, context, {
    startingSequence: options.startingSequence,
  })
  workingState = drawResult.state

  if (workingState.status === 'completed') {
    return {
      state: workingState,
      events: drawResult.events,
      operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.draw,
    }
  }

  return {
    state: workingState,
    events: [
      ...drawResult.events,
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence + drawResult.events.length,
        outcome:
          targetPieceId === undefined && drawResult.drawnPieceIds.length === 0
            ? 'not_applicable'
            : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceId === undefined ? [] : [targetPieceId],
        drawnPieceIds: drawResult.drawnPieceIds,
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.draw,
  }
}

function resolveFrontTrigger(
  state: GameState,
  context: TriggerResolutionContext,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceIds = resolveControlledBattleUnitPieceIds(
    state,
    context.playerId,
  )
  const nextState = applyRuntimePieceModifiers(state, targetPieceIds, {
    powerModifier: TRIGGER_POWER_BONUS,
  })

  return {
    state: nextState,
    events: [
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence,
        outcome: targetPieceIds.length === 0 ? 'not_applicable' : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceIds,
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.front,
  }
}

function resolveHealTrigger(
  state: GameState,
  context: TriggerResolutionContext,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceId = resolvePrimaryTriggerTargetPieceId(state, context)
  let workingState =
    targetPieceId === undefined
      ? state
      : applyRuntimePieceModifiers(state, [targetPieceId], {
          powerModifier: TRIGGER_POWER_BONUS,
        })
  const healResult = applyHealConsequence(workingState, context, {
    startingSequence: options.startingSequence,
  })
  workingState = healResult.state

  return {
    state: workingState,
    events: [
      ...healResult.events,
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence + healResult.events.length,
        outcome:
          targetPieceId === undefined &&
          healResult.healedPieceId === undefined &&
          !healResult.condition.met
            ? 'not_applicable'
            : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceId === undefined ? [] : [targetPieceId],
        ...(healResult.healedPieceId === undefined
          ? {}
          : {
              healedPieceId: healResult.healedPieceId,
            }),
        healCondition: healResult.condition,
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.heal,
  }
}

function resolveStandTrigger(
  state: GameState,
  context: TriggerResolutionContext,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceId = resolvePrimaryTriggerTargetPieceId(state, context)
  let workingState =
    targetPieceId === undefined
      ? state
      : applyRuntimePieceModifiers(state, [targetPieceId], {
          powerModifier: TRIGGER_POWER_BONUS,
        })
  const standTargetPieceId = resolveStandTriggerTargetPieceId(
    workingState,
    context.playerId,
  )
  const standEvents: readonly GameEvent[] =
    standTargetPieceId === undefined
      ? []
      : resolveStandConsequence(workingState, context, standTargetPieceId, {
          sequence: options.startingSequence,
        })

  if (standTargetPieceId !== undefined) {
    const standChange = applyStandPieceStateChange(
      workingState,
      standTargetPieceId,
      context.transitionId,
      options.startingSequence,
      {
        kind: 'system',
        system: AUTOMATIC_FLOW_SYSTEM,
      },
      context.sourceActionId,
    )

    if (standChange.ok) {
      workingState = {
        ...workingState,
        pieceStates: standChange.pieceStates,
      }
    }
  }

  return {
    state: workingState,
    events: [
      ...standEvents,
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence + standEvents.length,
        outcome:
          targetPieceId === undefined && standTargetPieceId === undefined
            ? 'not_applicable'
            : 'applied',
        powerAmount: TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceId === undefined ? [] : [targetPieceId],
        ...(standTargetPieceId === undefined
          ? {}
          : {
              stoodPieceId: standTargetPieceId,
            }),
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.stand,
  }
}

function resolveOverTrigger(
  state: GameState,
  context: TriggerResolutionContext,
  options: { readonly startingSequence: number },
): SingleTriggerResolution {
  const targetPieceIds = resolveControlledBattleUnitPieceIds(
    state,
    context.playerId,
  )
  let workingState = applyRuntimePieceModifiers(state, targetPieceIds, {
    powerModifier: OVER_TRIGGER_POWER_BONUS,
  })
  const drawResult = applyDrawConsequence(workingState, context, {
    startingSequence: options.startingSequence,
  })
  workingState = drawResult.state

  if (workingState.status === 'completed') {
    return {
      state: workingState,
      events: drawResult.events,
      operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.over,
    }
  }

  return {
    state: workingState,
    events: [
      ...drawResult.events,
      createTriggerResolvedEvent(context, {
        sequence: options.startingSequence + drawResult.events.length,
        outcome:
          targetPieceIds.length === 0 && drawResult.drawnPieceIds.length === 0
            ? 'not_applicable'
            : 'applied',
        powerAmount: OVER_TRIGGER_POWER_BONUS,
        powerTargetPieceIds: targetPieceIds,
        drawnPieceIds: drawResult.drawnPieceIds,
        overTriggerApplied: true,
      }),
    ],
    operationKinds: TRIGGER_EFFECT_OPERATION_KINDS.over,
  }
}

function resolveStandConsequence(
  state: GameState,
  context: TriggerResolutionContext,
  pieceId: PieceId,
  options: { readonly sequence: number },
): readonly GameEvent[] {
  const standChange = applyStandPieceStateChange(
    state,
    pieceId,
    context.transitionId,
    options.sequence,
    {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    context.sourceActionId,
  )

  return standChange.ok ? [standChange.event] : []
}

function applyDrawConsequence(
  state: GameState,
  context: TriggerResolutionContext,
  options: { readonly startingSequence: number },
): DrawConsequenceResult {
  const stateIndex = buildGameStateIndex(state)
  const player = findPlayerById(stateIndex, context.playerId)
  const deckZone =
    player === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, player, 'deck')
  const handZone =
    player === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, player, 'hand')

  if (
    player === undefined ||
    deckZone === undefined ||
    handZone === undefined
  ) {
    return {
      state,
      events: [],
      drawnPieceIds: [],
    }
  }

  if (shouldResolveDeckOutLoss(deckZone, 1)) {
    const deckOutResult = resolveDeckOutLoss({
      transitionId: context.transitionId,
      currentState: state,
      playerId: context.playerId,
      fromZoneId: deckZone.zoneId,
      requiredCount: 1,
      availableCount: deckZone.occupants.length,
      reason: 'trigger_effect',
      ...(context.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: context.sourceActionId,
          }),
      system: AUTOMATIC_FLOW_SYSTEM,
      startingSequence: options.startingSequence,
    })

    return deckOutResult.ok
      ? {
          state: deckOutResult.state,
          events: deckOutResult.events,
          drawnPieceIds: [],
        }
      : {
          state,
          events: [],
          drawnPieceIds: [],
        }
  }

  const drawResult = drawTopPiecesBetweenZones(
    state,
    deckZone.zoneId,
    handZone.zoneId,
    1,
    'trigger_effect',
  )

  if (!drawResult.ok) {
    return {
      state,
      events: [],
      drawnPieceIds: [],
    }
  }

  const movedEvents = createPieceMovedEvents(
    context.transitionId,
    drawResult.movedPieces,
    {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    {
      ...(context.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: context.sourceActionId,
          }),
      startingSequence: options.startingSequence,
    },
  )
  const cardsDrawnEvent: Extract<GameEvent, { readonly type: 'cards.drawn' }> =
    {
      eventId: createEventId(
        context.transitionId,
        options.startingSequence + movedEvents.length,
      ),
      type: 'cards.drawn',
      sequence: options.startingSequence + movedEvents.length,
      ...(context.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: context.sourceActionId,
          }),
      origin: {
        kind: 'system',
        system: AUTOMATIC_FLOW_SYSTEM,
      },
      playerId: context.playerId,
      fromZoneId: deckZone.zoneId,
      toZoneId: handZone.zoneId,
      pieceIds: drawResult.movedPieces.map((movement) => movement.pieceId),
    }

  return {
    state: {
      ...state,
      zones: drawResult.zones,
      pieceStates: drawResult.pieceStates,
    },
    events: [...movedEvents, cardsDrawnEvent],
    drawnPieceIds: drawResult.movedPieces.map((movement) => movement.pieceId),
  }
}

function applyHealConsequence(
  state: GameState,
  context: TriggerResolutionContext,
  options: {
    readonly startingSequence: number
    readonly healPieceId?: PieceId
  },
): HealConsequenceResult {
  const condition = resolveHealCondition(state, context.playerId)

  if (!condition.met) {
    return {
      state,
      events: [],
      condition,
    }
  }

  const stateIndex = buildGameStateIndex(state)
  const player = findPlayerById(stateIndex, context.playerId)
  const damageZone =
    player === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, player, 'damage')
  const dropZone =
    player === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, player, 'drop')
  const healPieceId =
    options.healPieceId ??
    (damageZone === undefined
      ? undefined
      : resolveHealPieceId(damageZone, context.triggerEvent))

  if (
    damageZone === undefined ||
    dropZone === undefined ||
    healPieceId === undefined
  ) {
    return {
      state,
      events: [],
      condition,
    }
  }

  const healResult = movePiecesByIdBetweenZones(
    state,
    [healPieceId],
    damageZone.zoneId,
    dropZone.zoneId,
    'heal',
  )

  if (!healResult.ok) {
    return {
      state,
      events: [],
      condition,
    }
  }

  let workingState: GameState = {
    ...state,
    zones: healResult.zones,
    pieceStates: healResult.pieceStates,
  }
  const damageBefore = resolvePlayerDamageState(state, context.playerId)
  const damageAfter = resolvePlayerDamageState(workingState, context.playerId)

  if (damageBefore.ok && damageAfter.ok) {
    workingState = reconcileBattleDamageAfterHeal(
      workingState,
      context,
      damageAfter.damage.damageCount,
    )
  }

  const movedEvents = createPieceMovedEvents(
    context.transitionId,
    healResult.movedPieces,
    {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    {
      ...(context.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: context.sourceActionId,
          }),
      startingSequence: options.startingSequence,
    },
  )
  const damageChangedEvent: GameEvent | undefined =
    damageBefore.ok && damageAfter.ok
      ? {
          eventId: createEventId(
            context.transitionId,
            options.startingSequence + movedEvents.length,
          ),
          type: 'player.damage_changed',
          sequence: options.startingSequence + movedEvents.length,
          ...(context.sourceActionId === undefined
            ? {}
            : {
                sourceActionId: context.sourceActionId,
              }),
          origin: {
            kind: 'system',
            system: AUTOMATIC_FLOW_SYSTEM,
          },
          playerId: context.playerId,
          battleId: context.triggerEvent.battleId,
          damageZoneId: damageAfter.damage.damageZoneId,
          previousDamage: damageBefore.damage.damageCount,
          nextDamage: damageAfter.damage.damageCount,
          defeatThreshold: VANGUARD_DAMAGE_DEFEAT_THRESHOLD,
          outcome: damageAfter.damage.isDefeatedByDamage
            ? 'lethal'
            : 'non_lethal',
          movedPieceIds: [healPieceId],
        }
      : undefined

  return {
    state: workingState,
    events:
      damageChangedEvent === undefined
        ? movedEvents
        : [...movedEvents, damageChangedEvent],
    healedPieceId: healPieceId,
    condition,
  }
}

function reconcileBattleDamageAfterHeal(
  state: GameState,
  context: TriggerResolutionContext,
  damageAfter: number,
): GameState {
  if (context.triggerEvent.type !== 'battle.damage_checked') {
    return state
  }

  const battle = state.battle

  if (
    battle === undefined ||
    battle.battleId !== context.triggerEvent.battleId ||
    battle.damage === undefined ||
    battle.damage.playerId !== context.playerId
  ) {
    return state
  }

  return {
    ...state,
    battle: {
      ...battle,
      damage: {
        ...battle.damage,
        damageAfter,
        outcome:
          damageAfter >= battle.damage.defeatThreshold
            ? 'lethal'
            : 'non_lethal',
      },
    },
  }
}

function resolveHealCondition(
  state: GameState,
  playerId: PlayerId,
): HealConsequenceResult['condition'] {
  const stateIndex = buildGameStateIndex(state)
  const playerDamage = resolvePlayerDamageState(state, playerId)
  const opponentPlayerId = resolvePrimaryOpponentPlayerId(stateIndex, playerId)
  const opponentDamage =
    opponentPlayerId === undefined
      ? undefined
      : resolvePlayerDamageState(state, opponentPlayerId)

  const playerDamageCount = playerDamage.ok
    ? playerDamage.damage.damageCount
    : 0
  const opponentDamageCount =
    opponentDamage?.ok === true ? opponentDamage.damage.damageCount : 0

  return {
    met:
      playerDamage.ok && opponentDamage?.ok === true
        ? playerDamageCount >= opponentDamageCount
        : false,
    playerDamage: playerDamageCount,
    opponentDamage: opponentDamageCount,
  }
}

function resolveHealPieceId(
  damageZone: ZoneState,
  triggerEvent: Extract<
    GameEvent,
    { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
  >,
): PieceId | undefined {
  const revealedPieceIds = new Set(
    triggerEvent.revealedCards.map((card) => card.pieceId),
  )

  return (
    damageZone.occupants.find(
      (occupant) => !revealedPieceIds.has(occupant.pieceId),
    )?.pieceId ?? damageZone.occupants[0]?.pieceId
  )
}

function resolveHealEligiblePieceIds(
  state: GameState,
  context: TriggerResolutionContext,
): readonly PieceId[] {
  const stateIndex = buildGameStateIndex(state)
  const player = findPlayerById(stateIndex, context.playerId)
  const damageZone =
    player === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, player, 'damage')

  if (damageZone === undefined) {
    return []
  }

  const revealedPieceIds = new Set(
    context.triggerEvent.revealedCards.map((card) => card.pieceId),
  )
  const nonRevealedDamagePieceIds = damageZone.occupants
    .map((occupant) => occupant.pieceId)
    .filter((pieceId) => !revealedPieceIds.has(pieceId))

  return nonRevealedDamagePieceIds.length > 0
    ? nonRevealedDamagePieceIds
    : damageZone.occupants.map((occupant) => occupant.pieceId)
}

function resolvePrimaryTriggerTargetPieceId(
  state: GameState,
  context: TriggerResolutionContext,
): PieceId | undefined {
  const battle = state.battle
  const stateIndex = buildGameStateIndex(state)

  if (
    context.checkKind === 'drive' &&
    battle !== undefined &&
    battle.battleId === context.triggerEvent.battleId &&
    isControlledBattleUnit(
      state,
      battle.attackerPieceId,
      context.playerId,
      stateIndex,
    )
  ) {
    return battle.attackerPieceId
  }

  const player = findPlayerById(stateIndex, context.playerId)
  const vanguardPieceId =
    player === undefined
      ? undefined
      : findOwnedZoneByKind(stateIndex, player, 'vanguard_circle')?.occupants[0]
          ?.pieceId

  if (
    vanguardPieceId !== undefined &&
    isControlledBattleUnit(state, vanguardPieceId, context.playerId, stateIndex)
  ) {
    return vanguardPieceId
  }

  return resolveControlledBattleUnitPieceIds(state, context.playerId)[0]
}

function createTriggerChoicePlan(
  state: GameState,
  context: TriggerResolutionContext,
  input: {
    readonly requestId: RequestId
    readonly effectDefinitionId: EffectDefinitionId
    readonly sourceCheckEventSequence: number
    readonly revealedCardIndex: number
    readonly nextRevealedCardIndex: number
    readonly resolvedTriggers: number
    readonly operationKinds: readonly string[]
  },
): TriggerChoicePlan | undefined {
  const battle = state.battle

  if (battle === undefined) {
    return undefined
  }

  const controlledBattleUnitPieceIds = resolveControlledBattleUnitPieceIds(
    state,
    context.playerId,
  )
  const powerEligiblePieceIds =
    requiresTriggerPowerChoice(context.triggerType) &&
    controlledBattleUnitPieceIds.length > 0
      ? controlledBattleUnitPieceIds
      : undefined
  const criticalEligiblePieceIds =
    context.triggerType === 'critical' &&
    controlledBattleUnitPieceIds.length > 0
      ? controlledBattleUnitPieceIds
      : undefined
  const standEligiblePieceIds =
    context.triggerType === 'stand'
      ? resolveStandTriggerTargetPieceIds(state, context.playerId)
      : undefined
  const healCondition =
    context.triggerType === 'heal'
      ? resolveHealCondition(state, context.playerId)
      : undefined
  const healEligiblePieceIds =
    context.triggerType === 'heal' && healCondition?.met === true
      ? resolveHealEligiblePieceIds(state, context)
      : undefined

  if (
    powerEligiblePieceIds === undefined &&
    criticalEligiblePieceIds === undefined &&
    (standEligiblePieceIds === undefined ||
      standEligiblePieceIds.length === 0) &&
    (healEligiblePieceIds === undefined || healEligiblePieceIds.length === 0)
  ) {
    return undefined
  }

  const request: TriggerChoiceRequest = {
    requestId: input.requestId,
    type: 'trigger.resolve',
    responderPlayerId: context.playerId,
    purpose: 'effect',
    visibility: 'responder-only',
    battleId: battle.battleId,
    checkKind: context.checkKind,
    revealedPieceId: context.revealedPiece.pieceId,
    triggerType: context.triggerType,
    ...(powerEligiblePieceIds === undefined
      ? {}
      : {
          powerAmount:
            context.triggerType === 'over'
              ? OVER_TRIGGER_POWER_BONUS
              : TRIGGER_POWER_BONUS,
          powerEligiblePieceIds,
        }),
    ...(criticalEligiblePieceIds === undefined
      ? {}
      : {
          criticalAmount: TRIGGER_CRITICAL_BONUS,
          criticalEligiblePieceIds,
        }),
    ...(standEligiblePieceIds === undefined ||
    standEligiblePieceIds.length === 0
      ? {}
      : {
          standEligiblePieceIds,
        }),
    ...(healEligiblePieceIds === undefined || healEligiblePieceIds.length === 0
      ? {}
      : {
          healEligiblePieceIds,
        }),
    context: {
      ...(context.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: context.sourceActionId,
          }),
      sourceEventId: context.triggerEvent.eventId,
      relatedPieceIds: Array.from(
        new Set([
          context.revealedPiece.pieceId,
          ...(powerEligiblePieceIds ?? []),
          ...(criticalEligiblePieceIds ?? []),
          ...(standEligiblePieceIds ?? []),
          ...(healEligiblePieceIds ?? []),
        ]),
      ),
      relatedZoneIds: Array.from(
        new Set([
          context.triggerEvent.fromZoneId,
          context.triggerEvent.toZoneId,
        ]),
      ),
    },
  }
  const continuation: TriggerResolutionContinuationState = {
    requestId: input.requestId,
    effectDefinitionId: input.effectDefinitionId,
    ...(context.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: context.sourceActionId,
        }),
    sourceCheckEventSequence: input.sourceCheckEventSequence,
    revealedCardIndex: input.revealedCardIndex,
    nextRevealedCardIndex: input.nextRevealedCardIndex,
    resolvedTriggers: input.resolvedTriggers,
    operationKinds: input.operationKinds,
    triggerType: context.triggerType,
    revealedPieceId: context.revealedPiece.pieceId,
    ...(powerEligiblePieceIds === undefined
      ? {}
      : {
          powerAmount:
            context.triggerType === 'over'
              ? OVER_TRIGGER_POWER_BONUS
              : TRIGGER_POWER_BONUS,
          powerEligiblePieceIds,
        }),
    ...(criticalEligiblePieceIds === undefined
      ? {}
      : {
          criticalAmount: TRIGGER_CRITICAL_BONUS,
          criticalEligiblePieceIds,
        }),
    ...(standEligiblePieceIds === undefined ||
    standEligiblePieceIds.length === 0
      ? {}
      : {
          standEligiblePieceIds,
        }),
    ...(healEligiblePieceIds === undefined || healEligiblePieceIds.length === 0
      ? {}
      : {
          healEligiblePieceIds,
        }),
    ...(healCondition === undefined ? {} : { healCondition }),
  }

  return { request, continuation }
}

function requiresTriggerPowerChoice(triggerType: TriggerType): boolean {
  return (
    triggerType === 'critical' ||
    triggerType === 'draw' ||
    triggerType === 'heal' ||
    triggerType === 'stand'
  )
}

function createTriggerChoiceRequestId(
  transitionId: TransitionId,
  sourceCheckEventSequence: number,
  revealedCardIndex: number,
): RequestId {
  return `${transitionId}:trigger:${sourceCheckEventSequence}:${revealedCardIndex}` as RequestId
}

function resolveStandTriggerTargetPieceId(
  state: GameState,
  playerId: PlayerId,
): PieceId | undefined {
  return resolveStandTriggerTargetPieceIds(state, playerId)[0]
}

function resolveStandTriggerTargetPieceIds(
  state: GameState,
  playerId: PlayerId,
): readonly PieceId[] {
  const stateIndex = buildGameStateIndex(state)
  const player = findPlayerById(stateIndex, playerId)
  const rearGuardZones =
    player === undefined
      ? []
      : listOwnedZonesByKind(stateIndex, player, 'rear_guard_circle')
  const targetPieceIds: PieceId[] = []

  for (const zone of rearGuardZones) {
    for (const occupant of zone.occupants) {
      if (
        !isControlledBattleUnit(state, occupant.pieceId, playerId, stateIndex)
      ) {
        continue
      }

      const pieceState = resolveRuntimePieceStatusState(
        state.pieceStates,
        occupant.pieceId,
      )

      if (
        pieceState.orientation === 'rest' &&
        !pieceState.flags.includes('locked')
      ) {
        targetPieceIds.push(occupant.pieceId)
      }
    }
  }

  return targetPieceIds
}

function resolveControlledBattleUnitPieceIds(
  state: GameState,
  playerId: PlayerId,
): readonly PieceId[] {
  const stateIndex = buildGameStateIndex(state)

  return [
    ...listOwnedZonesByKind(stateIndex, playerId, 'vanguard_circle'),
    ...listOwnedZonesByKind(stateIndex, playerId, 'rear_guard_circle'),
  ]
    .flatMap((zone) => zone.occupants.map((occupant) => occupant.pieceId))
    .filter((pieceId) =>
      isControlledBattleUnit(state, pieceId, playerId, stateIndex),
    )
}

function isControlledBattleUnit(
  state: GameState,
  pieceId: PieceId,
  playerId: PlayerId,
  stateIndex = buildGameStateIndex(state),
): boolean {
  const location = findPieceLocation(stateIndex, pieceId)
  const piece = findPieceById(stateIndex, pieceId)

  return (
    piece?.controllerPlayerId === playerId &&
    (location?.zone.kind === 'vanguard_circle' ||
      location?.zone.kind === 'rear_guard_circle')
  )
}

function applyRuntimePieceModifiers(
  state: GameState,
  pieceIds: readonly PieceId[],
  modifiers: {
    readonly powerModifier?: number
    readonly criticalModifier?: number
  },
): GameState {
  if (pieceIds.length === 0) {
    return state
  }

  let nextPieceStates = state.pieceStates

  for (const pieceId of pieceIds) {
    const currentPieceState = resolveRuntimePieceStatusState(
      nextPieceStates,
      pieceId,
    )
    nextPieceStates = upsertRuntimePieceStatusState(nextPieceStates, {
      ...currentPieceState,
      powerModifier:
        (currentPieceState.powerModifier ?? 0) + (modifiers.powerModifier ?? 0),
      criticalModifier:
        (currentPieceState.criticalModifier ?? 0) +
        (modifiers.criticalModifier ?? 0),
    })
  }

  return {
    ...state,
    pieceStates: nextPieceStates,
  }
}

function resolveRuntimePieceStatusState(
  pieceStates: readonly GamePieceStatusState[],
  pieceId: PieceId,
): GamePieceStatusState {
  return (
    pieceStates.find((pieceState) => pieceState.pieceId === pieceId) ?? {
      pieceId,
      orientation: 'stand',
      flags: [],
    }
  )
}

function upsertRuntimePieceStatusState(
  pieceStates: readonly GamePieceStatusState[],
  nextPieceState: GamePieceStatusState,
): readonly GamePieceStatusState[] {
  const normalizedState = normalizeRuntimePieceStatusState(nextPieceState)
  const existingIndex = pieceStates.findIndex(
    (pieceState) => pieceState.pieceId === nextPieceState.pieceId,
  )

  if (normalizedState === undefined) {
    return existingIndex === -1
      ? pieceStates
      : pieceStates.filter(
          (pieceState) => pieceState.pieceId !== nextPieceState.pieceId,
        )
  }

  if (existingIndex === -1) {
    return [...pieceStates, normalizedState]
  }

  return pieceStates.map((pieceState) =>
    pieceState.pieceId === normalizedState.pieceId
      ? normalizedState
      : pieceState,
  )
}

function normalizeRuntimePieceStatusState(
  pieceState: GamePieceStatusState,
): GamePieceStatusState | undefined {
  const flags = Array.from(new Set(pieceState.flags))
  const powerModifier = pieceState.powerModifier ?? 0
  const criticalModifier = pieceState.criticalModifier ?? 0

  if (
    pieceState.orientation === 'stand' &&
    flags.length === 0 &&
    powerModifier === 0 &&
    criticalModifier === 0
  ) {
    return undefined
  }

  return {
    pieceId: pieceState.pieceId,
    orientation: pieceState.orientation,
    flags,
    ...(powerModifier === 0 ? {} : { powerModifier }),
    ...(criticalModifier === 0 ? {} : { criticalModifier }),
  }
}

function canResolveCurrentCheck(
  state: GameState,
  triggerEvent: Extract<
    GameEvent,
    { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
  >,
  checkKind: BattleCheckKind,
): boolean {
  const battle = state.battle

  return (
    battle !== undefined &&
    battle.battleId === triggerEvent.battleId &&
    battle.lastCheck !== undefined &&
    battle.lastCheck.kind === checkKind &&
    battle.lastCheck.triggerResolutionState === PENDING_TRIGGER_RESOLUTION_STATE
  )
}

function markCurrentCheckResolved(
  state: GameState,
  triggerEvent: Extract<
    GameEvent,
    { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
  >,
  checkKind: BattleCheckKind,
  triggerResolutionState: CheckTriggerResolutionState,
): GameState {
  const battle = state.battle

  if (
    battle === undefined ||
    battle.battleId !== triggerEvent.battleId ||
    battle.lastCheck === undefined ||
    battle.lastCheck.kind !== checkKind ||
    battle.lastCheck.triggerResolutionState !== PENDING_TRIGGER_RESOLUTION_STATE
  ) {
    return state
  }

  const {
    triggerContinuation: _triggerContinuation,
    ...lastCheckWithoutContinuation
  } = battle.lastCheck

  return {
    ...state,
    battle: {
      ...battle,
      lastCheck: {
        ...lastCheckWithoutContinuation,
        triggerResolutionState,
      },
    },
  }
}

function applyTriggerChoiceInterruption(
  state: GameState,
  triggerEvent: Extract<
    GameEvent,
    { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
  >,
  checkKind: BattleCheckKind,
  choicePlan: TriggerChoicePlan,
  queuedRequests: GameState['pendingRequests'],
): GameState {
  const battle = state.battle

  if (
    battle === undefined ||
    battle.battleId !== triggerEvent.battleId ||
    battle.lastCheck === undefined ||
    battle.lastCheck.kind !== checkKind ||
    battle.lastCheck.triggerResolutionState !== PENDING_TRIGGER_RESOLUTION_STATE
  ) {
    return state
  }

  return {
    ...state,
    status: 'awaiting_choice',
    pendingRequests: [choicePlan.request, ...queuedRequests],
    battle: {
      ...battle,
      lastCheck: {
        ...battle.lastCheck,
        triggerResolutionState: AWAITING_TRIGGER_CHOICE_STATE,
        triggerContinuation: choicePlan.continuation,
      },
    },
  }
}

function createSyntheticCheckEventForContinuation(
  transitionId: TransitionId,
  battle: NonNullable<GameState['battle']>,
  lastCheck: NonNullable<NonNullable<GameState['battle']>['lastCheck']>,
  continuation: TriggerResolutionContinuationState,
):
  | Extract<
      GameEvent,
      { readonly type: 'battle.drive_checked' | 'battle.damage_checked' }
    >
  | undefined {
  const common = {
    eventId: createEventId(transitionId, continuation.sourceCheckEventSequence),
    sequence: continuation.sourceCheckEventSequence,
    ...(continuation.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: continuation.sourceActionId,
        }),
    origin: {
      kind: 'system' as const,
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    battleId: battle.battleId,
    playerId: lastCheck.playerId,
    fromZoneId: lastCheck.fromZoneId,
    toZoneId: lastCheck.toZoneId,
    revealedCards: lastCheck.revealedCards,
    triggerResolutionState: PENDING_TRIGGER_RESOLUTION_STATE,
  }

  if (lastCheck.kind === 'drive') {
    return {
      ...common,
      type: 'battle.drive_checked',
    }
  }

  if (battle.damage === undefined) {
    return undefined
  }

  return {
    ...common,
    type: 'battle.damage_checked',
    damage: battle.damage,
  }
}

function createTriggerRevealedEvent(
  context: TriggerResolutionContext,
  input: {
    readonly sequence: number
    readonly sourceCheckEventSequence: number
  },
): Extract<GameEvent, { readonly type: 'trigger.revealed' }> {
  return {
    eventId: createEventId(context.transitionId, input.sequence),
    type: 'trigger.revealed',
    sequence: input.sequence,
    ...(context.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: context.sourceActionId,
        }),
    origin: {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    battleId: context.triggerEvent.battleId,
    checkKind: context.checkKind,
    playerId: context.playerId,
    revealedPieceId: context.revealedPiece.pieceId,
    ...(context.revealedPiece.cardDefinitionId === undefined
      ? {}
      : {
          cardDefinitionId: context.revealedPiece.cardDefinitionId,
        }),
    triggerType: context.triggerType,
    sourceCheckEventSequence: input.sourceCheckEventSequence,
  }
}

function createTriggerResolvedEvent(
  context: TriggerResolutionContext,
  input: {
    readonly sequence: number
    readonly outcome: TriggerResolutionOutcome
    readonly powerAmount?: number
    readonly powerTargetPieceIds?: readonly PieceId[]
    readonly criticalAmount?: number
    readonly criticalTargetPieceId?: PieceId
    readonly drawnPieceIds?: readonly PieceId[]
    readonly stoodPieceId?: PieceId
    readonly healedPieceId?: PieceId
    readonly healCondition?: Extract<
      GameEvent,
      { readonly type: 'trigger.resolved' }
    >['healCondition']
    readonly overTriggerApplied?: boolean
  },
): Extract<GameEvent, { readonly type: 'trigger.resolved' }> {
  return {
    eventId: createEventId(context.transitionId, input.sequence),
    type: 'trigger.resolved',
    sequence: input.sequence,
    ...(context.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: context.sourceActionId,
        }),
    origin: {
      kind: 'system',
      system: AUTOMATIC_FLOW_SYSTEM,
    },
    battleId: context.triggerEvent.battleId,
    checkKind: context.checkKind,
    playerId: context.playerId,
    revealedPieceId: context.revealedPiece.pieceId,
    triggerType: context.triggerType,
    sourceCheckEventSequence: context.triggerEvent.sequence,
    outcome: input.outcome,
    ...(input.powerAmount === undefined
      ? {}
      : {
          powerAmount: input.powerAmount,
        }),
    ...(input.powerTargetPieceIds === undefined
      ? {}
      : {
          powerTargetPieceIds: input.powerTargetPieceIds,
        }),
    ...(input.criticalAmount === undefined
      ? {}
      : {
          criticalAmount: input.criticalAmount,
        }),
    ...(input.criticalTargetPieceId === undefined
      ? {}
      : {
          criticalTargetPieceId: input.criticalTargetPieceId,
        }),
    ...(input.drawnPieceIds === undefined
      ? {}
      : {
          drawnPieceIds: input.drawnPieceIds,
        }),
    ...(input.stoodPieceId === undefined
      ? {}
      : {
          stoodPieceId: input.stoodPieceId,
        }),
    ...(input.healedPieceId === undefined
      ? {}
      : {
          healedPieceId: input.healedPieceId,
        }),
    ...(input.healCondition === undefined
      ? {}
      : {
          healCondition: input.healCondition,
        }),
    ...(input.overTriggerApplied === undefined
      ? {}
      : {
          overTriggerApplied: input.overTriggerApplied,
        }),
  }
}

function createEffectResolvedEvent(input: {
  readonly transitionId: TransitionId
  readonly sequence: number
  readonly sourceActionId?: ActionId
  readonly effectDefinitionId: EffectDefinitionId
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
    effectDefinitionId: input.effectDefinitionId,
    ...(input.triggerEventSequence === undefined
      ? {}
      : {
          triggerEventSequence: input.triggerEventSequence,
        }),
    operationKinds: input.operationKinds,
  }
}

function createNestedTimingWindowsForTriggerEvents(
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

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
