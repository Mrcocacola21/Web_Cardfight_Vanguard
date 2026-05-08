import { describe, expect, expectTypeOf, it } from 'vitest'

import type {
  ActionType,
  AttackTarget,
  DeclareAttackAction,
  GameAction,
  GameActionSubmission,
  MatchAction,
  MovePieceAction,
  PlayCardAction,
  PlayerActionActor,
  PlayerGameAction,
  SystemActionActor,
  SystemGameAction,
  TurnFlowAction,
  ZoneTransferReason,
  ZoneId,
} from '../index'
import { isPlayerGameAction, isSystemGameAction } from '../index'

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue
  ? true
  : false

type ExpectedActionTypes =
  | 'match.ready'
  | 'match.start'
  | 'match.concede'
  | 'system.begin_mulligan'
  | 'system.drive_check'
  | 'system.damage_check'
  | 'piece.rest'
  | 'piece.stand'
  | 'piece.lock'
  | 'piece.unlock'
  | 'turn.pass_priority'
  | 'turn.end_phase'
  | 'turn.end_turn'
  | 'zone.shuffle'
  | 'zone.draw'
  | 'zone.move_piece'
  | 'card.play'
  | 'card.ride'
  | 'card.call'
  | 'battle.declare_attack'
  | 'battle.commit_boost'
  | 'battle.guard'
  | 'system.advance_phase'
  | 'system.advance_step'
  | 'system.resolve_mandatory_flow'

const playerAction: PlayCardAction = {
  actionId: 'action-play-1' as PlayCardAction['actionId'],
  type: 'card.play',
  actor: {
    kind: 'player',
    playerId: 'player-1' as PlayCardAction['actor']['playerId'],
  },
  pieceId: 'piece-1' as PlayCardAction['pieceId'],
  from: {
    zoneId: 'zone-hand' as PlayCardAction['from']['zoneId'],
  },
  to: {
    zoneId: 'zone-order' as PlayCardAction['to']['zoneId'],
  },
}

const systemAction: MovePieceAction = {
  actionId: 'action-move-1' as MovePieceAction['actionId'],
  type: 'zone.move_piece',
  actor: {
    kind: 'system',
    system: 'automatic-flow',
  },
  pieceId: 'piece-1' as MovePieceAction['pieceId'],
  from: {
    zoneId: 'zone-order' as MovePieceAction['from']['zoneId'],
  },
  to: {
    zoneId: 'zone-drop' as MovePieceAction['to']['zoneId'],
  },
  reason: 'generic',
}

describe('@web-vg/rules-core action model', () => {
  it('exposes discriminated gameplay actions through the public entrypoint', () => {
    expect(isPlayerGameAction(playerAction)).toBe(true)
    expect(isPlayerGameAction(systemAction)).toBe(false)
    expect(isSystemGameAction(systemAction)).toBe(true)
    expect(isSystemGameAction(playerAction)).toBe(false)
  })

  it('publishes a stable gameplay action vocabulary', () => {
    expectTypeOf<ActionType>().toEqualTypeOf<ExpectedActionTypes>()
    expectTypeOf<GameAction['type']>().toEqualTypeOf<ExpectedActionTypes>()
    expectTypeOf<MatchAction['type']>().toEqualTypeOf<
      'match.ready' | 'match.start' | 'match.concede' | 'system.begin_mulligan'
    >()
    expectTypeOf<TurnFlowAction['type']>().toEqualTypeOf<
      | 'system.drive_check'
      | 'system.damage_check'
      | 'piece.rest'
      | 'piece.stand'
      | 'piece.lock'
      | 'piece.unlock'
      | 'turn.pass_priority'
      | 'turn.end_phase'
      | 'turn.end_turn'
      | 'system.advance_phase'
      | 'system.advance_step'
      | 'system.resolve_mandatory_flow'
    >()
  })

  it('keeps actor and target semantics aligned with gameplay state identities', () => {
    expectTypeOf<PlayerGameAction['actor']>().toEqualTypeOf<PlayerActionActor>()
    expectTypeOf<SystemGameAction['actor']>().toEqualTypeOf<SystemActionActor>()
    expectTypeOf<MovePieceAction['to']['zoneId']>().toEqualTypeOf<ZoneId>()
    expectTypeOf<
      MovePieceAction['reason']
    >().toEqualTypeOf<ZoneTransferReason>()
    expectTypeOf<DeclareAttackAction['target']>().toEqualTypeOf<AttackTarget>()
    expectTypeOf<GameActionSubmission['action']>().toEqualTypeOf<GameAction>()
  })

  it('stays separate from UI, persistence, event, and future request semantics', () => {
    expectTypeOf<HasKey<GameAction, 'payload'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameAction, 'eventId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameAction, 'requestId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameAction, 'choiceId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameAction, 'userId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameAction, 'recordId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameAction, 'onClick'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameAction, 'clientX'>>().toEqualTypeOf<false>()
    expectTypeOf<
      HasKey<PlayCardAction, 'cardPrintingId'>
    >().toEqualTypeOf<false>()
  })
})
