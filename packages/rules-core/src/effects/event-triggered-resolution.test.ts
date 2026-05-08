import type { CardId, FormatId } from '@web-vg/shared'
import { describe, expect, it } from 'vitest'

import type {
  ActionId,
  PieceId,
  PlayerId,
  RequestId,
  TransitionId,
  ZoneId,
} from '../contracts'
import type { BattleState, GameState, ZoneState } from '../state'
import { PERSONA_RIDE_KEYWORD } from '../keywords'
import type { GameChoiceRequest } from '../requests'
import {
  applyGameAction,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
} from '../transitions'
import { applyDriveCheckTransition } from '../transitions/drive-damage-check'
import { applyRideCardTransition } from '../transitions/ride-call'

import {
  CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY,
  CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY,
  PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY,
} from './samples'
import {
  collectEventTriggeredEffectCandidates,
  resolveEventTriggeredEffects,
} from './triggered-resolution'
import { PERSONA_RIDE_POWER_FLAG } from './first-effects'

const STANDARD_FORMAT_ID = 'standard' as FormatId
const PLAYER_1 = 'player-1' as PlayerId
const PLAYER_2 = 'player-2' as PlayerId

function makePlayerZones(
  playerId: PlayerId,
  zonePrefix: string,
  occupants: {
    readonly deck?: readonly PieceId[]
    readonly hand?: readonly PieceId[]
    readonly soul?: readonly PieceId[]
    readonly vanguard?: readonly PieceId[]
    readonly rearGuard?: readonly PieceId[]
    readonly damage?: readonly PieceId[]
  },
): readonly ZoneState[] {
  return [
    {
      zoneId: `${zonePrefix}-deck` as ZoneId,
      kind: 'deck',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: (occupants.deck ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-hand` as ZoneId,
      kind: 'hand',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: (occupants.hand ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-soul` as ZoneId,
      kind: 'soul',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'owner-private',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: (occupants.soul ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-vg` as ZoneId,
      kind: 'vanguard_circle',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants: (occupants.vanguard ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-rg` as ZoneId,
      kind: 'rear_guard_circle',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: (occupants.rearGuard ?? []).map((pieceId) => ({ pieceId })),
    },
    {
      zoneId: `${zonePrefix}-damage` as ZoneId,
      kind: 'damage',
      scope: 'player',
      ownerPlayerId: playerId,
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: (occupants.damage ?? []).map((pieceId) => ({ pieceId })),
    },
  ]
}

function makePersonaRideState(): GameState {
  const oldVanguardPieceId = 'piece-old-vg' as PieceId
  const newVanguardPieceId = 'piece-new-vg' as PieceId
  const rearGuardPieceId = 'piece-rg' as PieceId
  const deckPieceId = 'piece-persona-draw' as PieceId
  const playerOneZones = makePlayerZones(PLAYER_1, 'p1', {
    deck: [deckPieceId],
    hand: [newVanguardPieceId],
    vanguard: [oldVanguardPieceId],
    rearGuard: [rearGuardPieceId],
  })
  const playerTwoZones = makePlayerZones(PLAYER_2, 'p2', {
    vanguard: ['piece-p2-vg' as PieceId],
  })

  return {
    gameId: 'game-triggered-persona' as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'ride',
      step: 'ride',
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: playerOneZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: playerTwoZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
    ],
    zones: [...playerOneZones, ...playerTwoZones],
    pieces: [
      {
        pieceId: oldVanguardPieceId,
        kind: 'card',
        cardDefinitionId: 'card-persona' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: newVanguardPieceId,
        kind: 'card',
        cardDefinitionId: 'card-persona' as CardId,
        keywords: [PERSONA_RIDE_KEYWORD],
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: rearGuardPieceId,
        kind: 'card',
        cardDefinitionId: 'card-rear-guard' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: deckPieceId,
        kind: 'card',
        cardDefinitionId: 'card-drawn' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: 'piece-p2-vg' as PieceId,
        kind: 'card',
        cardDefinitionId: 'card-p2-vg' as CardId,
        ownerPlayerId: PLAYER_2,
        controllerPlayerId: PLAYER_2,
      },
    ],
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function makeDriveCheckState(): GameState {
  const attackerPieceId = 'piece-attacker' as PieceId
  const driveTopPieceId = 'piece-drive-top' as PieceId
  const targetPieceId = 'piece-target-vg' as PieceId
  const playerOneZones = makePlayerZones(PLAYER_1, 'p1', {
    deck: [driveTopPieceId],
    vanguard: [attackerPieceId],
  })
  const playerTwoZones = makePlayerZones(PLAYER_2, 'p2', {
    vanguard: [targetPieceId],
  })

  return {
    gameId: 'game-triggered-drive' as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'battle',
      step: 'drive',
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: playerOneZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: playerTwoZones.map((zone) => zone.zoneId),
        counters: [],
        flags: [],
      },
    ],
    zones: [...playerOneZones, ...playerTwoZones],
    pieces: [
      {
        pieceId: attackerPieceId,
        kind: 'card',
        cardDefinitionId: 'card-attacker' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: driveTopPieceId,
        kind: 'card',
        cardDefinitionId: 'card-drive-top' as CardId,
        ownerPlayerId: PLAYER_1,
        controllerPlayerId: PLAYER_1,
      },
      {
        pieceId: targetPieceId,
        kind: 'card',
        cardDefinitionId: 'card-target' as CardId,
        ownerPlayerId: PLAYER_2,
        controllerPlayerId: PLAYER_2,
      },
    ],
    pieceStates: [],
    flags: [],
    battle: {
      battleId: 'battle-1' as BattleState['battleId'],
      status: 'guard_resolved',
      attackingPlayerId: PLAYER_1,
      defendingPlayerId: PLAYER_2,
      attackerPieceId,
      attackerZoneId: 'p1-vg' as ZoneId,
      target: {
        kind: 'piece',
        pieceId: targetPieceId,
      },
      guardPieceIds: [],
    },
    pendingRequests: [],
  }
}

function requireApplied(result: ReturnType<typeof applyGameAction>) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error('Expected applied transition result.')
  }

  return result
}

function requireBlocked(result: ReturnType<typeof applyGameAction>) {
  expect(isBlockedTransitionResult(result)).toBe(true)

  if (!isBlockedTransitionResult(result)) {
    throw new Error('Expected blocked transition result.')
  }

  return result
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-triggered-effect-block' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: PLAYER_1,
    purpose: 'effect',
    visibility: 'responder-only',
  }
}

describe('@web-vg/rules-core event-triggered resolution foundation', () => {
  it('collects keyword-triggered persona ride candidates from emitted events and timing windows', () => {
    const currentState = makePersonaRideState()
    const baseResult = requireApplied(
      applyRideCardTransition(
        'transition-persona-base' as TransitionId,
        currentState,
        {
          actionId: 'action-persona-base' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          pieceId: 'piece-new-vg' as PieceId,
          ridingOverPieceId: 'piece-old-vg' as PieceId,
          from: {
            zoneId: 'p1-hand' as ZoneId,
          },
          to: {
            zoneId: 'p1-vg' as ZoneId,
          },
        },
      ),
    )

    expect(baseResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
    ])

    const candidates = collectEventTriggeredEffectCandidates(baseResult)

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      sourceKind: 'keyword',
      sourcePieceId: 'piece-new-vg',
      effectDefinition: {
        id: PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY.id,
      },
      triggerEvent: {
        type: 'card.rode',
        sequence: 2,
      },
      timingWindow: {
        point: 'card.ride',
        window: 'after',
      },
    })
  })

  it('folds persona ride consequences back into the reducer result automatically', () => {
    const result = requireApplied(
      applyGameAction(makePersonaRideState(), {
        action: {
          actionId: 'action-persona-reducer' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          pieceId: 'piece-new-vg' as PieceId,
          ridingOverPieceId: 'piece-old-vg' as PieceId,
          from: {
            zoneId: 'p1-hand' as ZoneId,
          },
          to: {
            zoneId: 'p1-vg' as ZoneId,
          },
        },
      }),
    )

    expect(result.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
      'effect.resolved',
      'piece.moved',
      'cards.drawn',
      'effect.resolved',
    ])
    expect(result.events.map((event) => event.sequence)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ])
    expect(result.events[3]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: PERSONA_RIDE_KEYWORD_EFFECT_IDENTITY.id,
      triggerEventSequence: 2,
      operationKinds: ['draw_cards', 'apply_power_modifier'],
    })
    expect(result.events[6]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CARDS_DRAWN_FINALIZE_EFFECT_IDENTITY.id,
      triggerEventSequence: 5,
      operationKinds: ['typed_handler'],
    })
    expect(result.timingWindows.at(-1)).toMatchObject({
      point: 'zone.transfer',
      window: 'after',
      relatedEventSequence: 5,
    })
    expect(
      result.nextState.pieceStates.find(
        (pieceState) => pieceState.pieceId === ('piece-new-vg' as PieceId),
      )?.flags,
    ).toContain(PERSONA_RIDE_POWER_FLAG)
  })

  it('keeps triggered effect output replay-stable for identical reducer input', () => {
    const action = {
      actionId: 'action-persona-replay' as ActionId,
      type: 'card.ride' as const,
      actor: {
        kind: 'player' as const,
        playerId: PLAYER_1,
      },
      pieceId: 'piece-new-vg' as PieceId,
      ridingOverPieceId: 'piece-old-vg' as PieceId,
      from: {
        zoneId: 'p1-hand' as ZoneId,
      },
      to: {
        zoneId: 'p1-vg' as ZoneId,
      },
    }

    const first = requireApplied(
      applyGameAction(makePersonaRideState(), { action }),
    )
    const second = requireApplied(
      applyGameAction(makePersonaRideState(), { action }),
    )

    expect(second.events).toEqual(first.events)
    expect(second.timingWindows).toEqual(first.timingWindows)
    expect(second.nextState).toEqual(first.nextState)
  })

  it('does not enter triggered effect resolution when a pending request blocks the base action', () => {
    const pendingRequest = makePendingRequest()
    const state: GameState = {
      ...makePersonaRideState(),
      status: 'awaiting_choice',
      pendingRequests: [pendingRequest],
    }
    const result = requireBlocked(
      applyGameAction(state, {
        action: {
          actionId: 'action-persona-blocked' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          pieceId: 'piece-new-vg' as PieceId,
          ridingOverPieceId: 'piece-old-vg' as PieceId,
          from: {
            zoneId: 'p1-hand' as ZoneId,
          },
          to: {
            zoneId: 'p1-vg' as ZoneId,
          },
        },
      }),
    )

    expect(result.code).toBe('pending_request')
    expect(result.blockingRequests).toEqual([pendingRequest])
    expect(result.currentState).toEqual(state)
    expect(result.events).toEqual([])
    expect(result.timingWindows).toEqual([])
  })

  it('resolves the typed check finalizer from battle check events in deterministic order', () => {
    const currentState = makeDriveCheckState()
    const baseResult = requireApplied(
      applyDriveCheckTransition(
        'transition-drive-base' as TransitionId,
        currentState,
        {
          actionId: 'action-drive-base' as ActionId,
          type: 'system.drive_check',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          battleId: 'battle-1' as BattleState['battleId'],
          playerId: PLAYER_1,
          fromZoneId: 'p1-deck' as ZoneId,
          toZoneId: 'p1-hand' as ZoneId,
          count: 1,
        },
      ),
    )

    expect(baseResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.drive_checked',
    ])
    expect(baseResult.nextState.battle?.lastCheck?.triggerResolutionState).toBe(
      'pending_future_engine',
    )

    const result = requireApplied(
      resolveEventTriggeredEffects({
        currentState,
        result: baseResult,
      }),
    )

    expect(result.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'battle.drive_checked',
      'effect.resolved',
    ])
    expect(result.events.map((event) => event.sequence)).toEqual([0, 1, 2])
    expect(result.events[2]).toMatchObject({
      type: 'effect.resolved',
      effectDefinitionId: CHECK_TRIGGER_REVEAL_EFFECT_IDENTITY.id,
      triggerEventSequence: 1,
      operationKinds: ['typed_handler'],
    })
    expect(result.nextState.battle?.lastCheck?.triggerResolutionState).toBe(
      'resolved_none',
    )
  })

  it('leaves no-match transitions unchanged', () => {
    const result = requireApplied(
      applyGameAction(makePersonaRideState(), {
        action: {
          actionId: 'action-call-no-match' as ActionId,
          type: 'card.call',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          pieceId: 'piece-new-vg' as PieceId,
          from: {
            zoneId: 'p1-hand' as ZoneId,
          },
          to: {
            zoneId: 'p1-rg' as ZoneId,
          },
        },
      }),
    )

    expect(result.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'card.called',
    ])
    expect(
      result.events.some((event) => event.type === 'effect.resolved'),
    ).toBe(false)
  })
})
