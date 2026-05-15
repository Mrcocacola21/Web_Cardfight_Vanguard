import { describe, expect, expectTypeOf, it } from 'vitest'

import { RulesInvariantError } from '../errors'
import type {
  ActionId,
  AttackDeclaredEvent,
  BattleEvent,
  BattleEventType,
  CardEventType,
  CheckTriggerResolutionState,
  DriveCheckedEvent,
  EffectEvent,
  EffectEventType,
  EffectResolvedEvent,
  EventType,
  GameEvent,
  GameState,
  ResourceEvent,
  ResourceEventType,
  MatchEvent,
  MatchEventType,
  MatchStartedEvent,
  PhaseAdvancedEvent,
  PieceEventType,
  PieceId,
  PieceMovedEvent,
  PlayerEventOrigin,
  PlayerId,
  PlayerResourceEvent,
  SystemEventOrigin,
  TransitionId,
  TriggerEventType,
  TurnEvent,
  TurnEventType,
  ZoneTransferReason,
  ZoneId,
} from '../index'
import {
  createTransitionResult,
  isPlayerOriginatedEvent,
  isSystemOriginatedEvent,
} from '../index'

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue
  ? true
  : false

type ExpectedEventTypes =
  | 'match.started'
  | 'match.ended'
  | 'mulligan.started'
  | 'mulligan.completed'
  | 'turn.started'
  | 'turn.ended'
  | 'turn.cleanup_applied'
  | 'turn.phase_advanced'
  | 'turn.step_advanced'
  | 'piece.moved'
  | 'piece.rested'
  | 'piece.stood'
  | 'piece.locked'
  | 'piece.unlocked'
  | 'zone.shuffled'
  | 'card.played'
  | 'card.rode'
  | 'card.called'
  | 'cards.drawn'
  | 'battle.attack_declared'
  | 'battle.boost_declared'
  | 'battle.intercept_declared'
  | 'battle.drive_checked'
  | 'battle.combat_resolved'
  | 'battle.attack_hit'
  | 'battle.attack_missed'
  | 'battle.damage_checked'
  | 'battle.guardians_cleaned_up'
  | 'battle.completed'
  | 'battle.guard_requested'
  | 'battle.guard_declared'
  | 'battle.guard_passed'
  | 'choice.response_resolved'
  | 'player.counter_changed'
  | 'player.flag_changed'
  | 'player.damage_changed'
  | 'player.defeated'
  | 'resource.counter_blasted'
  | 'resource.counter_charged'
  | 'resource.soul_blasted'
  | 'resource.soul_charged'
  | 'effect.resolved'
  | 'trigger.revealed'
  | 'trigger.resolved'

const matchStartedEvent: MatchStartedEvent = {
  eventId: 'event-1' as MatchStartedEvent['eventId'],
  type: 'match.started',
  sequence: 0,
  sourceActionId: 'action-start' as ActionId,
  origin: {
    kind: 'system',
    system: 'match-setup',
  },
  startingPlayerId: 'player-1' as PlayerId,
}

const attackDeclaredEvent: AttackDeclaredEvent = {
  eventId: 'event-2' as AttackDeclaredEvent['eventId'],
  type: 'battle.attack_declared',
  sequence: 1,
  sourceActionId: 'action-attack' as ActionId,
  origin: {
    kind: 'player',
    playerId: 'player-1' as PlayerId,
  },
  battleId: 'battle-1' as AttackDeclaredEvent['battleId'],
  attackerPieceId: 'piece-1' as PieceId,
  target: {
    kind: 'player',
    playerId: 'player-2' as PlayerId,
  },
}

const driveCheckedEvent: DriveCheckedEvent = {
  eventId: 'event-3' as DriveCheckedEvent['eventId'],
  type: 'battle.drive_checked',
  sequence: 2,
  sourceActionId: 'action-drive' as ActionId,
  origin: {
    kind: 'system',
    system: 'automatic-flow',
  },
  battleId: 'battle-1' as DriveCheckedEvent['battleId'],
  playerId: 'player-1' as PlayerId,
  fromZoneId: 'zone-deck' as ZoneId,
  toZoneId: 'zone-hand' as ZoneId,
  revealedCards: [
    {
      pieceId: 'piece-3' as PieceId,
    },
  ],
  triggerResolutionState:
    'pending_future_engine' as CheckTriggerResolutionState,
}

describe('@web-vg/rules-core event model', () => {
  it('publishes a stable gameplay event vocabulary', () => {
    expectTypeOf<EventType>().toEqualTypeOf<ExpectedEventTypes>()
    expectTypeOf<GameEvent['type']>().toEqualTypeOf<ExpectedEventTypes>()
    expectTypeOf<MatchEvent['type']>().toEqualTypeOf<
      'match.started' | 'match.ended'
    >()
    expectTypeOf<MatchEventType>().toEqualTypeOf<
      'match.started' | 'match.ended'
    >()
    expectTypeOf<TurnEventType>().toEqualTypeOf<
      | 'turn.started'
      | 'turn.ended'
      | 'turn.cleanup_applied'
      | 'turn.phase_advanced'
      | 'turn.step_advanced'
    >()
    expectTypeOf<PieceEventType>().toEqualTypeOf<
      | 'piece.moved'
      | 'piece.rested'
      | 'piece.stood'
      | 'piece.locked'
      | 'piece.unlocked'
    >()
    expectTypeOf<CardEventType>().toEqualTypeOf<
      'card.played' | 'card.rode' | 'card.called' | 'cards.drawn'
    >()
    expectTypeOf<BattleEvent['type']>().toEqualTypeOf<
      | 'battle.attack_declared'
      | 'battle.boost_declared'
      | 'battle.intercept_declared'
      | 'battle.drive_checked'
      | 'battle.combat_resolved'
      | 'battle.attack_hit'
      | 'battle.attack_missed'
      | 'battle.damage_checked'
      | 'battle.guardians_cleaned_up'
      | 'battle.completed'
      | 'battle.guard_requested'
      | 'battle.guard_declared'
      | 'battle.guard_passed'
    >()
    expectTypeOf<BattleEventType>().toEqualTypeOf<
      | 'battle.attack_declared'
      | 'battle.boost_declared'
      | 'battle.intercept_declared'
      | 'battle.drive_checked'
      | 'battle.combat_resolved'
      | 'battle.attack_hit'
      | 'battle.attack_missed'
      | 'battle.damage_checked'
      | 'battle.guardians_cleaned_up'
      | 'battle.completed'
      | 'battle.guard_requested'
      | 'battle.guard_declared'
      | 'battle.guard_passed'
    >()
  })

  it('keeps event origin and state references aligned with gameplay identities', () => {
    expectTypeOf<
      MatchStartedEvent['origin']
    >().toEqualTypeOf<SystemEventOrigin>()
    expectTypeOf<
      AttackDeclaredEvent['origin']
    >().toEqualTypeOf<PlayerEventOrigin>()
    expectTypeOf<
      DriveCheckedEvent['origin']
    >().toEqualTypeOf<SystemEventOrigin>()
    expectTypeOf<PieceMovedEvent['pieceId']>().toEqualTypeOf<PieceId>()
    expectTypeOf<PieceMovedEvent['to']['zoneId']>().toEqualTypeOf<ZoneId>()
    expectTypeOf<
      PieceMovedEvent['reason']
    >().toEqualTypeOf<ZoneTransferReason>()
    expectTypeOf<PhaseAdvancedEvent['sourceActionId']>().toEqualTypeOf<
      ActionId | undefined
    >()
    expectTypeOf<PlayerResourceEvent['playerId']>().toEqualTypeOf<PlayerId>()
    expectTypeOf<ResourceEvent['playerId']>().toEqualTypeOf<PlayerId>()
    expectTypeOf<ResourceEventType>().toEqualTypeOf<
      | 'resource.counter_blasted'
      | 'resource.counter_charged'
      | 'resource.soul_blasted'
      | 'resource.soul_charged'
    >()
    expectTypeOf<EffectEvent['type']>().toEqualTypeOf<'effect.resolved'>()
    expectTypeOf<EffectEventType>().toEqualTypeOf<'effect.resolved'>()
    expectTypeOf<TriggerEventType>().toEqualTypeOf<
      'trigger.revealed' | 'trigger.resolved'
    >()
    expectTypeOf<EffectResolvedEvent['sourcePieceId']>().toEqualTypeOf<
      PieceId | undefined
    >()
    expectTypeOf<TurnEvent['turnNumber']>().toEqualTypeOf<number>()
  })

  it('separates gameplay facts from actions, requests, UI, and persistence concerns', () => {
    expectTypeOf<HasKey<GameEvent, 'action'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameEvent, 'expectedRevision'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameEvent, 'requestId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameEvent, 'choiceId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameEvent, 'payload'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameEvent, 'onClick'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameEvent, 'clientX'>>().toEqualTypeOf<false>()
    expectTypeOf<
      HasKey<PieceMovedEvent, 'cardPrintingId'>
    >().toEqualTypeOf<false>()
  })

  it('exposes origin helpers for future trigger/effect observation', () => {
    expect(isSystemOriginatedEvent(matchStartedEvent)).toBe(true)
    expect(isPlayerOriginatedEvent(matchStartedEvent)).toBe(false)
    expect(isPlayerOriginatedEvent(attackDeclaredEvent)).toBe(true)
    expect(isSystemOriginatedEvent(attackDeclaredEvent)).toBe(false)
    expect(isSystemOriginatedEvent(driveCheckedEvent)).toBe(true)
  })

  it('keeps transition outputs sequence-compatible for ordered event results', () => {
    const transitionId = 'transition-1' as TransitionId
    const state: GameState = {
      gameId: 'game-1' as GameState['gameId'],
      formatId: 'standard' as GameState['formatId'],
      status: 'in_progress',
      revision: 0,
      turn: {
        turnNumber: 1,
        turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
        phase: 'main' as GameState['turn']['phase'],
      },
      players: [
        {
          playerId: 'player-1' as GameState['players'][number]['playerId'],
          seat: 0,
          status: 'active',
          ownedZoneIds: [],
          counters: [],
          flags: [],
        },
      ],
      zones: [],
      pieces: [],
      pieceStates: [],
      flags: [],
      pendingRequests: [],
    }

    expect(() =>
      createTransitionResult(transitionId, state, [
        matchStartedEvent,
        attackDeclaredEvent,
        driveCheckedEvent,
      ]),
    ).not.toThrow()

    expect(() =>
      createTransitionResult(transitionId, state, [
        driveCheckedEvent,
        attackDeclaredEvent,
        matchStartedEvent,
      ]),
    ).toThrow(RulesInvariantError)
  })
})
