import type { FormatId } from '@web-vg/shared'

import type {
  CallCardAction,
  GameActionType,
  RideCardAction,
} from '../../actions'
import type { EngineCommand, EngineDispatchResult } from '../../boundary'
import type { GameState } from '../../state'

import {
  createRulesFormatAdapter,
  type FormatCommandContext,
  type FormatCommandDecision,
} from '../adapter'
import { findZoneById, rejectZoneKindReferences } from '../shared'

export const STANDARD_FORMAT_ID = 'standard' as FormatId

export const STANDARD_FORMAT_GAMEPLAY_MARKERS = [
  'ride-deck',
  'overdress',
  'over-trigger',
] as const

export const STANDARD_ZONE_KINDS = {
  rideDeck: 'ride_deck',
  vanguardCircle: 'vanguard_circle',
  soul: 'soul',
} as const

export type StandardZoneKind =
  (typeof STANDARD_ZONE_KINDS)[keyof typeof STANDARD_ZONE_KINDS]

export const STANDARD_FORMAT_ACTION_TYPES = [
  'match.ready',
  'match.start',
  'match.concede',
  'system.begin_mulligan',
  'system.drive_check',
  'system.resolve_combat',
  'system.damage_check',
  'piece.rest',
  'piece.stand',
  'piece.lock',
  'piece.unlock',
  'turn.end_phase',
  'turn.end_turn',
  'system.advance_phase',
  'system.resolve_mandatory_flow',
  'zone.shuffle',
  'zone.draw',
  'zone.move_piece',
  'card.call',
  'card.ride',
  'battle.declare_attack',
  'battle.commit_boost',
  'battle.guard',
] as const satisfies readonly GameActionType[]

export const standardFormatAdapter = createRulesFormatAdapter({
  formatId: STANDARD_FORMAT_ID,
  constructionBasis: 'nation-based',
  gameplayMarkers: STANDARD_FORMAT_GAMEPLAY_MARKERS,
  supportedActionTypes: STANDARD_FORMAT_ACTION_TYPES,
  evaluateCommand: evaluateStandardCommand,
})

export function dispatchStandardCommand(
  currentState: GameState,
  command: EngineCommand,
): EngineDispatchResult {
  return standardFormatAdapter.dispatch(currentState, command)
}

function evaluateStandardCommand(
  context: FormatCommandContext,
): FormatCommandDecision {
  if (context.command.kind !== 'action') {
    return { status: 'allow' }
  }

  switch (context.command.submission.action.type) {
    case 'card.call':
      return evaluateStandardCallAction(
        context.currentState,
        context.command.submission.action,
      )
    case 'card.ride':
      return evaluateStandardRideAction(
        context.currentState,
        context.command.submission.action,
      )
    default:
      return { status: 'allow' }
  }
}

function evaluateStandardCallAction(
  currentState: GameState,
  action: CallCardAction,
): FormatCommandDecision {
  return (
    rejectZoneKindReferences(currentState, action, {
      rejectedZoneKinds: [STANDARD_ZONE_KINDS.rideDeck],
      message: ({ action: rejectedAction }) =>
        `Standard adapter does not allow ${rejectedAction.type} to move cards into or out of the ride deck.`,
    }) ?? { status: 'allow' }
  )
}

function evaluateStandardRideAction(
  currentState: GameState,
  action: RideCardAction,
): FormatCommandDecision {
  const sourceZone = findZoneById(currentState, action.from.zoneId)

  if (sourceZone?.kind !== STANDARD_ZONE_KINDS.rideDeck) {
    return {
      status: 'invalid',
      code: 'format_rule_violation',
      message:
        'Standard adapter requires card.ride to originate from the ride deck.',
    }
  }

  return { status: 'allow' }
}
