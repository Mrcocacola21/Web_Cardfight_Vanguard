import type { GameAction, GameActionSubmission } from '../actions'
import type { TransitionId } from '../contracts'
import type { GameEvent } from '../events'
import type { GameChoiceResponse, PendingGameChoiceRequest } from '../requests'
import type { GameState } from '../state'
import {
  applyGameAction,
  applyGameChoiceResponse,
  type BlockedTransitionCode,
  type GameChoiceResponseSubmission,
  type InvalidTransitionCode,
  type TransitionTimingWindow,
  type TransitionResult,
} from '../transitions'

export type EngineCommandKind = 'action' | 'choice_response'

export interface EngineActionCommand<TAction extends GameAction = GameAction> {
  readonly kind: 'action'
  readonly submission: GameActionSubmission<TAction>
}

export interface EngineChoiceResponseCommand<
  TResponse extends GameChoiceResponse = GameChoiceResponse,
> {
  readonly kind: 'choice_response'
  readonly submission: GameChoiceResponseSubmission<TResponse>
}

export type EngineCommand = EngineActionCommand | EngineChoiceResponseCommand

interface EngineDispatchResultBase<TStatus extends EngineDispatchStatus> {
  readonly status: TStatus
  readonly transitionId: TransitionId
  readonly state: GameState
  readonly events: readonly GameEvent[]
  readonly timingWindows: readonly TransitionTimingWindow[]
  readonly pendingRequests: readonly PendingGameChoiceRequest[]
}

export type AcceptedEngineDispatchResult = EngineDispatchResultBase<'accepted'>

export interface InvalidEngineDispatchResult extends EngineDispatchResultBase<'invalid'> {
  readonly code: InvalidTransitionCode
  readonly message: string
}

export interface BlockedEngineDispatchResult extends EngineDispatchResultBase<'blocked'> {
  readonly code: BlockedTransitionCode
  readonly message: string
  readonly blockingRequests: readonly PendingGameChoiceRequest[]
}

export type EngineDispatchStatus = 'accepted' | 'invalid' | 'blocked'

export type EngineDispatchResult =
  | AcceptedEngineDispatchResult
  | InvalidEngineDispatchResult
  | BlockedEngineDispatchResult

export interface RulesEngineBoundary {
  dispatch(
    currentState: GameState,
    command: EngineCommand,
  ): EngineDispatchResult
}

export function dispatchEngineCommand(
  currentState: GameState,
  command: EngineCommand,
): EngineDispatchResult {
  return createEngineDispatchResult(
    command.kind === 'action'
      ? applyGameAction(currentState, command.submission)
      : applyGameChoiceResponse(currentState, command.submission),
  )
}

export function createEngineDispatchResult(
  transitionResult: TransitionResult,
): EngineDispatchResult {
  switch (transitionResult.status) {
    case 'applied':
      return {
        status: 'accepted',
        transitionId: transitionResult.transitionId,
        state: transitionResult.nextState,
        events: transitionResult.events,
        timingWindows: transitionResult.timingWindows,
        pendingRequests: transitionResult.pendingRequests,
      }
    case 'invalid':
      return {
        status: 'invalid',
        transitionId: transitionResult.transitionId,
        state: transitionResult.currentState,
        events: transitionResult.events,
        timingWindows: transitionResult.timingWindows,
        pendingRequests: transitionResult.pendingRequests,
        code: transitionResult.code,
        message: transitionResult.message,
      }
    case 'blocked':
      return {
        status: 'blocked',
        transitionId: transitionResult.transitionId,
        state: transitionResult.currentState,
        events: transitionResult.events,
        timingWindows: transitionResult.timingWindows,
        pendingRequests: transitionResult.pendingRequests,
        code: transitionResult.code,
        message: transitionResult.message,
        blockingRequests: transitionResult.blockingRequests,
      }
  }
}

export function isAcceptedEngineDispatchResult(
  result: EngineDispatchResult,
): result is AcceptedEngineDispatchResult {
  return result.status === 'accepted'
}

export function isInvalidEngineDispatchResult(
  result: EngineDispatchResult,
): result is InvalidEngineDispatchResult {
  return result.status === 'invalid'
}

export function isBlockedEngineDispatchResult(
  result: EngineDispatchResult,
): result is BlockedEngineDispatchResult {
  return result.status === 'blocked'
}

export const rulesEngineBoundary: RulesEngineBoundary = {
  dispatch: dispatchEngineCommand,
}
