export {
  applyGameAction,
  applyGameChoiceResponse,
  reduceGameState,
} from './reducer'
export {
  advanceGameStateRevision,
  assertActionSubmissionRevision,
  assertChoiceResponseSubmissionRevision,
  createBlockedTransitionResult,
  createInvalidTransitionResult,
  createTransitionResult,
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
  GameChoiceResponseSubmission,
  InvalidTransitionCode,
  InvalidTransitionResult,
  StateTransition,
  TransitionInput,
  TransitionRequestKind,
  TransitionResult,
  TransitionResultStatus,
} from './transition'
