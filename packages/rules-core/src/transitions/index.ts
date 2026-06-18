export {
  applyActivateCardEffectTransition,
  applyActivatedEffectChoiceResponseTransition,
} from './activated-effects'
export type { ActivatedEffectRuntimeEnvironment } from './activated-effects'
export {
  applyGameAction,
  applyGameChoiceResponse,
  reduceGameState,
} from './reducer'
export type { RuntimeTransitionOptions } from './reducer'
export {
  PREGAME_PHASE,
  TURN_PHASE_BATTLE,
  TURN_PHASE_DRAW,
  TURN_PHASE_END,
  TURN_PHASE_MAIN,
  TURN_PHASE_RIDE,
  TURN_PHASE_STAND,
  VANGUARD_TURN_PHASES,
  isTurnLifecyclePhase,
  resolveNextTurnPhase,
} from './turn-structure'
export {
  advanceGameStateRevision,
  assertActionSubmissionRevision,
  assertChoiceResponseSubmissionRevision,
  createBlockedTransitionResult,
  createInvalidTransitionResult,
  createTransitionResult,
  createTransitionTimingWindowTriplet,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from './transition'
export type {
  ActionTransitionInput,
  AppliedTransitionResult,
  BlockedTransitionCode,
  BlockedTransitionResult,
  ChoiceResponseTransitionInput,
  EffectTimingPoint,
  EffectTimingWindow,
  GameChoiceResponseSubmission,
  InvalidTransitionCode,
  InvalidTransitionResult,
  StateTransition,
  TransitionInput,
  TransitionTimingWindow,
  TransitionRequestKind,
  TransitionResult,
  TransitionResultStatus,
} from './transition'
