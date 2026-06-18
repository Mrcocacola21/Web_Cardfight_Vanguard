import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  DeclarativeEffectOperation,
  EffectDefinition,
  EffectDefinitionId,
  GameState,
  PieceId,
  PlayerId,
  RequestId,
  ZoneId,
  ZoneSlotId,
} from '../index'
import {
  applyGameAction,
  applyGameChoiceResponse,
  buildEngineCardStatsSnapshot,
  coreEffectHandlerRegistry,
  createEffectDescriptorKey,
  createEffectIdentity,
  createEffectRegistry,
  defineEffectDefinition,
  dispatchStandardCommand,
  isAcceptedEngineDispatchResult,
  isInvalidEngineDispatchResult,
} from '../index'

const PLAYER_1 = 'player-activated-1' as PlayerId
const PLAYER_2 = 'player-activated-2' as PlayerId
const SOURCE_PIECE = 'piece-activated-source' as PieceId
const SEARCH_TARGET = 'piece-search-target' as PieceId
const CALL_TARGET = 'piece-call-target' as PieceId
const OWN_REAR = 'piece-own-rear' as PieceId
const OPP_RETIRE = 'piece-opponent-retire' as PieceId
const OPP_BIND = 'piece-opponent-bind' as PieceId
const OPP_IMPRISON = 'piece-opponent-imprison' as PieceId
const ORDER_CARD = 'piece-set-order' as PieceId

const ZONE_P1_DECK = 'zone-p1-deck' as ZoneId
const ZONE_P1_HAND = 'zone-p1-hand' as ZoneId
const ZONE_P1_DROP = 'zone-p1-drop' as ZoneId
const ZONE_P1_REAR = 'zone-p1-rear' as ZoneId
const ZONE_P1_BIND = 'zone-p1-bind' as ZoneId
const ZONE_P1_ORDER = 'zone-p1-order' as ZoneId
const ZONE_P1_PRISON = 'zone-p1-prison' as ZoneId
const ZONE_P2_HAND = 'zone-p2-hand' as ZoneId
const ZONE_P2_DROP = 'zone-p2-drop' as ZoneId
const ZONE_P2_REAR = 'zone-p2-rear' as ZoneId
const ZONE_P2_BIND = 'zone-p2-bind' as ZoneId

const SLOT_P1_LEFT = 'slot-p1-left' as ZoneSlotId
const SLOT_P1_RIGHT = 'slot-p1-right' as ZoneSlotId
const SLOT_P2_LEFT = 'slot-p2-left' as ZoneSlotId
const SLOT_P2_RIGHT = 'slot-p2-right' as ZoneSlotId

describe('activated Standard effect runtime foundation', () => {
  it('activates a bound manual effect, pauses on choose.pieces, and resumes the same effect flow', () => {
    const searchEffect = defineActivatedEffect('runtime-search', [
      {
        kind: 'search',
        from: {
          player: 'source_controller',
          kind: 'deck',
        },
        to: {
          player: 'source_controller',
          kind: 'hand',
        },
        selection: 'request',
        minSelections: 1,
        maxSelections: 1,
      },
    ])
    const state = makeActivatedState({
      sourceEffectDefinitionIds: [searchEffect.id],
    })
    const activation = applyGameAction(
      state,
      {
        expectedRevision: state.revision,
        action: activateAction(searchEffect.id),
      },
      {
        activatedEffects: runtimeEnvironment(searchEffect),
      },
    )

    expect(activation.status).toBe('applied')

    if (activation.status !== 'applied') {
      throw new Error(activation.message)
    }

    const request = activation.nextState.pendingRequests[0]

    expect(activation.events.map((event) => event.type)).toEqual([
      'effect.activated',
    ])
    expect(activation.nextState.status).toBe('awaiting_choice')
    expect(request).toMatchObject({
      type: 'choose.pieces',
      responderPlayerId: PLAYER_1,
      purpose: 'effect',
      minSelections: 1,
      maxSelections: 1,
      eligiblePieceIds: [SEARCH_TARGET],
    })
    expect(request?.context?.effectContinuationId).toBeDefined()
    expect(activation.nextState.effectContinuations).toHaveLength(1)

    const response = applyGameChoiceResponse(
      activation.nextState,
      {
        expectedRevision: activation.nextState.revision,
        response: {
          requestId: request?.requestId as RequestId,
          responderPlayerId: PLAYER_1,
          type: 'answer.pieces',
          selectedPieceIds: [SEARCH_TARGET],
        },
      },
      {
        activatedEffects: runtimeEnvironment(searchEffect),
      },
    )

    expect(response.status).toBe('applied')

    if (response.status !== 'applied') {
      throw new Error(response.message)
    }

    expect(response.events.map((event) => event.type)).toEqual([
      'choice.response_resolved',
      'piece.moved',
      'effect.resolved',
    ])
    expect(zonePieceIds(response.nextState, ZONE_P1_DECK)).toEqual([])
    expect(zonePieceIds(response.nextState, ZONE_P1_HAND)).toEqual([
      SOURCE_PIECE,
      SEARCH_TARGET,
    ])
    expect(response.nextState.pendingRequests).toEqual([])
    expect(response.nextState.effectContinuations).toEqual([])
    expect(response.nextState.status).toBe('in_progress')
  })

  it('rejects unbound or stale activated-effect responses structurally', () => {
    const searchEffect = defineActivatedEffect('runtime-search-reject', [
      {
        kind: 'search',
        from: {
          player: 'source_controller',
          kind: 'deck',
        },
        to: {
          player: 'source_controller',
          kind: 'hand',
        },
        selection: 'request',
        minSelections: 1,
        maxSelections: 1,
      },
    ])
    const unboundResult = applyGameAction(
      makeActivatedState(),
      {
        action: activateAction(searchEffect.id),
      },
      {
        activatedEffects: runtimeEnvironment(searchEffect),
      },
    )

    expect(unboundResult).toMatchObject({
      status: 'invalid',
      code: 'invalid_action',
    })

    const activation = applyGameAction(
      makeActivatedState({
        sourceEffectDefinitionIds: [searchEffect.id],
      }),
      {
        action: activateAction(searchEffect.id),
      },
      {
        activatedEffects: runtimeEnvironment(searchEffect),
      },
    )

    expect(activation.status).toBe('applied')

    if (activation.status !== 'applied') {
      throw new Error(activation.message)
    }

    const request = activation.nextState.pendingRequests[0]
    const wrongResponder = applyGameChoiceResponse(activation.nextState, {
      response: {
        requestId: request?.requestId as RequestId,
        responderPlayerId: PLAYER_2,
        type: 'answer.pieces',
        selectedPieceIds: [SEARCH_TARGET],
      },
    })

    expect(wrongResponder).toMatchObject({
      status: 'invalid',
      code: 'request_response_mismatch',
    })
  })

  it('runs bounded generic ops for resources, call, retire, bind, bounce, prison, search, and order zone', () => {
    const effect = defineActivatedEffect('runtime-generic-ops', [
      {
        kind: 'energy_blast',
        count: 2,
        player: 'source_controller',
        role: 'cost',
        duration: 'immediate',
      },
      {
        kind: 'call',
        from: {
          player: 'source_controller',
          kind: 'drop',
        },
        selection: 'deterministic_first',
        minSelections: 1,
        maxSelections: 1,
        destination: 'first_open_rear_guard',
      },
      {
        kind: 'retire',
        from: {
          player: 'opponent',
          kind: 'rear_guard_circle',
        },
        selection: 'deterministic_first',
        minSelections: 1,
        maxSelections: 1,
      },
      {
        kind: 'bind',
        from: {
          player: 'opponent',
          kind: 'rear_guard_circle',
        },
        toPlayer: 'owner',
        selection: 'deterministic_first',
        minSelections: 1,
        maxSelections: 1,
      },
      {
        kind: 'bounce',
        from: {
          player: 'source_controller',
          kind: 'rear_guard_circle',
        },
        selection: 'deterministic_first',
        minSelections: 1,
        maxSelections: 1,
      },
      {
        kind: 'imprison',
        from: {
          player: 'opponent',
          kind: 'hand',
        },
        selection: 'deterministic_first',
        minSelections: 1,
        maxSelections: 1,
      },
      {
        kind: 'search',
        from: {
          player: 'source_controller',
          kind: 'deck',
        },
        to: {
          player: 'source_controller',
          kind: 'hand',
        },
        selection: 'deterministic_first',
        minSelections: 1,
        maxSelections: 1,
      },
      {
        kind: 'move_source_to_order_zone',
        mode: 'place',
      },
    ])
    const state = makeActivatedState({
      energy: 3,
      sourceEffectDefinitionIds: [effect.id],
      includeGenericTargets: true,
    })
    const result = applyGameAction(
      state,
      {
        expectedRevision: state.revision,
        action: activateAction(effect.id),
      },
      {
        activatedEffects: runtimeEnvironment(effect),
      },
    )

    expect(result.status).toBe('applied')

    if (result.status !== 'applied') {
      throw new Error(result.message)
    }

    expect(result.events.map((event) => event.type)).toEqual([
      'effect.activated',
      'resource.energy_blasted',
      'piece.moved',
      'piece.moved',
      'piece.moved',
      'piece.moved',
      'piece.moved',
      'piece.moved',
      'piece.moved',
      'effect.resolved',
    ])
    expect(
      result.nextState.players.find((player) => player.playerId === PLAYER_1)
        ?.counters,
    ).toContainEqual({
      key: 'energy',
      amount: 1,
      visibility: 'public',
    })
    expect(zonePieceIds(result.nextState, ZONE_P1_DROP)).toEqual([])
    expect(zonePieceIds(result.nextState, ZONE_P1_REAR)).toEqual([CALL_TARGET])
    expect(zonePieceIds(result.nextState, ZONE_P2_DROP)).toEqual([OPP_RETIRE])
    expect(zonePieceIds(result.nextState, ZONE_P2_BIND)).toEqual([OPP_BIND])
    expect(zonePieceIds(result.nextState, ZONE_P1_HAND)).toEqual([
      OWN_REAR,
      SEARCH_TARGET,
    ])
    expect(zonePieceIds(result.nextState, ZONE_P1_PRISON)).toEqual([
      OPP_IMPRISON,
    ])
    expect(zonePieceIds(result.nextState, ZONE_P1_ORDER)).toEqual([
      SOURCE_PIECE,
    ])
  })

  it('plays Standard set orders through card.play into the order zone', () => {
    const state = makeActivatedState({
      includeOrderCard: true,
    })
    const result = dispatchStandardCommand(state, {
      kind: 'action',
      submission: {
        expectedRevision: state.revision,
        action: {
          actionId: 'action-play-set-order' as ActionId,
          type: 'card.play',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          pieceId: ORDER_CARD,
          from: {
            zoneId: ZONE_P1_HAND,
          },
          to: {
            zoneId: ZONE_P1_ORDER,
          },
        },
      },
    })

    expect(isAcceptedEngineDispatchResult(result)).toBe(true)

    if (!isAcceptedEngineDispatchResult(result)) {
      throw new Error(result.message)
    }

    expect(result.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'card.played',
    ])
    expect(zonePieceIds(result.state, ZONE_P1_ORDER)).toEqual([ORDER_CARD])
  })

  it('exposes activated card effects through the Standard adapter action surface', () => {
    const state = makeActivatedState()
    const result = dispatchStandardCommand(state, {
      kind: 'action',
      submission: {
        expectedRevision: state.revision,
        action: activateAction(
          'effect:test:not-registered' as EffectDefinitionId,
        ),
      },
    })

    expect(isInvalidEngineDispatchResult(result)).toBe(true)

    if (!isInvalidEngineDispatchResult(result)) {
      throw new Error(`Expected invalid result, received ${result.status}.`)
    }

    expect(result.code).toBe('invalid_action_reference')
  })
})

interface ActivatedStateOptions {
  readonly energy?: number
  readonly sourceEffectDefinitionIds?: readonly EffectDefinitionId[]
  readonly includeGenericTargets?: boolean
  readonly includeOrderCard?: boolean
}

function makeActivatedState(options: ActivatedStateOptions = {}): GameState {
  const includeGenericTargets = options.includeGenericTargets === true
  const includeOrderCard = options.includeOrderCard === true
  const p1HandPieces = [SOURCE_PIECE, ...(includeOrderCard ? [ORDER_CARD] : [])]
  const p1DeckPieces = [SEARCH_TARGET]
  const p1DropPieces = includeGenericTargets ? [CALL_TARGET] : []
  const p2HandPieces = includeGenericTargets ? [OPP_IMPRISON] : []

  return {
    gameId: 'game-activated-runtime' as GameState['gameId'],
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
          ZONE_P1_DECK,
          ZONE_P1_HAND,
          ZONE_P1_DROP,
          ZONE_P1_REAR,
          ZONE_P1_BIND,
          ZONE_P1_ORDER,
          ZONE_P1_PRISON,
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
        ownedZoneIds: [ZONE_P2_HAND, ZONE_P2_DROP, ZONE_P2_REAR, ZONE_P2_BIND],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      makeZone(ZONE_P1_DECK, PLAYER_1, 'deck', p1DeckPieces, 'owner-private'),
      makeZone(ZONE_P1_HAND, PLAYER_1, 'hand', p1HandPieces, 'owner-private'),
      makeZone(ZONE_P1_DROP, PLAYER_1, 'drop', p1DropPieces),
      makeZone(ZONE_P1_BIND, PLAYER_1, 'bind', []),
      makeZone(ZONE_P1_ORDER, PLAYER_1, 'order_zone', []),
      makeZone(ZONE_P1_PRISON, PLAYER_1, 'prison', []),
      makeRearGuardZone(ZONE_P1_REAR, PLAYER_1, [
        {
          pieceId: OWN_REAR,
          slotId: SLOT_P1_LEFT,
          enabled: includeGenericTargets,
        },
      ]),
      makeZone(ZONE_P2_HAND, PLAYER_2, 'hand', p2HandPieces, 'owner-private'),
      makeZone(ZONE_P2_DROP, PLAYER_2, 'drop', []),
      makeZone(ZONE_P2_BIND, PLAYER_2, 'bind', []),
      makeRearGuardZone(ZONE_P2_REAR, PLAYER_2, [
        {
          pieceId: OPP_RETIRE,
          slotId: SLOT_P2_LEFT,
          enabled: includeGenericTargets,
        },
        {
          pieceId: OPP_BIND,
          slotId: SLOT_P2_RIGHT,
          enabled: includeGenericTargets,
        },
      ]),
    ],
    pieces: [
      makePiece(SOURCE_PIECE, 'card-source' as CardId, PLAYER_1, {
        effectDefinitionIds: options.sourceEffectDefinitionIds ?? [],
      }),
      makePiece(SEARCH_TARGET, 'card-search-target' as CardId, PLAYER_1),
      ...(includeGenericTargets
        ? [
            makePiece(CALL_TARGET, 'card-call-target' as CardId, PLAYER_1),
            makePiece(OWN_REAR, 'card-own-rear' as CardId, PLAYER_1),
            makePiece(OPP_RETIRE, 'card-opponent-retire' as CardId, PLAYER_2),
            makePiece(OPP_BIND, 'card-opponent-bind' as CardId, PLAYER_2),
            makePiece(
              OPP_IMPRISON,
              'card-opponent-imprison' as CardId,
              PLAYER_2,
            ),
          ]
        : []),
      ...(includeOrderCard
        ? [makePiece(ORDER_CARD, 'card-set-order' as CardId, PLAYER_1)]
        : []),
    ],
    cardStats: buildEngineCardStatsSnapshot([
      makeStats('card-source' as CardId),
      makeStats('card-search-target' as CardId),
      makeStats('card-call-target' as CardId),
      makeStats('card-own-rear' as CardId),
      makeStats('card-opponent-retire' as CardId),
      makeStats('card-opponent-bind' as CardId),
      makeStats('card-opponent-imprison' as CardId),
      makeStats('card-set-order' as CardId, 'set-order'),
    ]),
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function defineActivatedEffect(
  key: string,
  operations: readonly DeclarativeEffectOperation[],
): EffectDefinition {
  const identity = createEffectIdentity('test', key)

  return defineEffectDefinition({
    id: identity.id,
    identity,
    kind: 'activated',
    trigger: {
      kind: 'manual',
    },
    timing: [],
    applicability: {
      scope: 'global',
    },
    resolution: {
      model: 'optional',
      strategy: {
        kind: 'declarative_descriptor',
        descriptorKey: createEffectDescriptorKey(key),
        operations,
      },
    },
  })
}

function runtimeEnvironment(effectDefinition: EffectDefinition) {
  return {
    effectRegistry: createEffectRegistry([effectDefinition]),
    effectHandlers: coreEffectHandlerRegistry,
  }
}

function activateAction(effectDefinitionId: EffectDefinitionId) {
  return {
    actionId: `action-activate-${effectDefinitionId}` as unknown as ActionId,
    type: 'card.activate_effect' as const,
    actor: {
      kind: 'player' as const,
      playerId: PLAYER_1,
    },
    sourcePieceId: SOURCE_PIECE,
    effectDefinitionId,
  }
}

function makePiece(
  pieceId: PieceId,
  cardDefinitionId: CardId,
  ownerPlayerId: PlayerId,
  options: {
    readonly effectDefinitionIds?: readonly EffectDefinitionId[]
  } = {},
): GameState['pieces'][number] {
  return {
    pieceId,
    kind: 'card',
    cardDefinitionId,
    ownerPlayerId,
    controllerPlayerId: ownerPlayerId,
    ...(options.effectDefinitionIds === undefined ||
    options.effectDefinitionIds.length === 0
      ? {}
      : {
          effectDefinitionIds: options.effectDefinitionIds,
        }),
  }
}

function makeStats(
  cardDefinitionId: CardId,
  cardType: NonNullable<
    GameState['cardStats']
  >['cards'][number]['cardType'] = 'normal-unit',
): NonNullable<GameState['cardStats']>['cards'][number] {
  return {
    cardDefinitionId,
    cardType,
    grade: 3,
    power: cardType === 'set-order' ? 0 : 13000,
    shield: 0,
    critical: cardType === 'set-order' ? 0 : 1,
    triggerType: null,
    keywords: [],
  }
}

function makeZone(
  zoneId: ZoneId,
  ownerPlayerId: PlayerId,
  kind: string,
  pieceIds: readonly PieceId[],
  visibility: GameState['zones'][number]['visibility'] = 'public',
): GameState['zones'][number] {
  return {
    zoneId,
    kind,
    scope: 'player',
    ownerPlayerId,
    visibility,
    layout: {
      ordering: kind === 'deck' || kind === 'drop' ? 'ordered' : 'unordered',
      occupancy: 'multi',
    },
    occupants: pieceIds.map((pieceId) => ({ pieceId })),
  }
}

function makeRearGuardZone(
  zoneId: ZoneId,
  ownerPlayerId: PlayerId,
  pieces: readonly {
    readonly pieceId: PieceId
    readonly slotId: ZoneSlotId
    readonly enabled: boolean
  }[],
): GameState['zones'][number] {
  const slotIds =
    ownerPlayerId === PLAYER_1
      ? [SLOT_P1_LEFT, SLOT_P1_RIGHT]
      : [SLOT_P2_LEFT, SLOT_P2_RIGHT]

  return {
    zoneId,
    kind: 'rear_guard_circle',
    scope: 'player',
    ownerPlayerId,
    visibility: 'public',
    layout: {
      ordering: 'unordered',
      occupancy: 'slotted',
      slotIds,
    },
    occupants: pieces
      .filter((piece) => piece.enabled)
      .map((piece) => ({
        pieceId: piece.pieceId,
        slotId: piece.slotId,
      })),
  }
}

function zonePieceIds(state: GameState, zoneId: ZoneId): readonly PieceId[] {
  return (
    state.zones
      .find((zone) => zone.zoneId === zoneId)
      ?.occupants.map((occupant) => occupant.pieceId) ?? []
  )
}
