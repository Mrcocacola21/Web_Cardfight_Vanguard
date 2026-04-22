import type { ActionId, PieceId, PlayerId, ZoneId } from '../contracts'
import type { AttackTarget, ZoneLocationReference } from '../references'
import type { PhaseId, StepId } from '../state'

export type SystemActionSource =
  | 'rules-engine'
  | 'match-setup'
  | 'automatic-flow'
  | (string & {})

export interface PlayerActionActor {
  readonly kind: 'player'
  readonly playerId: PlayerId
}

export interface SystemActionActor {
  readonly kind: 'system'
  readonly system: SystemActionSource
}

export type ActionActor = PlayerActionActor | SystemActionActor

export type AutomaticFlowScope =
  | 'match'
  | 'turn'
  | 'battle'
  | 'resolution'
  | (string & {})

export type PlayerGameActionType =
  | 'match.ready'
  | 'match.concede'
  | 'turn.pass_priority'
  | 'turn.end_phase'
  | 'turn.end_turn'
  | 'card.play'
  | 'card.ride'
  | 'card.call'
  | 'battle.declare_attack'
  | 'battle.guard'

export type SystemGameActionType =
  | 'match.start'
  | 'system.advance_phase'
  | 'system.advance_step'
  | 'system.resolve_mandatory_flow'
  | 'zone.move_piece'

export type GameActionType = PlayerGameActionType | SystemGameActionType
export type ActionType = GameActionType

interface PlayerGameActionBase<TType extends PlayerGameActionType> {
  readonly actionId: ActionId
  readonly type: TType
  readonly actor: PlayerActionActor
}

interface SystemGameActionBase<TType extends SystemGameActionType> {
  readonly actionId: ActionId
  readonly type: TType
  readonly actor: SystemActionActor
}

export type MatchReadyAction = PlayerGameActionBase<'match.ready'>

export type MatchConcedeAction = PlayerGameActionBase<'match.concede'>

export type MatchStartAction = SystemGameActionBase<'match.start'>

export type TurnPassPriorityAction = PlayerGameActionBase<'turn.pass_priority'>

export type TurnEndPhaseAction = PlayerGameActionBase<'turn.end_phase'>

export type TurnEndTurnAction = PlayerGameActionBase<'turn.end_turn'>

export interface MovePieceAction extends SystemGameActionBase<'zone.move_piece'> {
  readonly pieceId: PieceId
  readonly from: ZoneLocationReference
  readonly to: ZoneLocationReference
}

interface PieceCommitActionFields {
  readonly pieceId: PieceId
  readonly from: ZoneLocationReference
  readonly to: ZoneLocationReference
}

export interface PlayCardAction
  extends PlayerGameActionBase<'card.play'>, PieceCommitActionFields {}

export interface RideCardAction
  extends PlayerGameActionBase<'card.ride'>, PieceCommitActionFields {
  readonly ridingOverPieceId?: PieceId
}

export interface CallCardAction
  extends PlayerGameActionBase<'card.call'>, PieceCommitActionFields {}

export interface DeclareAttackAction extends PlayerGameActionBase<'battle.declare_attack'> {
  readonly attackerPieceId: PieceId
  readonly target: AttackTarget
}

export interface GuardAction extends PlayerGameActionBase<'battle.guard'> {
  readonly guardianPieceIds: readonly PieceId[]
  readonly fromZoneId: ZoneId
  readonly againstAttackerPieceId: PieceId
}

export interface AdvancePhaseAction extends SystemGameActionBase<'system.advance_phase'> {
  readonly nextPhase: PhaseId
}

export interface AdvanceStepAction extends SystemGameActionBase<'system.advance_step'> {
  readonly phase: PhaseId
  readonly nextStep: StepId
}

export interface ResolveMandatoryFlowAction extends SystemGameActionBase<'system.resolve_mandatory_flow'> {
  readonly scope: AutomaticFlowScope
}

export type MatchAction =
  | MatchReadyAction
  | MatchConcedeAction
  | MatchStartAction

export type TurnFlowAction =
  | TurnPassPriorityAction
  | TurnEndPhaseAction
  | TurnEndTurnAction
  | AdvancePhaseAction
  | AdvanceStepAction
  | ResolveMandatoryFlowAction

export type ZoneAction = MovePieceAction

export type CardAction = PlayCardAction | RideCardAction | CallCardAction

export type BattleAction = DeclareAttackAction | GuardAction

export type PlayerGameAction =
  | MatchReadyAction
  | MatchConcedeAction
  | TurnPassPriorityAction
  | TurnEndPhaseAction
  | TurnEndTurnAction
  | PlayCardAction
  | RideCardAction
  | CallCardAction
  | DeclareAttackAction
  | GuardAction

export type SystemGameAction =
  | MatchStartAction
  | MovePieceAction
  | AdvancePhaseAction
  | AdvanceStepAction
  | ResolveMandatoryFlowAction

export type GameAction = PlayerGameAction | SystemGameAction

export interface GameActionSubmission<TAction extends GameAction = GameAction> {
  readonly action: TAction
  readonly expectedRevision?: number
}

export function isPlayerGameAction(
  action: GameAction,
): action is PlayerGameAction {
  return action.actor.kind === 'player'
}

export function isSystemGameAction(
  action: GameAction,
): action is SystemGameAction {
  return action.actor.kind === 'system'
}
