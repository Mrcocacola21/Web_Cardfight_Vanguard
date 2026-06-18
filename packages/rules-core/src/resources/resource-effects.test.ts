import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  EffectDefinition,
  GameEvent,
  GameState,
  PieceId,
  PlayerId,
  TransitionId,
  ZoneId,
} from '../index'
import {
  createEffectDescriptorKey,
  createEffectIdentity,
  createEffectRegistry,
  createEffectTimingBinding,
  createKeywordMechanicsRegistry,
  createTransitionResult,
  defineEffectDefinition,
  resolveEventTriggeredEffects,
} from '../index'

import {
  FACE_DOWN_DAMAGE_FLAG,
  isFaceDownDamageCard,
  isFaceUpDamageCard,
  resolveResourceEffectDefinition,
} from './index'
import type { ResourceEffectOperation } from '../effects'

const PLAYER_1 = 'player-1' as PlayerId
const PLAYER_2 = 'player-2' as PlayerId
const SOURCE_PIECE = 'piece-source' as PieceId
const DAMAGE_1 = 'piece-damage-1' as PieceId
const DAMAGE_2 = 'piece-damage-2' as PieceId
const DAMAGE_3 = 'piece-damage-3' as PieceId
const SOUL_1 = 'piece-soul-1' as PieceId
const SOUL_2 = 'piece-soul-2' as PieceId
const DECK_1 = 'piece-deck-1' as PieceId
const ZONE_DAMAGE = 'zone-damage' as ZoneId
const ZONE_SOUL = 'zone-soul' as ZoneId
const ZONE_DROP = 'zone-drop' as ZoneId
const ZONE_DECK = 'zone-deck' as ZoneId
const ZONE_VANGUARD = 'zone-vanguard' as ZoneId

describe('core Vanguard resource effect operations', () => {
  it('represents face-up damage by default and pays Counter Blast by turning cards face-down', () => {
    const state = makeResourceState()
    const result = resolveResourceEffectDefinition({
      currentState: state,
      transitionId: 'transition-resource-cb2' as TransitionId,
      sourceActionId: 'action-resource-cb2' as ActionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('counter-blast-2', [
        counterBlast(2),
      ]),
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(isFaceDownDamageCard(result.state, DAMAGE_1)).toBe(true)
    expect(isFaceDownDamageCard(result.state, DAMAGE_2)).toBe(true)
    expect(isFaceUpDamageCard(result.state, DAMAGE_3)).toBe(true)
    expect(result.events.map((event) => event.type)).toEqual([
      'effect.resolved',
      'resource.counter_blasted',
    ])
    expect(result.events[1]).toMatchObject({
      type: 'resource.counter_blasted',
      playerId: PLAYER_1,
      fromZoneId: ZONE_DAMAGE,
      pieceIds: [DAMAGE_1, DAMAGE_2],
      count: 2,
    })
  })

  it('rejects Counter Blast when not enough face-up damage exists', () => {
    const result = resolveResourceEffectDefinition({
      currentState: makeResourceState({
        faceDownDamagePieceIds: [DAMAGE_1, DAMAGE_2],
      }),
      transitionId: 'transition-resource-cb-fail' as TransitionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('counter-blast-fail', [
        counterBlast(2),
      ]),
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'invalid_action',
    })
  })

  it('Counter Charges face-down damage and rejects unavailable charge targets', () => {
    const success = resolveResourceEffectDefinition({
      currentState: makeResourceState({
        faceDownDamagePieceIds: [DAMAGE_1, DAMAGE_2],
      }),
      transitionId: 'transition-resource-cc2' as TransitionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('counter-charge-2', [
        counterCharge(2),
      ]),
    })

    expect(success.ok).toBe(true)

    if (!success.ok) {
      throw new Error(success.message)
    }

    expect(isFaceUpDamageCard(success.state, DAMAGE_1)).toBe(true)
    expect(isFaceUpDamageCard(success.state, DAMAGE_2)).toBe(true)
    expect(success.events.map((event) => event.type)).toEqual([
      'effect.resolved',
      'resource.counter_charged',
    ])

    const failure = resolveResourceEffectDefinition({
      currentState: makeResourceState(),
      transitionId: 'transition-resource-cc-fail' as TransitionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('counter-charge-fail', [
        counterCharge(1),
      ]),
    })

    expect(failure).toMatchObject({
      ok: false,
      code: 'invalid_action',
    })
  })

  it('Soul Blasts from soul to drop and rejects insufficient soul', () => {
    const success = resolveResourceEffectDefinition({
      currentState: makeResourceState(),
      transitionId: 'transition-resource-sb2' as TransitionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('soul-blast-2', [soulBlast(2)]),
    })

    expect(success.ok).toBe(true)

    if (!success.ok) {
      throw new Error(success.message)
    }

    expect(zonePieceIds(success.state, ZONE_SOUL)).toEqual([])
    expect(zonePieceIds(success.state, ZONE_DROP)).toEqual([SOUL_1, SOUL_2])
    expect(success.events.map((event) => event.type)).toEqual([
      'effect.resolved',
      'piece.moved',
      'piece.moved',
      'resource.soul_blasted',
    ])

    const failure = resolveResourceEffectDefinition({
      currentState: makeResourceState(),
      transitionId: 'transition-resource-sb-fail' as TransitionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('soul-blast-fail', [soulBlast(3)]),
    })

    expect(failure).toMatchObject({
      ok: false,
      code: 'invalid_action',
    })
  })

  it('Soul Charges from deck to soul', () => {
    const result = resolveResourceEffectDefinition({
      currentState: makeResourceState(),
      transitionId: 'transition-resource-sc1' as TransitionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('soul-charge-1', [soulCharge(1)]),
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(zonePieceIds(result.state, ZONE_DECK)).toEqual([])
    expect(zonePieceIds(result.state, ZONE_SOUL)).toEqual([
      SOUL_1,
      SOUL_2,
      DECK_1,
    ])
    expect(result.events.map((event) => event.type)).toEqual([
      'effect.resolved',
      'piece.moved',
      'resource.soul_charged',
    ])
  })

  it('Energy Blasts from the public Standard energy counter', () => {
    const result = resolveResourceEffectDefinition({
      currentState: makeResourceState({
        energy: 3,
      }),
      transitionId: 'transition-resource-eb2' as TransitionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('energy-blast-2', [
        energyBlast(2),
      ]),
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    expect(
      result.state.players.find((player) => player.playerId === PLAYER_1)
        ?.counters,
    ).toContainEqual({
      key: 'energy',
      amount: 1,
      visibility: 'public',
    })
    expect(result.events.map((event) => event.type)).toEqual([
      'effect.resolved',
      'resource.energy_blasted',
    ])
    expect(result.events[1]).toMatchObject({
      type: 'resource.energy_blasted',
      playerId: PLAYER_1,
      counterKey: 'energy',
      previousAmount: 3,
      nextAmount: 1,
      count: 2,
    })
  })

  it('rejects Energy Blast when energy is insufficient', () => {
    const result = resolveResourceEffectDefinition({
      currentState: makeResourceState({
        energy: 1,
      }),
      transitionId: 'transition-resource-eb-fail' as TransitionId,
      sourcePieceId: SOURCE_PIECE,
      effectDefinition: defineResourceEffect('energy-blast-fail', [
        energyBlast(2),
      ]),
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'invalid_action',
    })
  })

  it('routes resource operations through event-triggered effect resolution', () => {
    const state = makeResourceState()
    const effectDefinition = defineResourceEffect(
      'event-routed-counter-blast',
      [counterBlast(1)],
      {
        eventTypes: ['card.called'],
        timingPoint: 'zone.transfer',
      },
    )
    const baseEvent: Extract<GameEvent, { readonly type: 'card.called' }> = {
      eventId: 'event-card-called' as GameEvent['eventId'],
      type: 'card.called',
      sequence: 0,
      sourceActionId: 'action-card-called' as ActionId,
      origin: {
        kind: 'player',
        playerId: PLAYER_1,
      },
      pieceId: SOURCE_PIECE,
      from: {
        zoneId: ZONE_DECK,
      },
      to: {
        zoneId: ZONE_VANGUARD,
      },
    }
    const resolved = resolveEventTriggeredEffects({
      currentState: state,
      result: createTransitionResult(
        'transition-resource-event-route' as TransitionId,
        state,
        [baseEvent],
        {
          timingWindows: [
            {
              sequence: 0,
              point: 'zone.transfer',
              window: 'after',
              relatedEventSequence: 0,
            },
          ],
        },
      ),
      environment: {
        effectRegistry: createEffectRegistry([effectDefinition]),
        keywordMechanics: createKeywordMechanicsRegistry([]),
      },
    })

    expect(resolved.status).toBe('applied')

    if (resolved.status !== 'applied') {
      throw new Error(`Expected applied result, received ${resolved.status}.`)
    }

    expect(resolved.events.map((event) => event.type)).toEqual([
      'card.called',
      'effect.resolved',
      'resource.counter_blasted',
    ])
    expect(isFaceDownDamageCard(resolved.nextState, DAMAGE_1)).toBe(true)
  })
})

interface ResourceStateOptions {
  readonly faceDownDamagePieceIds?: readonly PieceId[]
  readonly energy?: number
}

function makeResourceState(options: ResourceStateOptions = {}): GameState {
  const faceDownDamagePieceIds = options.faceDownDamagePieceIds ?? []

  return {
    gameId: 'game-resource-foundation' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: 'main' as GameState['turn']['phase'],
    },
    players: [
      {
        playerId: PLAYER_1,
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          ZONE_DECK,
          ZONE_DAMAGE,
          ZONE_SOUL,
          ZONE_DROP,
          ZONE_VANGUARD,
        ],
        counters:
          options.energy === undefined
            ? []
            : [
                {
                  key: 'energy',
                  amount: options.energy,
                  visibility: 'public',
                },
              ],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      makeZone(ZONE_DECK, 'deck', [DECK_1]),
      makeZone(ZONE_DAMAGE, 'damage', [DAMAGE_1, DAMAGE_2, DAMAGE_3]),
      makeZone(ZONE_SOUL, 'soul', [SOUL_1, SOUL_2]),
      makeZone(ZONE_DROP, 'drop', []),
      makeZone(ZONE_VANGUARD, 'vanguard_circle', [SOURCE_PIECE], 'single'),
    ],
    pieces: [
      makePiece(SOURCE_PIECE, 'card-source' as CardId),
      makePiece(DAMAGE_1, 'card-damage-1' as CardId),
      makePiece(DAMAGE_2, 'card-damage-2' as CardId),
      makePiece(DAMAGE_3, 'card-damage-3' as CardId),
      makePiece(SOUL_1, 'card-soul-1' as CardId),
      makePiece(SOUL_2, 'card-soul-2' as CardId),
      makePiece(DECK_1, 'card-deck-1' as CardId),
    ],
    pieceStates: faceDownDamagePieceIds.map((pieceId) => ({
      pieceId,
      orientation: 'stand',
      flags: [FACE_DOWN_DAMAGE_FLAG],
    })),
    flags: [],
    pendingRequests: [],
  }
}

function makeZone(
  zoneId: ZoneId,
  kind: string,
  pieceIds: readonly PieceId[],
  occupancy: 'single' | 'multi' = 'multi',
): GameState['zones'][number] {
  return {
    zoneId,
    kind,
    scope: 'player',
    ownerPlayerId: PLAYER_1,
    visibility: kind === 'deck' ? 'owner-private' : 'public',
    layout: {
      ordering:
        kind === 'deck' || kind === 'soul' || kind === 'drop'
          ? 'ordered'
          : 'unordered',
      occupancy,
    },
    occupants: pieceIds.map((pieceId) => ({ pieceId })),
  }
}

function makePiece(
  pieceId: PieceId,
  cardDefinitionId: CardId,
): GameState['pieces'][number] {
  return {
    pieceId,
    kind: 'card',
    ownerPlayerId: PLAYER_1,
    controllerPlayerId: PLAYER_1,
    cardDefinitionId,
  }
}

function defineResourceEffect(
  key: string,
  operations: readonly ResourceEffectOperation[],
  trigger: {
    readonly eventTypes?: readonly GameEvent['type'][]
    readonly timingPoint?: 'zone.transfer'
  } = {},
): EffectDefinition {
  const identity = createEffectIdentity('test', key)

  return defineEffectDefinition({
    id: identity.id,
    identity,
    kind: 'activated',
    trigger:
      trigger.eventTypes === undefined
        ? {
            kind: 'manual',
          }
        : {
            kind: 'event',
            eventTypes: trigger.eventTypes,
          },
    timing:
      trigger.timingPoint === undefined
        ? []
        : [createEffectTimingBinding(trigger.timingPoint, 'after')],
    applicability: {
      scope: 'global',
    },
    resolution: {
      model: 'automatic',
      strategy: {
        kind: 'declarative_descriptor',
        descriptorKey: createEffectDescriptorKey(key),
        operations,
      },
    },
  })
}

function counterBlast(count: number): ResourceEffectOperation {
  return {
    kind: 'counter_blast',
    count,
    player: 'source_controller',
    selection: 'deterministic_first',
    role: 'cost',
    duration: 'immediate',
  }
}

function counterCharge(count: number): ResourceEffectOperation {
  return {
    kind: 'counter_charge',
    count,
    player: 'source_controller',
    selection: 'deterministic_first',
    role: 'effect',
    duration: 'immediate',
  }
}

function soulBlast(count: number): ResourceEffectOperation {
  return {
    kind: 'soul_blast',
    count,
    player: 'source_controller',
    selection: 'deterministic_first',
    role: 'cost',
    duration: 'immediate',
  }
}

function soulCharge(count: number): ResourceEffectOperation {
  return {
    kind: 'soul_charge',
    count,
    player: 'source_controller',
    selection: 'deterministic_first',
    role: 'effect',
    duration: 'immediate',
  }
}

function energyBlast(count: number): ResourceEffectOperation {
  return {
    kind: 'energy_blast',
    count,
    player: 'source_controller',
    role: 'cost',
    duration: 'immediate',
  }
}

function zonePieceIds(state: GameState, zoneId: ZoneId): readonly PieceId[] {
  return (
    state.zones
      .find((zone) => zone.zoneId === zoneId)
      ?.occupants.map((occupant) => occupant.pieceId) ?? []
  )
}
