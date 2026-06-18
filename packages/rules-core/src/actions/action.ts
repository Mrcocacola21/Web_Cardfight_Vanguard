import type {
  ActionId,
  BattleId,
  EffectDefinitionId,
  PieceId,
  PlayerId,
  ZoneId,
} from '../contracts'
import type { AttackTarget, ZoneLocationReference } from '../references'
import type { PhaseId, StepId } from '../state'
import type { ZoneTransferReason } from '../transfers'

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

export type MatchTimeoutReason =
  | 'request_timeout'
  | 'turn_timeout'
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
  | 'card.activate_effect'
  | 'battle.declare_attack'
  | 'battle.commit_boost'
  | 'battle.guard'

export type SystemGameActionType =
  | 'match.start'
  | 'match.timeout'
  | 'system.begin_mulligan'
  | 'system.drive_check'
  | 'system.resolve_combat'
  | 'system.damage_check'
  | 'piece.rest'
  | 'piece.stand'
  | 'piece.lock'
  | 'piece.unlock'
  | 'system.advance_phase'
  | 'system.advance_step'
  | 'system.resolve_mandatory_flow'
  | 'zone.shuffle'
  | 'zone.draw'
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

export interface MatchTimeoutAction extends SystemGameActionBase<'match.timeout'> {
  readonly playerId: PlayerId
  readonly reason: MatchTimeoutReason
}

export interface BeginMulliganAction extends SystemGameActionBase<'system.begin_mulligan'> {
  readonly playerId: PlayerId
  readonly handZoneId: ZoneId
  readonly deckZoneId: ZoneId
}

export type TurnPassPriorityAction = PlayerGameActionBase<'turn.pass_priority'>

export type TurnEndPhaseAction = PlayerGameActionBase<'turn.end_phase'>

export type TurnEndTurnAction = PlayerGameActionBase<'turn.end_turn'>

export interface MovePieceAction extends SystemGameActionBase<'zone.move_piece'> {
  readonly pieceId: PieceId
  readonly from: ZoneLocationReference
  readonly to: ZoneLocationReference
  readonly reason: ZoneTransferReason
}

export interface ShuffleZoneAction extends SystemGameActionBase<'zone.shuffle'> {
  readonly zoneId: ZoneId
  readonly orderedPieceIds: readonly PieceId[]
}

export interface DrawCardsAction extends SystemGameActionBase<'zone.draw'> {
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly count: number
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

export interface ActivateCardEffectAction extends PlayerGameActionBase<'card.activate_effect'> {
  readonly sourcePieceId: PieceId
  readonly effectDefinitionId: EffectDefinitionId
}

export interface DeclareAttackAction extends PlayerGameActionBase<'battle.declare_attack'> {
  readonly attackerPieceId: PieceId
  readonly target: AttackTarget
}

export interface CommitBoostAction extends PlayerGameActionBase<'battle.commit_boost'> {
  readonly attackerPieceId: PieceId
  readonly boosterPieceId: PieceId
}

export interface GuardAction extends PlayerGameActionBase<'battle.guard'> {
  readonly againstAttackerPieceId: PieceId
}

export interface DriveCheckAction extends SystemGameActionBase<'system.drive_check'> {
  readonly battleId: BattleId
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly count: number
}

export interface ResolveCombatAction extends SystemGameActionBase<'system.resolve_combat'> {
  readonly battleId: BattleId
}

export interface DamageCheckAction extends SystemGameActionBase<'system.damage_check'> {
  readonly battleId: BattleId
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly count: number
}

interface PieceStateActionFields {
  readonly pieceId: PieceId
}

export interface RestPieceAction
  extends SystemGameActionBase<'piece.rest'>, PieceStateActionFields {}

export interface StandPieceAction
  extends SystemGameActionBase<'piece.stand'>, PieceStateActionFields {}

export interface LockPieceAction
  extends SystemGameActionBase<'piece.lock'>, PieceStateActionFields {}

export interface UnlockPieceAction
  extends SystemGameActionBase<'piece.unlock'>, PieceStateActionFields {}

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
  | MatchTimeoutAction
  | BeginMulliganAction

export type TurnFlowAction =
  | TurnPassPriorityAction
  | TurnEndPhaseAction
  | TurnEndTurnAction
  | DriveCheckAction
  | ResolveCombatAction
  | DamageCheckAction
  | RestPieceAction
  | StandPieceAction
  | LockPieceAction
  | UnlockPieceAction
  | AdvancePhaseAction
  | AdvanceStepAction
  | ResolveMandatoryFlowAction

export type ZoneAction = MovePieceAction | ShuffleZoneAction | DrawCardsAction

export type CardAction =
  | PlayCardAction
  | RideCardAction
  | CallCardAction
  | ActivateCardEffectAction

export type BattleAction = DeclareAttackAction | CommitBoostAction | GuardAction

export type PlayerGameAction =
  | MatchReadyAction
  | MatchConcedeAction
  | TurnPassPriorityAction
  | TurnEndPhaseAction
  | TurnEndTurnAction
  | PlayCardAction
  | RideCardAction
  | CallCardAction
  | ActivateCardEffectAction
  | DeclareAttackAction
  | CommitBoostAction
  | GuardAction

export type SystemGameAction =
  | MatchStartAction
  | MatchTimeoutAction
  | BeginMulliganAction
  | DriveCheckAction
  | ResolveCombatAction
  | DamageCheckAction
  | RestPieceAction
  | StandPieceAction
  | LockPieceAction
  | UnlockPieceAction
  | MovePieceAction
  | ShuffleZoneAction
  | DrawCardsAction
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
