import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  BattleId,
  EffectDefinitionId,
  GamePieceStatusState,
  GameState,
  PieceId,
  PlayerId,
  RequestId,
  TransitionResult,
  ZoneId,
  ZoneSlotId,
} from '../index'
import {
  FACE_DOWN_DAMAGE_FLAG,
  applyGameAction,
  applyGameChoiceResponse,
  isAppliedTransitionResult,
} from '../index'

import {
  HEARTLURU_ATTACK_THRESHOLDS_EFFECT,
  HEARTLURU_SOUL_CALL_EFFECT,
  KAIRI_ATTACK_SEQUENCE_EFFECT,
  KAIRI_CHOICE_BOUNCE_EFFECT,
  KAIRI_REPLAY_EFFECT,
  PRISON_CAPTURE_EFFECT,
  PRISON_RELEASE_EFFECT,
  PRISON_SERAPH_ATTACK_EFFECT,
  REGUREGNUS_BATTLE_REPLACE_EFFECT,
  REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT,
  VYRGILLA_REWRITE_EFFECT,
  YOUTHBERK_REVOLDRESS_EFFECT,
} from './standard-slice'

const PLAYER_1 = 'player-standard-slice-1' as PlayerId
const PLAYER_2 = 'player-standard-slice-2' as PlayerId

const ZONE_P1_DECK = 'zone-standard-p1-deck' as ZoneId
const ZONE_P1_HAND = 'zone-standard-p1-hand' as ZoneId
const ZONE_P1_DROP = 'zone-standard-p1-drop' as ZoneId
const ZONE_P1_SOUL = 'zone-standard-p1-soul' as ZoneId
const ZONE_P1_DAMAGE = 'zone-standard-p1-damage' as ZoneId
const ZONE_P1_BIND = 'zone-standard-p1-bind' as ZoneId
const ZONE_P1_ORDER = 'zone-standard-p1-order' as ZoneId
const ZONE_P1_PRISON = 'zone-standard-p1-prison' as ZoneId
const ZONE_P1_VANGUARD = 'zone-standard-p1-vanguard' as ZoneId
const ZONE_P1_REAR = 'zone-standard-p1-rear' as ZoneId
const ZONE_P2_HAND = 'zone-standard-p2-hand' as ZoneId
const ZONE_P2_DROP = 'zone-standard-p2-drop' as ZoneId
const ZONE_P2_SOUL = 'zone-standard-p2-soul' as ZoneId
const ZONE_P2_DAMAGE = 'zone-standard-p2-damage' as ZoneId
const ZONE_P2_BIND = 'zone-standard-p2-bind' as ZoneId
const ZONE_P2_ORDER = 'zone-standard-p2-order' as ZoneId
const ZONE_P2_PRISON = 'zone-standard-p2-prison' as ZoneId
const ZONE_P2_VANGUARD = 'zone-standard-p2-vanguard' as ZoneId
const ZONE_P2_REAR = 'zone-standard-p2-rear' as ZoneId

const P1_FRONT_LEFT = 'slot-standard-p1-front-left' as ZoneSlotId
const P1_FRONT_CENTER = 'slot-standard-p1-front-center' as ZoneSlotId
const P1_FRONT_RIGHT = 'slot-standard-p1-front-right' as ZoneSlotId
const P1_BACK_LEFT = 'slot-standard-p1-back-left' as ZoneSlotId
const P1_BACK_RIGHT = 'slot-standard-p1-back-right' as ZoneSlotId
const P2_FRONT_LEFT = 'slot-standard-p2-front-left' as ZoneSlotId
const P2_FRONT_CENTER = 'slot-standard-p2-front-center' as ZoneSlotId
const P2_FRONT_RIGHT = 'slot-standard-p2-front-right' as ZoneSlotId
const P2_BACK_LEFT = 'slot-standard-p2-back-left' as ZoneSlotId
const P2_BACK_RIGHT = 'slot-standard-p2-back-right' as ZoneSlotId

describe('Standard vertical-slice critical deck handlers', () => {
  it('Reguregnus resolves Call of Deep Lands through request continuation and order zone placement', () => {
    const order = piece('reguregnus-order', PLAYER_1, [
      REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT.id,
    ])
    const dropA = piece('reguregnus-drop-a', PLAYER_1)
    const dropB = piece('reguregnus-drop-b', PLAYER_1)
    const state = makeSliceState({
      p1Hand: [order],
      p1Drop: [dropA, dropB],
    })
    const activation = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activate(order.id, REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT.id),
      }),
    )
    const request = activation.nextState.pendingRequests[0]

    expect(request).toMatchObject({
      type: 'choose.pieces',
      responderPlayerId: PLAYER_1,
      purpose: 'effect',
      eligiblePieceIds: [dropA.id, dropB.id],
      minSelections: 0,
      maxSelections: 2,
    })
    expect(request?.context?.effectContinuationId).toBeDefined()

    const response = expectApplied(
      applyGameChoiceResponse(activation.nextState, {
        expectedRevision: activation.nextState.revision,
        response: {
          requestId: request?.requestId as RequestId,
          responderPlayerId: PLAYER_1,
          type: 'answer.pieces',
          selectedPieceIds: [dropA.id, dropB.id],
        },
      }),
    )

    expect(zonePieceIds(response.nextState, ZONE_P1_REAR)).toEqual([
      dropA.id,
      dropB.id,
    ])
    expect(zonePieceIds(response.nextState, ZONE_P1_ORDER)).toEqual([order.id])
    expect(response.nextState.effectContinuations).toEqual([])
    expect(response.events.map((event) => event.type)).toContain(
      'effect.resolved',
    )
  })

  it('Reguregnus battle replacement works during an active battle and pays real costs', () => {
    const currentVanguard = piece('reguregnus-vanguard', PLAYER_1, [
      REGUREGNUS_BATTLE_REPLACE_EFFECT.id,
    ])
    const replacement = piece('reguregnus-replacement', PLAYER_1)
    const rearA = slottedPiece('reguregnus-rear-a', PLAYER_1, P1_FRONT_LEFT)
    const rearB = slottedPiece('reguregnus-rear-b', PLAYER_1, P1_FRONT_RIGHT)
    const damageA = piece('reguregnus-damage-a', PLAYER_1)
    const damageB = piece('reguregnus-damage-b', PLAYER_1)
    const state = makeSliceState({
      phase: 'battle',
      p1Vanguard: currentVanguard,
      p1Drop: [replacement],
      p1Rear: [rearA, rearB],
      p1Damage: [damageA, damageB],
      battle: activeBattle(currentVanguard.id),
    })
    const result = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activate(
          currentVanguard.id,
          REGUREGNUS_BATTLE_REPLACE_EFFECT.id,
          PLAYER_1,
          'reguregnus-replace',
        ),
      }),
    )

    expect(zonePieceIds(result.nextState, ZONE_P1_VANGUARD)).toEqual([
      replacement.id,
    ])
    expect(zonePieceIds(result.nextState, ZONE_P1_SOUL)).toEqual([
      currentVanguard.id,
    ])
    expect(zonePieceIds(result.nextState, ZONE_P1_DROP)).toEqual([
      rearA.id,
      rearB.id,
    ])
    expect(pieceStatus(result.nextState, damageA.id)?.flags).toContain(
      FACE_DOWN_DAMAGE_FLAG,
    )
    expect(pieceStatus(result.nextState, replacement.id)?.flags).toContain(
      'standard-slice.drive-minus-two.until-end-of-turn',
    )
  })

  it('Heartluru soul-calls through energy and gains attack thresholds from order count', () => {
    const heartluru = piece('heartluru-vanguard', PLAYER_1, [
      HEARTLURU_SOUL_CALL_EFFECT.id,
      HEARTLURU_ATTACK_THRESHOLDS_EFFECT.id,
    ])
    const soulA = piece('heartluru-soul-a', PLAYER_1)
    const soulB = piece('heartluru-soul-b', PLAYER_1)
    const orderCards = [
      piece('heartluru-order-a', PLAYER_1),
      piece('heartluru-order-b', PLAYER_1),
      piece('heartluru-order-c', PLAYER_1),
      piece('heartluru-order-d', PLAYER_1),
    ]
    const rear = slottedPiece('heartluru-rear', PLAYER_1, P1_FRONT_LEFT)
    const state = makeSliceState({
      p1Energy: 2,
      p1Vanguard: heartluru,
      p1Soul: [soulA, soulB],
      p1Order: orderCards,
      p1Rear: [rear],
      pieceStates: [rested(rear.id)],
    })
    const activation = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activate(heartluru.id, HEARTLURU_SOUL_CALL_EFFECT.id),
      }),
    )
    const request = activation.nextState.pendingRequests[0]

    expect(playerEnergy(activation.nextState, PLAYER_1)).toBe(1)
    expect(request).toMatchObject({
      type: 'choose.pieces',
      eligiblePieceIds: [soulA.id, soulB.id],
      minSelections: 0,
      maxSelections: 2,
    })

    const called = expectApplied(
      applyGameChoiceResponse(activation.nextState, {
        expectedRevision: activation.nextState.revision,
        response: {
          requestId: request?.requestId as RequestId,
          responderPlayerId: PLAYER_1,
          type: 'answer.pieces',
          selectedPieceIds: [soulA.id, soulB.id],
        },
      }),
    )

    expect(zonePieceIds(called.nextState, ZONE_P1_REAR)).toEqual([
      rear.id,
      soulA.id,
      soulB.id,
    ])

    const attack = expectApplied(
      applyGameAction(
        {
          ...called.nextState,
          turn: {
            ...called.nextState.turn,
            phase: 'battle' as GameState['turn']['phase'],
          },
        },
        {
          expectedRevision: called.nextState.revision,
          action: declareAttack(heartluru.id),
        },
      ),
    )

    expect(pieceStatus(attack.nextState, heartluru.id)?.powerModifier).toBe(
      5000,
    )
    expect(pieceStatus(attack.nextState, heartluru.id)?.criticalModifier).toBe(
      1,
    )
    expect(pieceStatus(attack.nextState, rear.id)?.orientation).toBe('stand')
  })

  it('Youthberk revoldresses by binding the current vanguard and replacing it from hand', () => {
    const oldVanguard = piece('youthberk-vanguard', PLAYER_1)
    const revoldress = piece('youthberk-revolform', PLAYER_1, [
      YOUTHBERK_REVOLDRESS_EFFECT.id,
    ])
    const state = makeSliceState({
      phase: 'battle',
      p1Vanguard: oldVanguard,
      p1Hand: [revoldress],
    })
    const result = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activate(
          revoldress.id,
          YOUTHBERK_REVOLDRESS_EFFECT.id,
          PLAYER_1,
          'youthberk-revoldress',
        ),
      }),
    )

    expect(zonePieceIds(result.nextState, ZONE_P1_VANGUARD)).toEqual([
      revoldress.id,
    ])
    expect(zonePieceIds(result.nextState, ZONE_P1_BIND)).toEqual([
      oldVanguard.id,
    ])
    expect(pieceStatus(result.nextState, revoldress.id)).toMatchObject({
      orientation: 'stand',
      powerModifier: 10000,
      criticalModifier: 1,
    })
  })

  it('Prison captures through request continuation, releases from prison, and scales Seraph attack pressure', () => {
    const seraph = piece('prison-seraph', PLAYER_1, [
      PRISON_CAPTURE_EFFECT.id,
      PRISON_SERAPH_ATTACK_EFFECT.id,
    ])
    const capturedA = piece('prison-captured-a', PLAYER_2, [
      PRISON_RELEASE_EFFECT.id,
    ])
    const capturedB = piece('prison-captured-b', PLAYER_2)
    const state = makeSliceState({
      p1Vanguard: seraph,
      p1Prison: [capturedB],
      p2Hand: [capturedA],
    })
    const capture = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activate(seraph.id, PRISON_CAPTURE_EFFECT.id),
      }),
    )
    const request = capture.nextState.pendingRequests[0]

    expect(request).toMatchObject({
      type: 'choose.pieces',
      responderPlayerId: PLAYER_2,
      eligiblePieceIds: [capturedA.id],
      maxSelections: 1,
    })

    const captured = expectApplied(
      applyGameChoiceResponse(capture.nextState, {
        expectedRevision: capture.nextState.revision,
        response: {
          requestId: request?.requestId as RequestId,
          responderPlayerId: PLAYER_2,
          type: 'answer.pieces',
          selectedPieceIds: [capturedA.id],
        },
      }),
    )

    expect(zonePieceIds(captured.nextState, ZONE_P1_PRISON)).toEqual([
      capturedB.id,
      capturedA.id,
    ])

    const released = expectApplied(
      applyGameAction(captured.nextState, {
        expectedRevision: captured.nextState.revision,
        action: activate(
          capturedA.id,
          PRISON_RELEASE_EFFECT.id,
          PLAYER_2,
          'prison-release',
        ),
      }),
    )

    expect(zonePieceIds(released.nextState, ZONE_P2_REAR)).toEqual([
      capturedA.id,
    ])

    const attack = expectApplied(
      applyGameAction(
        {
          ...captured.nextState,
          turn: {
            ...captured.nextState.turn,
            phase: 'battle' as GameState['turn']['phase'],
          },
        },
        {
          expectedRevision: captured.nextState.revision,
          action: declareAttack(seraph.id),
        },
      ),
    )

    expect(pieceStatus(attack.nextState, seraph.id)?.powerModifier).toBe(10000)
    expect(pieceStatus(attack.nextState, seraph.id)?.criticalModifier).toBe(1)
  })

  it('Vyrgilla rewrites from hand, binds opposing board, and stands own rear-guards', () => {
    const oldVanguard = piece('vyrgilla-vanguard', PLAYER_1)
    const rewrite = piece('vyrgilla-rewrite-form', PLAYER_1, [
      VYRGILLA_REWRITE_EFFECT.id,
    ])
    const ownRear = slottedPiece('vyrgilla-own-rear', PLAYER_1, P1_FRONT_LEFT)
    const opposingRear = slottedPiece(
      'vyrgilla-opponent-rear',
      PLAYER_2,
      P2_FRONT_LEFT,
    )
    const state = makeSliceState({
      phase: 'battle',
      p1Vanguard: oldVanguard,
      p1Hand: [rewrite],
      p1Rear: [ownRear],
      p2Rear: [opposingRear],
      pieceStates: [rested(ownRear.id)],
    })
    const result = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activate(
          rewrite.id,
          VYRGILLA_REWRITE_EFFECT.id,
          PLAYER_1,
          'vyrgilla-rewrite',
        ),
      }),
    )

    expect(zonePieceIds(result.nextState, ZONE_P1_VANGUARD)).toEqual([
      rewrite.id,
    ])
    expect(zonePieceIds(result.nextState, ZONE_P1_BIND)).toEqual([
      oldVanguard.id,
    ])
    expect(zonePieceIds(result.nextState, ZONE_P2_BIND)).toEqual([
      opposingRear.id,
    ])
    expect(pieceStatus(result.nextState, ownRear.id)?.orientation).toBe('stand')
    expect(pieceStatus(result.nextState, rewrite.id)?.powerModifier).toBe(10000)
  })

  it('Kairi bounces, replays, and resolves the attack sequence through deck handlers', () => {
    const kairi = piece('kairi-vanguard', PLAYER_1, [
      KAIRI_ATTACK_SEQUENCE_EFFECT.id,
      KAIRI_CHOICE_BOUNCE_EFFECT.id,
      KAIRI_REPLAY_EFFECT.id,
    ])
    const rearA = slottedPiece('kairi-rear-a', PLAYER_1, P1_FRONT_LEFT)
    const rearB = slottedPiece('kairi-rear-b', PLAYER_1, P1_FRONT_RIGHT)
    const handA = piece('kairi-hand-a', PLAYER_1)
    const handB = piece('kairi-hand-b', PLAYER_1)
    const state = makeSliceState({
      p1Energy: 1,
      p1Vanguard: kairi,
      p1Hand: [handA, handB],
      p1Rear: [rearA, rearB],
    })
    const bounce = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activate(kairi.id, KAIRI_CHOICE_BOUNCE_EFFECT.id),
      }),
    )
    const bounceRequest = bounce.nextState.pendingRequests[0]

    expect(bounceRequest).toMatchObject({
      type: 'choose.pieces',
      eligiblePieceIds: [rearA.id, rearB.id],
      maxSelections: 2,
    })

    const bounced = expectApplied(
      applyGameChoiceResponse(bounce.nextState, {
        expectedRevision: bounce.nextState.revision,
        response: {
          requestId: bounceRequest?.requestId as RequestId,
          responderPlayerId: PLAYER_1,
          type: 'answer.pieces',
          selectedPieceIds: [rearA.id, rearB.id],
        },
      }),
    )

    expect(zonePieceIds(bounced.nextState, ZONE_P1_HAND)).toEqual([
      handA.id,
      handB.id,
      rearA.id,
      rearB.id,
    ])

    const replay = expectApplied(
      applyGameAction(bounced.nextState, {
        expectedRevision: bounced.nextState.revision,
        action: activate(
          kairi.id,
          KAIRI_REPLAY_EFFECT.id,
          PLAYER_1,
          'kairi-replay',
        ),
      }),
    )
    const replayRequest = replay.nextState.pendingRequests[0]

    expect(playerEnergy(replay.nextState, PLAYER_1)).toBe(0)

    const replayed = expectApplied(
      applyGameChoiceResponse(replay.nextState, {
        expectedRevision: replay.nextState.revision,
        response: {
          requestId: replayRequest?.requestId as RequestId,
          responderPlayerId: PLAYER_1,
          type: 'answer.pieces',
          selectedPieceIds: [handA.id, handB.id],
        },
      }),
    )

    expect(zonePieceIds(replayed.nextState, ZONE_P1_REAR)).toEqual([
      handA.id,
      handB.id,
    ])

    const sequence = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activate(
          kairi.id,
          KAIRI_ATTACK_SEQUENCE_EFFECT.id,
          PLAYER_1,
          'kairi-attack-sequence',
        ),
      }),
    )

    expect(zonePieceIds(sequence.nextState, ZONE_P1_REAR)).toEqual([
      handA.id,
      handB.id,
    ])
    expect(pieceStatus(sequence.nextState, handA.id)?.powerModifier).toBe(5000)
    expect(pieceStatus(sequence.nextState, handB.id)?.powerModifier).toBe(5000)
  })
})

interface PieceConfig {
  readonly id: PieceId
  readonly ownerPlayerId: PlayerId
  readonly controllerPlayerId: PlayerId
  readonly effectDefinitionIds?: readonly EffectDefinitionId[]
}

interface SlottedPieceConfig extends PieceConfig {
  readonly slotId: ZoneSlotId
}

interface SliceStateOptions {
  readonly phase?: GameState['turn']['phase']
  readonly p1Energy?: number
  readonly p1Vanguard?: PieceConfig
  readonly p1Hand?: readonly PieceConfig[]
  readonly p1Drop?: readonly PieceConfig[]
  readonly p1Soul?: readonly PieceConfig[]
  readonly p1Damage?: readonly PieceConfig[]
  readonly p1Bind?: readonly PieceConfig[]
  readonly p1Order?: readonly PieceConfig[]
  readonly p1Prison?: readonly PieceConfig[]
  readonly p1Rear?: readonly SlottedPieceConfig[]
  readonly p2Vanguard?: PieceConfig
  readonly p2Hand?: readonly PieceConfig[]
  readonly p2Drop?: readonly PieceConfig[]
  readonly p2Soul?: readonly PieceConfig[]
  readonly p2Damage?: readonly PieceConfig[]
  readonly p2Bind?: readonly PieceConfig[]
  readonly p2Order?: readonly PieceConfig[]
  readonly p2Prison?: readonly PieceConfig[]
  readonly p2Rear?: readonly SlottedPieceConfig[]
  readonly pieceStates?: readonly GamePieceStatusState[]
  readonly battle?: GameState['battle']
}

function makeSliceState(options: SliceStateOptions = {}): GameState {
  const p1Vanguard =
    options.p1Vanguard ?? piece('default-p1-vanguard', PLAYER_1)
  const p2Vanguard =
    options.p2Vanguard ?? piece('default-p2-vanguard', PLAYER_2)
  const allPieces = uniquePieces([
    p1Vanguard,
    p2Vanguard,
    ...(options.p1Hand ?? []),
    ...(options.p1Drop ?? []),
    ...(options.p1Soul ?? []),
    ...(options.p1Damage ?? []),
    ...(options.p1Bind ?? []),
    ...(options.p1Order ?? []),
    ...(options.p1Prison ?? []),
    ...(options.p1Rear ?? []),
    ...(options.p2Hand ?? []),
    ...(options.p2Drop ?? []),
    ...(options.p2Soul ?? []),
    ...(options.p2Damage ?? []),
    ...(options.p2Bind ?? []),
    ...(options.p2Order ?? []),
    ...(options.p2Prison ?? []),
    ...(options.p2Rear ?? []),
  ])

  return {
    gameId: 'game-standard-slice-critical-handlers' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'in_progress',
    revision: 0,
    turn: {
      turnNumber: 2,
      turnPlayerId: PLAYER_1,
      priorityPlayerId: PLAYER_1,
      phase: options.phase ?? ('main' as GameState['turn']['phase']),
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
          ZONE_P1_SOUL,
          ZONE_P1_DAMAGE,
          ZONE_P1_BIND,
          ZONE_P1_ORDER,
          ZONE_P1_PRISON,
          ZONE_P1_VANGUARD,
          ZONE_P1_REAR,
        ],
        counters:
          options.p1Energy === undefined
            ? []
            : [
                {
                  key: 'energy',
                  amount: options.p1Energy,
                  visibility: 'public',
                },
              ],
        flags: [],
      },
      {
        playerId: PLAYER_2,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [
          ZONE_P2_HAND,
          ZONE_P2_DROP,
          ZONE_P2_SOUL,
          ZONE_P2_DAMAGE,
          ZONE_P2_BIND,
          ZONE_P2_ORDER,
          ZONE_P2_PRISON,
          ZONE_P2_VANGUARD,
          ZONE_P2_REAR,
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      makeZone(ZONE_P1_DECK, PLAYER_1, 'deck', []),
      makeZone(ZONE_P1_HAND, PLAYER_1, 'hand', options.p1Hand ?? []),
      makeZone(ZONE_P1_DROP, PLAYER_1, 'drop', options.p1Drop ?? []),
      makeZone(ZONE_P1_SOUL, PLAYER_1, 'soul', options.p1Soul ?? []),
      makeZone(ZONE_P1_DAMAGE, PLAYER_1, 'damage', options.p1Damage ?? []),
      makeZone(ZONE_P1_BIND, PLAYER_1, 'bind', options.p1Bind ?? []),
      makeZone(ZONE_P1_ORDER, PLAYER_1, 'order_zone', options.p1Order ?? []),
      makeZone(ZONE_P1_PRISON, PLAYER_1, 'prison', options.p1Prison ?? []),
      makeZone(ZONE_P1_VANGUARD, PLAYER_1, 'vanguard_circle', [p1Vanguard]),
      makeRearGuardZone(ZONE_P1_REAR, PLAYER_1, options.p1Rear ?? []),
      makeZone(ZONE_P2_HAND, PLAYER_2, 'hand', options.p2Hand ?? []),
      makeZone(ZONE_P2_DROP, PLAYER_2, 'drop', options.p2Drop ?? []),
      makeZone(ZONE_P2_SOUL, PLAYER_2, 'soul', options.p2Soul ?? []),
      makeZone(ZONE_P2_DAMAGE, PLAYER_2, 'damage', options.p2Damage ?? []),
      makeZone(ZONE_P2_BIND, PLAYER_2, 'bind', options.p2Bind ?? []),
      makeZone(ZONE_P2_ORDER, PLAYER_2, 'order_zone', options.p2Order ?? []),
      makeZone(ZONE_P2_PRISON, PLAYER_2, 'prison', options.p2Prison ?? []),
      makeZone(ZONE_P2_VANGUARD, PLAYER_2, 'vanguard_circle', [p2Vanguard]),
      makeRearGuardZone(ZONE_P2_REAR, PLAYER_2, options.p2Rear ?? []),
    ],
    pieces: allPieces.map(toGamePiece),
    pieceStates: options.pieceStates ?? [],
    flags: [],
    pendingRequests: [],
    ...(options.battle === undefined ? {} : { battle: options.battle }),
  }
}

function piece(
  key: string,
  ownerPlayerId: PlayerId,
  effectDefinitionIds: readonly EffectDefinitionId[] = [],
): PieceConfig {
  return {
    id: `piece-standard-${key}` as PieceId,
    ownerPlayerId,
    controllerPlayerId: ownerPlayerId,
    ...(effectDefinitionIds.length === 0 ? {} : { effectDefinitionIds }),
  }
}

function slottedPiece(
  key: string,
  ownerPlayerId: PlayerId,
  slotId: ZoneSlotId,
  effectDefinitionIds: readonly EffectDefinitionId[] = [],
): SlottedPieceConfig {
  return {
    ...piece(key, ownerPlayerId, effectDefinitionIds),
    slotId,
  }
}

function toGamePiece(config: PieceConfig): GameState['pieces'][number] {
  return {
    pieceId: config.id,
    kind: 'card',
    ownerPlayerId: config.ownerPlayerId,
    controllerPlayerId: config.controllerPlayerId,
    cardDefinitionId: `card:${config.id}` as CardId,
    ...(config.effectDefinitionIds === undefined
      ? {}
      : {
          effectDefinitionIds: config.effectDefinitionIds,
        }),
  }
}

function uniquePieces(pieces: readonly PieceConfig[]): readonly PieceConfig[] {
  const seen = new Set<PieceId>()
  const result: PieceConfig[] = []

  for (const current of pieces) {
    if (seen.has(current.id)) {
      continue
    }

    seen.add(current.id)
    result.push(current)
  }

  return result
}

function makeZone(
  zoneId: ZoneId,
  ownerPlayerId: PlayerId,
  kind: string,
  pieces: readonly PieceConfig[],
): GameState['zones'][number] {
  return {
    zoneId,
    kind,
    scope: 'player',
    ownerPlayerId,
    visibility: kind === 'hand' || kind === 'deck' ? 'owner-private' : 'public',
    layout: {
      ordering: kind === 'deck' || kind === 'drop' ? 'ordered' : 'unordered',
      occupancy: kind === 'vanguard_circle' ? 'single' : 'multi',
    },
    occupants: pieces.map((current) => ({ pieceId: current.id })),
  }
}

function makeRearGuardZone(
  zoneId: ZoneId,
  ownerPlayerId: PlayerId,
  pieces: readonly SlottedPieceConfig[],
): GameState['zones'][number] {
  return {
    zoneId,
    kind: 'rear_guard_circle',
    scope: 'player',
    ownerPlayerId,
    visibility: 'public',
    layout: {
      ordering: 'unordered',
      occupancy: 'slotted',
      slotIds:
        ownerPlayerId === PLAYER_1
          ? [
              P1_FRONT_LEFT,
              P1_FRONT_CENTER,
              P1_FRONT_RIGHT,
              P1_BACK_LEFT,
              P1_BACK_RIGHT,
            ]
          : [
              P2_FRONT_LEFT,
              P2_FRONT_CENTER,
              P2_FRONT_RIGHT,
              P2_BACK_LEFT,
              P2_BACK_RIGHT,
            ],
    },
    occupants: pieces.map((current) => ({
      pieceId: current.id,
      slotId: current.slotId,
    })),
  }
}

function activate(
  sourcePieceId: PieceId,
  effectDefinitionId: EffectDefinitionId,
  playerId = PLAYER_1,
  key = `${sourcePieceId}:${effectDefinitionId}`,
) {
  return {
    actionId: `action-standard-slice-activate:${key}` as ActionId,
    type: 'card.activate_effect' as const,
    actor: {
      kind: 'player' as const,
      playerId,
    },
    sourcePieceId,
    effectDefinitionId,
  }
}

function declareAttack(attackerPieceId: PieceId) {
  return {
    actionId: `action-standard-slice-attack:${attackerPieceId}` as ActionId,
    type: 'battle.declare_attack' as const,
    actor: {
      kind: 'player' as const,
      playerId: PLAYER_1,
    },
    attackerPieceId,
    target: {
      kind: 'player' as const,
      playerId: PLAYER_2,
    },
  }
}

function activeBattle(attackerPieceId: PieceId): GameState['battle'] {
  return {
    battleId: 'battle-standard-slice-active' as BattleId,
    status: 'attack_declared',
    attackingPlayerId: PLAYER_1,
    defendingPlayerId: PLAYER_2,
    attackerPieceId,
    attackerZoneId: ZONE_P1_VANGUARD,
    target: {
      kind: 'player',
      playerId: PLAYER_2,
    },
    guardPieceIds: [],
  }
}

function rested(pieceId: PieceId): GamePieceStatusState {
  return {
    pieceId,
    orientation: 'rest',
    flags: [],
  }
}

function expectApplied(result: TransitionResult) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error(
      `Expected applied transition result, received ${result.status}.`,
    )
  }

  return result
}

function zonePieceIds(state: GameState, zoneId: ZoneId): readonly PieceId[] {
  return (
    state.zones
      .find((zone) => zone.zoneId === zoneId)
      ?.occupants.map((occupant) => occupant.pieceId) ?? []
  )
}

function pieceStatus(
  state: GameState,
  pieceId: PieceId,
): GamePieceStatusState | undefined {
  return state.pieceStates.find((current) => current.pieceId === pieceId)
}

function playerEnergy(state: GameState, playerId: PlayerId): number {
  return (
    state.players
      .find((player) => player.playerId === playerId)
      ?.counters.find((counter) => counter.key === 'energy')?.amount ?? 0
  )
}
