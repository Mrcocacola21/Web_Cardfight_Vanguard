import type {
  ConstructionBasis,
  FormatGameplayMarker,
  FormatId,
} from '@web-vg/shared'

import type { GameAction, GameActionSubmission } from '../actions'
import type { ActionId, EventId, PieceId, TransitionId } from '../contracts'
import { RulesInvariantError } from '../errors'
import {
  assertActionSubmissionRevision,
  createBlockedTransitionResult,
  createInvalidTransitionResult,
  type TransitionResult,
} from '../transitions'
import type {
  GamePieceState,
  GameState,
  PlayerState,
  ZoneState,
} from '../state'

type FormatPlayerCardAction = Extract<
  GameAction,
  {
    readonly actionId: ActionId
    readonly actor: {
      readonly kind: 'player'
      readonly playerId: PlayerState['playerId']
    }
    readonly pieceId: PieceId
  }
>

export interface PreparedFormatPlayerCardAction<
  TAction extends FormatPlayerCardAction,
> {
  readonly transitionId: TransitionId
  readonly action: TAction
  readonly actingPlayer: PlayerState
  readonly piece: GamePieceState & { readonly kind: 'card' }
}

export type FormatPlayerCardActionPreparationResult<
  TAction extends FormatPlayerCardAction,
> =
  | {
      readonly ok: true
      readonly value: PreparedFormatPlayerCardAction<TAction>
    }
  | {
      readonly ok: false
      readonly result: TransitionResult
    }

export interface FormatAdapterMetadata {
  readonly constructionBasis: ConstructionBasis
  readonly gameplayMarkers: readonly FormatGameplayMarker[]
}

export interface PrepareFormatPlayerCardActionOptions {
  readonly requiredStatus?: GameState['status']
}

export function createFormatActionTransitionId(
  formatId: FormatId,
  actionId: ActionId,
  revision: GameState['revision'],
): TransitionId {
  return `transition:format:${formatId}:action:${actionId}:r${revision}` as TransitionId
}

export function createFormatEventId(
  transitionId: TransitionId,
  sequence: number,
): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}

export function prepareFormatPlayerCardAction<
  TAction extends FormatPlayerCardAction,
>(
  formatId: FormatId,
  currentState: GameState,
  submission: GameActionSubmission<TAction>,
  options: PrepareFormatPlayerCardActionOptions = {},
): FormatPlayerCardActionPreparationResult<TAction> {
  const action = submission.action
  const transitionId = createFormatActionTransitionId(
    formatId,
    action.actionId,
    currentState.revision,
  )

  if (
    !isRevisionCompatible(() =>
      assertActionSubmissionRevision(submission, currentState),
    )
  ) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'revision_mismatch',
        `Action submission revision ${submission.expectedRevision} does not match game state revision ${currentState.revision}.`,
      ),
    }
  }

  const blockingRequest = currentState.pendingRequests[0]

  if (blockingRequest !== undefined) {
    return {
      ok: false,
      result: createBlockedTransitionResult(
        transitionId,
        currentState,
        currentState.pendingRequests,
        `Game state is waiting for request ${blockingRequest.requestId} before action ${action.type} can be applied.`,
      ),
    }
  }

  const requiredStatus = options.requiredStatus ?? 'in_progress'

  if (currentState.status !== requiredStatus) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} requires the match to be in ${requiredStatus} state.`,
      ),
    }
  }

  if (currentState.battle !== undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action',
        `Action ${action.type} cannot be applied while battle ${currentState.battle.battleId} is active.`,
      ),
    }
  }

  const actingPlayer = currentState.players.find(
    (player) => player.playerId === action.actor.playerId,
  )

  if (actingPlayer === undefined) {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} references an unknown player ${action.actor.playerId}.`,
      ),
    }
  }

  const piece = currentState.pieces.find(
    (candidate) => candidate.pieceId === action.pieceId,
  )

  if (piece === undefined || piece.kind !== 'card') {
    return {
      ok: false,
      result: createInvalidTransitionResult(
        transitionId,
        currentState,
        'invalid_action_reference',
        `Action ${action.type} requires a runtime card piece ${action.pieceId}.`,
      ),
    }
  }

  return {
    ok: true,
    value: {
      transitionId,
      action,
      actingPlayer,
      piece: piece as GamePieceState & { readonly kind: 'card' },
    },
  }
}

export function findOwnedZoneByKind(
  currentState: GameState,
  player: PlayerState,
  kind: ZoneState['kind'],
  zoneId?: ZoneState['zoneId'],
): ZoneState | undefined {
  return currentState.zones.find(
    (zone) =>
      zone.ownerPlayerId === player.playerId &&
      zone.kind === kind &&
      (zoneId === undefined || zone.zoneId === zoneId),
  )
}

function isRevisionCompatible(check: () => void): boolean {
  try {
    check()
    return true
  } catch (error) {
    if (error instanceof RulesInvariantError) {
      return false
    }

    throw error
  }
}
