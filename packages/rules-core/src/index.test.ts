import { describe, expect, expectTypeOf, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import * as entry from './index'
import type {
  EngineCommand,
  EngineDispatchResult,
  EffectDefinitionId,
  GameActionSubmission,
  GameChoiceRequest,
  GameEvent,
  GamePieceState,
  GameState,
  MatchReadyAction,
  PieceId,
  TransitionId,
  TransitionResult,
  ZoneSlotId,
} from './index'
import {
  applyGameAction,
  RulesInvariantError,
  advanceGameStateRevision,
  assertGameStateInvariant,
  assertActionSubmissionRevision,
  createTransitionResult,
} from './index'

function makeGameState(revision = 0): GameState {
  return {
    gameId: 'game-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'setup',
    revision,
    turn: {
      turnNumber: 1,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'setup' as GameState['turn']['phase'],
      step: 'opening' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: 'ready',
        ownedZoneIds: [
          'zone-1' as GameState['players'][number]['ownedZoneIds'][number],
          'zone-2' as GameState['players'][number]['ownedZoneIds'][number],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-1' as GameState['zones'][number]['zoneId'],
        kind: 'deck',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: 'piece-1' as PieceId,
          },
        ],
      },
      {
        zoneId: 'zone-2' as GameState['zones'][number]['zoneId'],
        kind: 'field',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: ['slot-vanguard' as ZoneSlotId, 'slot-left' as ZoneSlotId],
        },
        occupants: [],
      },
    ],
    pieces: [
      {
        pieceId: 'piece-1' as PieceId,
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-1' as CardId,
      },
    ],
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function makeActionSubmission(
  expectedRevision?: number,
): GameActionSubmission<MatchReadyAction> {
  return {
    action: {
      actionId: 'action-1' as MatchReadyAction['actionId'],
      type: 'match.ready',
      actor: {
        kind: 'player',
        playerId: 'player-1' as MatchReadyAction['actor']['playerId'],
      },
    },
    ...(expectedRevision === undefined ? {} : { expectedRevision }),
  }
}

describe('@web-vg/rules-core', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(entry.assertRulesInvariant).toBeTypeOf('function')
    expect(entry.advanceGameStateRevision).toBeTypeOf('function')
    expect(entry.assertChoiceResponseMatchesRequest).toBeTypeOf('function')
    expect(entry.createTransitionResult).toBeTypeOf('function')
    expect(entry.createEffectRegistry).toBeTypeOf('function')
    expect(entry.createKeywordMechanicsRegistry).toBeTypeOf('function')
    expect(entry.dispatchEngineCommand).toBeTypeOf('function')
    expect(entry.dispatchPremiumCommand).toBeTypeOf('function')
    expect(entry.dispatchStandardCommand).toBeTypeOf('function')
    expect(entry.dispatchVPremiumCommand).toBeTypeOf('function')
    expect(entry.reduceGameState).toBeTypeOf('function')
    expect(entry.coreEffectRegistry.size).toBeGreaterThan(0)
    expect(entry.keywordMechanicsRegistry.size).toBeGreaterThan(0)
    expect(entry.premiumFormatAdapter).toBeDefined()
    expect(entry.standardFormatAdapter).toBeDefined()
    expect(entry.vPremiumFormatAdapter).toBeDefined()
  })

  it('keeps gameplay contracts aligned with shared identifiers', () => {
    expectTypeOf<GameState['formatId']>().toEqualTypeOf<FormatId>()
    expectTypeOf<GamePieceState['cardDefinitionId']>().toEqualTypeOf<
      CardId | undefined
    >()
    expectTypeOf<
      GameState['pendingRequests'][number]
    >().toEqualTypeOf<GameChoiceRequest>()
    expectTypeOf<EngineCommand['kind']>().toEqualTypeOf<
      'action' | 'choice_response'
    >()
    expectTypeOf<
      EngineDispatchResult['pendingRequests'][number]
    >().toEqualTypeOf<GameChoiceRequest>()
    expectTypeOf<
      TransitionResult['events'][number]
    >().toEqualTypeOf<GameEvent>()
    expectTypeOf<
      (typeof entry.CORE_EFFECT_DEFINITIONS)[number]['id']
    >().toEqualTypeOf<EffectDefinitionId>()
    expectTypeOf<
      typeof entry.premiumFormatAdapter.formatId
    >().toEqualTypeOf<FormatId>()
    expectTypeOf<
      typeof entry.standardFormatAdapter.formatId
    >().toEqualTypeOf<FormatId>()
    expectTypeOf<
      typeof entry.vPremiumFormatAdapter.formatId
    >().toEqualTypeOf<FormatId>()
  })

  it('provides deterministic state evolution primitives', () => {
    const currentState = makeGameState(3)
    expect(() => assertGameStateInvariant(currentState)).not.toThrow()

    const nextState = advanceGameStateRevision(currentState)
    const result = createTransitionResult(
      'transition-1' as TransitionId,
      nextState,
    )

    expect(nextState.revision).toBe(4)
    expect(result.status).toBe('applied')
    expect(result.nextState).toEqual(nextState)
    expect(result.events).toEqual([])
  })

  it('guards action submissions against stale state revisions', () => {
    const currentState = makeGameState(2)

    expect(() =>
      assertActionSubmissionRevision(makeActionSubmission(2), currentState),
    ).not.toThrow()
    expect(() =>
      assertActionSubmissionRevision(makeActionSubmission(1), currentState),
    ).toThrow(RulesInvariantError)
  })

  it('exposes a reducer entrypoint over the public package surface', () => {
    const result = applyGameAction(makeGameState(), makeActionSubmission())

    expect(result.status).toBe('invalid')
  })
})
