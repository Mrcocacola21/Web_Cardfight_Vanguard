import type {
  ConstructionBasis,
  FormatGameplayMarker,
  FormatId,
} from '@web-vg/shared'

import type { GameActionType } from '../actions'
import {
  createEngineDispatchResult,
  dispatchEngineCommand,
  type EngineCommand,
  type EngineDispatchResult,
} from '../boundary'
import type { TransitionId } from '../contracts'
import type { PendingGameChoiceRequest } from '../requests'
import type { GameState } from '../state'
import {
  createBlockedTransitionResult,
  createInvalidTransitionResult,
  type BlockedTransitionCode,
  type InvalidTransitionCode,
  type TransitionResult,
} from '../transitions'

export interface FormatCommandContext<
  TCommand extends EngineCommand = EngineCommand,
> {
  readonly currentState: GameState
  readonly command: TCommand
}

export interface AllowedFormatCommandDecision {
  readonly status: 'allow'
}

export interface InvalidFormatCommandDecision {
  readonly status: 'invalid'
  readonly code: InvalidTransitionCode
  readonly message: string
}

export interface BlockedFormatCommandDecision {
  readonly status: 'blocked'
  readonly message: string
  readonly code?: BlockedTransitionCode
  readonly blockingRequests?: readonly PendingGameChoiceRequest[]
}

export type FormatCommandDecision =
  | AllowedFormatCommandDecision
  | InvalidFormatCommandDecision
  | BlockedFormatCommandDecision

export interface FormatAdapterDefinition {
  readonly formatId: FormatId
  readonly constructionBasis: ConstructionBasis
  readonly gameplayMarkers: readonly FormatGameplayMarker[]
  readonly supportedActionTypes: readonly GameActionType[]
  evaluateCommand?(context: FormatCommandContext): FormatCommandDecision
  handleCommand?(context: FormatCommandContext): TransitionResult | undefined
}

export interface RulesFormatAdapter {
  readonly formatId: FormatId
  readonly constructionBasis: ConstructionBasis
  readonly gameplayMarkers: readonly FormatGameplayMarker[]
  readonly supportedActionTypes: readonly GameActionType[]
  dispatch(
    currentState: GameState,
    command: EngineCommand,
  ): EngineDispatchResult
}

const ALLOW_FORMAT_COMMAND_DECISION: AllowedFormatCommandDecision = {
  status: 'allow',
}

export function createRulesFormatAdapter(
  definition: FormatAdapterDefinition,
): RulesFormatAdapter {
  return {
    formatId: definition.formatId,
    constructionBasis: definition.constructionBasis,
    gameplayMarkers: definition.gameplayMarkers,
    supportedActionTypes: definition.supportedActionTypes,
    dispatch(currentState, command) {
      return dispatchFormatCommand(definition, currentState, command)
    },
  }
}

export function dispatchFormatCommand(
  definition: FormatAdapterDefinition,
  currentState: GameState,
  command: EngineCommand,
): EngineDispatchResult {
  const transitionId = createFormatTransitionId(
    definition.formatId,
    command,
    currentState.revision,
  )

  if (currentState.formatId !== definition.formatId) {
    return createEngineDispatchResult(
      createInvalidTransitionResult(
        transitionId,
        currentState,
        'format_mismatch',
        `Format adapter ${definition.formatId} cannot dispatch game state ${currentState.gameId} with format ${currentState.formatId}.`,
        { inputKind: command.kind },
      ),
    )
  }

  if (
    command.kind === 'action' &&
    !definition.supportedActionTypes.includes(command.submission.action.type)
  ) {
    return createEngineDispatchResult(
      createInvalidTransitionResult(
        transitionId,
        currentState,
        'unsupported_action',
        `Format ${definition.formatId} does not expose action ${command.submission.action.type} through this adapter yet.`,
        { inputKind: 'action' },
      ),
    )
  }

  const decision =
    definition.evaluateCommand?.({
      currentState,
      command,
    }) ?? ALLOW_FORMAT_COMMAND_DECISION

  if (decision.status === 'invalid') {
    return createEngineDispatchResult(
      createInvalidTransitionResult(
        transitionId,
        currentState,
        decision.code,
        decision.message,
        { inputKind: command.kind },
      ),
    )
  }

  if (decision.status === 'blocked') {
    return createEngineDispatchResult(
      createBlockedTransitionResult(
        transitionId,
        currentState,
        decision.blockingRequests ?? currentState.pendingRequests,
        decision.message,
        {
          ...(decision.code === undefined ? {} : { code: decision.code }),
          inputKind: command.kind,
        },
      ),
    )
  }

  const handledTransition = definition.handleCommand?.({
    currentState,
    command,
  })

  if (handledTransition !== undefined) {
    return createEngineDispatchResult(handledTransition)
  }

  return dispatchEngineCommand(currentState, command)
}

function createFormatTransitionId(
  formatId: FormatId,
  command: EngineCommand,
  revision: GameState['revision'],
): TransitionId {
  return command.kind === 'action'
    ? (`transition:format:${formatId}:action:${command.submission.action.actionId}:r${revision}` as TransitionId)
    : (`transition:format:${formatId}:choice:${command.submission.response.requestId}:r${revision}` as TransitionId)
}
