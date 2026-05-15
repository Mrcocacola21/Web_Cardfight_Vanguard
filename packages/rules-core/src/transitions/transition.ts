import type { GameAction, GameActionSubmission } from '../actions'
import type { BattleId, PieceId, RequestId, TransitionId } from '../contracts'
import { assertRulesInvariant } from '../errors'
import type { GameEvent } from '../events'
import type { GameChoiceResponse, PendingGameChoiceRequest } from '../requests'
import { assertGameStateInvariant, type GameState } from '../state'

export type TransitionRequestKind = 'action' | 'choice_response'
export type TransitionResultStatus = 'applied' | 'invalid' | 'blocked'
export type EffectTimingWindow = 'before' | 'on' | 'after'
export type EffectTimingPoint =
  | 'card.ride'
  | 'zone.transfer'
  | 'choice.response'
  | 'battle.attack'
  | 'battle.boost'
  | 'battle.guard'
  | 'battle.drive_check'
  | 'battle.combat'
  | 'battle.damage_check'
  | 'battle.completion'

export type InvalidTransitionCode =
  | 'revision_mismatch'
  | 'unsupported_action'
  | 'invalid_action'
  | 'invalid_action_reference'
  | 'invalid_response'
  | 'request_not_pending'
  | 'request_response_mismatch'
  | (string & {})

export type BlockedTransitionCode = 'pending_request' | (string & {})

export interface GameChoiceResponseSubmission<
  TResponse extends GameChoiceResponse = GameChoiceResponse,
> {
  readonly response: TResponse
  readonly expectedRevision?: number
}

export interface TransitionTimingWindow {
  readonly sequence: number
  readonly window: EffectTimingWindow
  readonly point: EffectTimingPoint
  readonly relatedEventSequence?: number
  readonly battleId?: BattleId
  readonly pieceId?: PieceId
  readonly requestId?: RequestId
}

export interface ActionTransitionInput<
  TAction extends GameAction = GameAction,
> {
  readonly kind: 'action'
  readonly currentState: GameState
  readonly submission: GameActionSubmission<TAction>
}

export interface ChoiceResponseTransitionInput<
  TResponse extends GameChoiceResponse = GameChoiceResponse,
> {
  readonly kind: 'choice_response'
  readonly currentState: GameState
  readonly submission: GameChoiceResponseSubmission<TResponse>
}

export type TransitionInput =
  | ActionTransitionInput
  | ChoiceResponseTransitionInput

interface TransitionResultBase {
  readonly transitionId: TransitionId
  readonly inputKind: TransitionRequestKind
  readonly events: readonly GameEvent[]
  readonly timingWindows: readonly TransitionTimingWindow[]
  readonly pendingRequests: readonly PendingGameChoiceRequest[]
}

export interface AppliedTransitionResult extends TransitionResultBase {
  readonly status: 'applied'
  readonly nextState: GameState
}

export interface InvalidTransitionResult extends TransitionResultBase {
  readonly status: 'invalid'
  readonly currentState: GameState
  readonly code: InvalidTransitionCode
  readonly message: string
}

export interface BlockedTransitionResult extends TransitionResultBase {
  readonly status: 'blocked'
  readonly currentState: GameState
  readonly code: BlockedTransitionCode
  readonly message: string
  readonly blockingRequests: readonly PendingGameChoiceRequest[]
}

export type TransitionResult =
  | AppliedTransitionResult
  | InvalidTransitionResult
  | BlockedTransitionResult

export interface StateTransition<TAction extends GameAction = GameAction> {
  readonly id: TransitionId
  readonly actionType: TAction['type']
  apply(input: ActionTransitionInput<TAction>): TransitionResult
}

function assertExpectedRevision(
  expectedRevision: number | undefined,
  currentState: GameState,
  label: string,
): void {
  if (expectedRevision === undefined) {
    return
  }

  assertRulesInvariant(
    expectedRevision === currentState.revision,
    `${label} revision ${expectedRevision} does not match game state revision ${currentState.revision}.`,
  )
}

export function assertActionSubmissionRevision(
  submission: GameActionSubmission,
  currentState: GameState,
): void {
  assertExpectedRevision(
    submission.expectedRevision,
    currentState,
    'Action submission',
  )
}

export function assertChoiceResponseSubmissionRevision(
  submission: GameChoiceResponseSubmission,
  currentState: GameState,
): void {
  assertExpectedRevision(
    submission.expectedRevision,
    currentState,
    'Choice response submission',
  )
}

export function advanceGameStateRevision(currentState: GameState): GameState {
  assertRulesInvariant(
    Number.isSafeInteger(currentState.revision) && currentState.revision >= 0,
    'Game state revisions must be non-negative safe integers.',
  )
  assertRulesInvariant(
    currentState.revision < Number.MAX_SAFE_INTEGER,
    'Game state revision cannot exceed Number.MAX_SAFE_INTEGER.',
  )

  return {
    ...currentState,
    revision: currentState.revision + 1,
  }
}

export function createTransitionResult(
  transitionId: TransitionId,
  nextState: GameState,
  events: readonly GameEvent[] = [],
  options: {
    readonly inputKind?: TransitionRequestKind
    readonly timingWindows?: readonly TransitionTimingWindow[]
  } = {},
): AppliedTransitionResult {
  assertTransitionEventsAreOrdered(events)
  assertTransitionTimingWindowsAreOrdered(options.timingWindows ?? [])
  assertRulesInvariant(
    Number.isSafeInteger(nextState.revision) && nextState.revision >= 0,
    'Game state revisions must be non-negative safe integers.',
  )
  assertGameStateInvariant(nextState)

  return {
    transitionId,
    inputKind: options.inputKind ?? 'action',
    status: 'applied',
    nextState,
    events,
    timingWindows: options.timingWindows ?? [],
    pendingRequests: nextState.pendingRequests,
  }
}

export function createInvalidTransitionResult(
  transitionId: TransitionId,
  currentState: GameState,
  code: InvalidTransitionCode,
  message: string,
  options: { readonly inputKind?: TransitionRequestKind } = {},
): InvalidTransitionResult {
  return {
    transitionId,
    inputKind: options.inputKind ?? 'action',
    status: 'invalid',
    currentState,
    code,
    message,
    events: [],
    timingWindows: [],
    pendingRequests: currentState.pendingRequests,
  }
}

export function createBlockedTransitionResult(
  transitionId: TransitionId,
  currentState: GameState,
  blockingRequests: readonly PendingGameChoiceRequest[],
  message: string,
  options: {
    readonly code?: BlockedTransitionCode
    readonly inputKind?: TransitionRequestKind
  } = {},
): BlockedTransitionResult {
  assertRulesInvariant(
    blockingRequests.length > 0,
    'Blocked transitions must declare at least one blocking request.',
  )

  return {
    transitionId,
    inputKind: options.inputKind ?? 'action',
    status: 'blocked',
    currentState,
    code: options.code ?? 'pending_request',
    message,
    blockingRequests,
    events: [],
    timingWindows: [],
    pendingRequests: currentState.pendingRequests,
  }
}

export function isAppliedTransitionResult(
  result: TransitionResult,
): result is AppliedTransitionResult {
  return result.status === 'applied'
}

export function isInvalidTransitionResult(
  result: TransitionResult,
): result is InvalidTransitionResult {
  return result.status === 'invalid'
}

export function isBlockedTransitionResult(
  result: TransitionResult,
): result is BlockedTransitionResult {
  return result.status === 'blocked'
}

export function createTransitionTimingWindowTriplet(
  point: EffectTimingPoint,
  options: {
    readonly startingSequence?: number
    readonly relatedEventSequence?: number
    readonly battleId?: BattleId
    readonly pieceId?: PieceId
    readonly requestId?: RequestId
  } = {},
): readonly TransitionTimingWindow[] {
  const startingSequence = options.startingSequence ?? 0
  const base = {
    point,
    ...(options.relatedEventSequence === undefined
      ? {}
      : {
          relatedEventSequence: options.relatedEventSequence,
        }),
    ...(options.battleId === undefined
      ? {}
      : {
          battleId: options.battleId,
        }),
    ...(options.pieceId === undefined
      ? {}
      : {
          pieceId: options.pieceId,
        }),
    ...(options.requestId === undefined
      ? {}
      : {
          requestId: options.requestId,
        }),
  }

  return [
    {
      ...base,
      sequence: startingSequence,
      window: 'before',
    },
    {
      ...base,
      sequence: startingSequence + 1,
      window: 'on',
    },
    {
      ...base,
      sequence: startingSequence + 2,
      window: 'after',
    },
  ]
}

function assertTransitionEventsAreOrdered(events: readonly GameEvent[]): void {
  let previousSequence = -1
  const eventIds = new Set<string>()

  for (const event of events) {
    assertRulesInvariant(
      Number.isSafeInteger(event.sequence) && event.sequence >= 0,
      'Transition events must have non-negative safe-integer sequence numbers.',
    )
    assertRulesInvariant(
      event.sequence > previousSequence,
      'Transition events must be provided in strictly increasing sequence order.',
    )
    assertRulesInvariant(
      !eventIds.has(event.eventId),
      'Transition events must not contain duplicate event ids.',
    )

    previousSequence = event.sequence
    eventIds.add(event.eventId)
  }
}

function assertTransitionTimingWindowsAreOrdered(
  timingWindows: readonly TransitionTimingWindow[],
): void {
  let previousSequence = -1

  for (const timingWindow of timingWindows) {
    assertRulesInvariant(
      Number.isSafeInteger(timingWindow.sequence) && timingWindow.sequence >= 0,
      'Transition timing windows must have non-negative safe-integer sequence numbers.',
    )
    assertRulesInvariant(
      timingWindow.sequence > previousSequence,
      'Transition timing windows must be provided in strictly increasing sequence order.',
    )

    previousSequence = timingWindow.sequence
  }
}
