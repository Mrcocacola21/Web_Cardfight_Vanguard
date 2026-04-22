import { describe, expect, expectTypeOf, it } from 'vitest'

import { RulesInvariantError } from '../errors'
import type {
  ActionId,
  AttackDeclaredEvent,
  BattleEvent,
  BattleEventType,
  CardEventType,
  EventType,
  GameEvent,
  GameState,
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
  TurnEvent,
  TurnEventType,
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
  | 'turn.started'
  | 'turn.ended'
  | 'turn.phase_advanced'
  | 'turn.step_advanced'
  | 'piece.moved'
  | 'card.played'
  | 'card.rode'
  | 'card.called'
  | 'battle.attack_declared'
  | 'battle.guard_declared'
  | 'player.counter_changed'
  | 'player.flag_changed'

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
  attackerPieceId: 'piece-1' as PieceId,
  target: {
    kind: 'player',
    playerId: 'player-2' as PlayerId,
  },
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
      | 'turn.phase_advanced'
      | 'turn.step_advanced'
    >()
    expectTypeOf<PieceEventType>().toEqualTypeOf<'piece.moved'>()
    expectTypeOf<CardEventType>().toEqualTypeOf<
      'card.played' | 'card.rode' | 'card.called'
    >()
    expectTypeOf<BattleEvent['type']>().toEqualTypeOf<
      'battle.attack_declared' | 'battle.guard_declared'
    >()
    expectTypeOf<BattleEventType>().toEqualTypeOf<
      'battle.attack_declared' | 'battle.guard_declared'
    >()
  })

  it('keeps event origin and state references aligned with gameplay identities', () => {
    expectTypeOf<
      MatchStartedEvent['origin']
    >().toEqualTypeOf<SystemEventOrigin>()
    expectTypeOf<
      AttackDeclaredEvent['origin']
    >().toEqualTypeOf<PlayerEventOrigin>()
    expectTypeOf<PieceMovedEvent['pieceId']>().toEqualTypeOf<PieceId>()
    expectTypeOf<PieceMovedEvent['to']['zoneId']>().toEqualTypeOf<ZoneId>()
    expectTypeOf<PhaseAdvancedEvent['sourceActionId']>().toEqualTypeOf<
      ActionId | undefined
    >()
    expectTypeOf<PlayerResourceEvent['playerId']>().toEqualTypeOf<PlayerId>()
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
      flags: [],
      pendingRequests: [],
    }

    expect(() =>
      createTransitionResult(transitionId, state, [
        matchStartedEvent,
        attackDeclaredEvent,
      ]),
    ).not.toThrow()

    expect(() =>
      createTransitionResult(transitionId, state, [
        attackDeclaredEvent,
        matchStartedEvent,
      ]),
    ).toThrow(RulesInvariantError)
  })
})
