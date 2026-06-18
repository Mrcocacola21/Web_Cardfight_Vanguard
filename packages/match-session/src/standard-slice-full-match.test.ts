import { describe, expect, it } from 'vitest'

import type {
  CardId,
  DeckId,
  DeckSnapshot,
  EffectRefId,
  GameplayCard,
} from '@web-vg/shared'
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
  STANDARD_FORMAT_ID,
  VYRGILLA_REWRITE_EFFECT,
  YOUTHBERK_REVOLDRESS_EFFECT,
  applyGameAction,
  applyGameChoiceResponse,
  isAppliedTransitionResult,
  resolveNextTurnPhase,
  type ActionId,
  type EffectDefinition,
  type EffectDefinitionId,
  type GameChoiceRequest,
  type GameId,
  type GamePieceStatusState,
  type GameState,
  type PhaseId,
  type PieceId,
  type PlayerId,
  type TransitionResult,
  type ZoneId,
  type ZoneKind,
  type ZoneSlotId,
  type ZoneTransferReason,
} from '@web-vg/rules-core'

import { createDeckBackedGameState } from './deck-bootstrap'
import type {
  CreateDeckBackedGameStateInput,
  DeckBackedMatchPlayerInput,
} from './deck-bootstrap'

type DeckKey =
  | 'reguregnus'
  | 'heartluru'
  | 'youthberk'
  | 'prison'
  | 'vyrgilla'
  | 'kairi'

interface SliceDeckFixture {
  readonly key: DeckKey
  readonly label: string
  readonly deckSnapshot: DeckSnapshot
  readonly cardDefinitions: readonly GameplayCard[]
  readonly cards: Record<string, CardId>
  readonly boundEffects: readonly EffectDefinitionId[]
}

const PLAYER_1 = 'player-standard-fullmatch-1' as PlayerId
const PLAYER_2 = 'player-standard-fullmatch-2' as PlayerId
const P1_FRONT_LEFT = 'p1:front-left' as ZoneSlotId
const P1_FRONT_RIGHT = 'p1:front-right' as ZoneSlotId
const P2_FRONT_LEFT = 'p2:front-left' as ZoneSlotId

const FIXTURES = {
  reguregnus: createReguregnusFixture(),
  heartluru: createHeartluruFixture(),
  youthberk: createYouthberkFixture(),
  prison: createPrisonFixture(),
  vyrgilla: createVyrgillaFixture(),
  kairi: createKairiFixture(),
} satisfies Record<DeckKey, SliceDeckFixture>

describe('Standard vertical-slice full-match integration', () => {
  it('assembles all six target deck fixtures and binds effect ids onto runtime pieces', () => {
    for (const fixture of Object.values(FIXTURES)) {
      const result = createDeckBackedGameState(
        createBootstrapInput(fixture.key, 'prison', {
          gameId: `game-standard-fullmatch-bootstrap:${fixture.key}` as GameId,
        }),
      )

      expect(result.ok).toBe(true)

      if (!result.ok) {
        throw new Error(result.message)
      }

      const playerOnePieces = result.state.pieces.filter(
        (piece) => piece.ownerPlayerId === PLAYER_1,
      )
      const boundEffectIds = new Set(
        playerOnePieces.flatMap((piece) => piece.effectDefinitionIds ?? []),
      )

      for (const effectId of fixture.boundEffects) {
        expect(boundEffectIds.has(effectId)).toBe(true)
      }

      expect(zone(result.state, PLAYER_1, 'ride_deck')?.occupants).toHaveLength(
        3,
      )
      expect(zone(result.state, PLAYER_1, 'order_zone')).toBeDefined()
      expect(zone(result.state, PLAYER_1, 'prison')).toBeDefined()
      expect(playerEnergy(result.state, PLAYER_1)).toBe(0)
    }
  })

  it('runs Reguregnus vs Prison from deck bootstrap to damage-defeat through effects, continuation, trigger, and battle flow', () => {
    let state = startFullMatchOnPlayerOneTurn('reguregnus', 'prison')
    const reguregnus = FIXTURES.reguregnus

    state = moveCardToZone(
      state,
      PLAYER_1,
      reguregnus.cards.dropCallerA,
      'drop',
      'effect',
    )
    state = moveCardToZone(
      state,
      PLAYER_1,
      reguregnus.cards.dropCallerB,
      'drop',
      'effect',
    )
    state = moveCardToZone(
      state,
      PLAYER_1,
      reguregnus.cards.replacement,
      'drop',
      'effect',
    )
    state = moveTopDeckCardsToDamage(state, PLAYER_1, 1)
    state = moveTopDeckCardsToDamage(state, PLAYER_2, 4)

    const orderActivation = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activateByCard(
          state,
          PLAYER_1,
          reguregnus.cards.callOfDeepLands,
          REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT.id,
          'reguregnus-call-of-deep-lands',
        ),
      }),
    )
    const callRequest = requireRequest(
      orderActivation.nextState,
      'choose.pieces',
    )

    expect(callRequest.context?.effectContinuationId).toBeDefined()

    state = answerPieces(orderActivation.nextState, [
      pieceIdForCard(
        orderActivation.nextState,
        PLAYER_1,
        reguregnus.cards.dropCallerA,
      ),
      pieceIdForCard(
        orderActivation.nextState,
        PLAYER_1,
        reguregnus.cards.dropCallerB,
      ),
    ])

    expect(zoneCardIds(state, PLAYER_1, 'rear_guard_circle')).toEqual([
      reguregnus.cards.dropCallerA,
      reguregnus.cards.dropCallerB,
    ])
    expect(zoneCardIds(state, PLAYER_1, 'order_zone')).toContain(
      reguregnus.cards.callOfDeepLands,
    )

    state = advanceToPhase(state, 'battle')
    state = putFirstDeckCardMatchingOnTop(state, PLAYER_1, (card) =>
      isTriggerCard(state, card, 'critical'),
    )

    const declared = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: declareVanguardAttack(state, PLAYER_1, PLAYER_2),
      }),
    )
    state = declared.nextState

    const replace = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: {
          actionId:
            'action-standard-fullmatch-reguregnus-battle-replace' as ActionId,
          type: 'card.activate_effect',
          actor: {
            kind: 'player',
            playerId: PLAYER_1,
          },
          sourcePieceId: state.battle?.attackerPieceId as PieceId,
          effectDefinitionId: REGUREGNUS_BATTLE_REPLACE_EFFECT.id,
        },
      }),
    )
    state = replace.nextState

    expect(zoneCardIds(state, PLAYER_1, 'vanguard_circle')).toEqual([
      reguregnus.cards.replacement,
    ])
    expect(state.battle?.attackerPieceId).toBe(
      pieceIdForCard(state, PLAYER_1, reguregnus.cards.replacement),
    )

    state = passGuard(state)
    state = driveCheck(state)

    const triggerRequest = requireRequest(state, 'trigger.resolve')

    expect(triggerRequest.triggerType).toBe('critical')

    state = answerTrigger(state)
    state = resolveCombat(state)

    expect(state.battle?.combat).toMatchObject({
      result: 'hit',
      damageCheckCount: 2,
    })

    state = damageCheck(state)
    state = completeBattle(state)

    expect(state.status).toBe('completed')
    expect(
      state.players.find((player) => player.playerId === PLAYER_2)?.status,
    ).toBe('defeated')
  })

  it('proves Heartluru order thresholds and soul-call loop inside real match flow', () => {
    let state = startFullMatchOnPlayerOneTurn('heartluru', 'kairi')
    const heartluru = FIXTURES.heartluru

    for (const orderCardId of [
      heartluru.cards.orderA,
      heartluru.cards.orderB,
      heartluru.cards.orderC,
      heartluru.cards.orderD,
    ]) {
      state = playOrderFromHand(state, PLAYER_1, orderCardId)
    }

    state = moveCardToZone(
      state,
      PLAYER_1,
      heartluru.cards.soulA,
      'soul',
      'effect',
    )
    state = moveCardToZone(
      state,
      PLAYER_1,
      heartluru.cards.soulB,
      'soul',
      'effect',
    )
    state = grantEnergy(state, PLAYER_1, 1)

    const activation = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activateVanguardEffect(
          state,
          PLAYER_1,
          HEARTLURU_SOUL_CALL_EFFECT.id,
          'heartluru-soul-call',
        ),
      }),
    )

    expect(playerEnergy(activation.nextState, PLAYER_1)).toBe(0)

    state = answerPieces(activation.nextState, [
      pieceIdForCard(activation.nextState, PLAYER_1, heartluru.cards.soulA),
      pieceIdForCard(activation.nextState, PLAYER_1, heartluru.cards.soulB),
    ])
    state = completeNonLethalVanguardAttack(state, PLAYER_1, PLAYER_2)

    const vanguardPieceId = pieceIdForCard(state, PLAYER_1, heartluru.cards.g3)
    const vanguardStatus = pieceStatus(state, vanguardPieceId)

    expect(zoneCardIds(state, PLAYER_1, 'order_zone')).toEqual([
      heartluru.cards.orderA,
      heartluru.cards.orderB,
      heartluru.cards.orderC,
      heartluru.cards.orderD,
    ])
    expect(vanguardStatus?.powerModifier).toBe(5000)
    expect(vanguardStatus?.criticalModifier).toBe(1)
  })

  it('proves Youthberk revoldress replacement and battle continuation in a full match', () => {
    let state = startFullMatchOnPlayerOneTurn('youthberk', 'vyrgilla')
    const youthberk = FIXTURES.youthberk

    state = advanceToPhase(state, 'battle')

    const activation = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activateByCard(
          state,
          PLAYER_1,
          youthberk.cards.revoldress,
          YOUTHBERK_REVOLDRESS_EFFECT.id,
          'youthberk-revoldress',
        ),
      }),
    )

    state = activation.nextState

    expect(zoneCardIds(state, PLAYER_1, 'vanguard_circle')).toEqual([
      youthberk.cards.revoldress,
    ])
    expect(zoneCardIds(state, PLAYER_1, 'bind')).toContain(youthberk.cards.g3)
    expect(
      pieceStatusByCard(state, PLAYER_1, youthberk.cards.revoldress),
    ).toMatchObject({
      powerModifier: 10000,
      criticalModifier: 1,
    })

    state = completeNonLethalVanguardAttack(state, PLAYER_1, PLAYER_2)

    expect(state.status).toBe('in_progress')
    expect(state.battle).toBeUndefined()
  })

  it('proves Prison capture, release, prison-count pressure, and battle continuation', () => {
    let state = startFullMatchOnPlayerOneTurn('prison', 'prison')
    const prison = FIXTURES.prison
    const opponent = FIXTURES.prison

    state = moveCardToZone(
      state,
      PLAYER_2,
      opponent.cards.releaseCarrier,
      'hand',
      'effect',
    )

    const capture = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activateVanguardEffect(
          state,
          PLAYER_1,
          PRISON_CAPTURE_EFFECT.id,
          'prison-capture',
        ),
      }),
    )
    const capturedPieceId = pieceIdForCard(
      capture.nextState,
      PLAYER_2,
      opponent.cards.releaseCarrier,
    )

    state = answerPieces(capture.nextState, [capturedPieceId])

    expect(zonePieceIds(state, PLAYER_1, 'prison')).toContain(capturedPieceId)

    const release = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: {
          actionId: 'action-standard-fullmatch-prison-release' as ActionId,
          type: 'card.activate_effect',
          actor: {
            kind: 'player',
            playerId: PLAYER_2,
          },
          sourcePieceId: capturedPieceId,
          effectDefinitionId: PRISON_RELEASE_EFFECT.id,
        },
      }),
    )

    state = release.nextState

    expect(zonePieceIds(state, PLAYER_2, 'rear_guard_circle')).toContain(
      capturedPieceId,
    )

    state = moveCardToZone(
      state,
      PLAYER_2,
      opponent.cards.controlB,
      'hand',
      'effect',
    )
    state = moveCardToZone(
      state,
      PLAYER_2,
      opponent.cards.controlB,
      'prison',
      'imprison',
      PLAYER_1,
    )
    state = completeNonLethalVanguardAttack(state, PLAYER_1, PLAYER_2)

    expect(
      pieceStatusByCard(state, PLAYER_1, prison.cards.g3)?.powerModifier,
    ).toBe(5000)
  })

  it('proves Vyrgilla rewrite, opponent bind, rear-guard stand, and battle continuation', () => {
    let state = startFullMatchOnPlayerOneTurn('vyrgilla', 'youthberk')
    const vyrgilla = FIXTURES.vyrgilla
    const opponent = FIXTURES.youthberk

    state = callFromHand(state, PLAYER_1, vyrgilla.cards.rearA, P1_FRONT_LEFT)
    state = moveCardToZone(
      state,
      PLAYER_2,
      opponent.cards.rearA,
      'rear_guard_circle',
      'call',
      PLAYER_2,
      P2_FRONT_LEFT,
    )
    state = restPiece(
      state,
      pieceIdForCard(state, PLAYER_1, vyrgilla.cards.rearA),
    )
    state = advanceToPhase(state, 'battle')

    const activation = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activateByCard(
          state,
          PLAYER_1,
          vyrgilla.cards.rewrite,
          VYRGILLA_REWRITE_EFFECT.id,
          'vyrgilla-rewrite',
        ),
      }),
    )

    state = activation.nextState

    expect(zoneCardIds(state, PLAYER_1, 'vanguard_circle')).toEqual([
      vyrgilla.cards.rewrite,
    ])
    expect(zoneCardIds(state, PLAYER_2, 'bind')).toContain(opponent.cards.rearA)
    expect(
      pieceStatusByCard(state, PLAYER_1, vyrgilla.cards.rearA)?.orientation,
    ).toBe('stand')

    state = completeNonLethalVanguardAttack(state, PLAYER_1, PLAYER_2)

    expect(state.status).toBe('in_progress')
  })

  it('proves Kairi bounce, replay, attack sequence, and battle continuation', () => {
    let state = startFullMatchOnPlayerOneTurn('kairi', 'heartluru')
    const kairi = FIXTURES.kairi

    state = callFromHand(state, PLAYER_1, kairi.cards.rearA, P1_FRONT_LEFT)
    state = callFromHand(state, PLAYER_1, kairi.cards.rearB, P1_FRONT_RIGHT)

    const bounce = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activateVanguardEffect(
          state,
          PLAYER_1,
          KAIRI_CHOICE_BOUNCE_EFFECT.id,
          'kairi-bounce',
        ),
      }),
    )

    state = answerPieces(bounce.nextState, [
      pieceIdForCard(bounce.nextState, PLAYER_1, kairi.cards.rearA),
      pieceIdForCard(bounce.nextState, PLAYER_1, kairi.cards.rearB),
    ])
    state = grantEnergy(state, PLAYER_1, 1)

    const replay = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activateVanguardEffect(
          state,
          PLAYER_1,
          KAIRI_REPLAY_EFFECT.id,
          'kairi-replay',
        ),
      }),
    )

    state = answerPieces(replay.nextState, [
      pieceIdForCard(replay.nextState, PLAYER_1, kairi.cards.rearA),
      pieceIdForCard(replay.nextState, PLAYER_1, kairi.cards.rearB),
    ])
    state = grantEnergy(state, PLAYER_1, 1)
    state = advanceToPhase(state, 'battle')

    const sequence = expectApplied(
      applyGameAction(state, {
        expectedRevision: state.revision,
        action: activateVanguardEffect(
          state,
          PLAYER_1,
          KAIRI_ATTACK_SEQUENCE_EFFECT.id,
          'kairi-attack-sequence',
        ),
      }),
    )

    state = sequence.nextState

    const poweredRearGuards = zonePieceIds(
      state,
      PLAYER_1,
      'rear_guard_circle',
    ).filter((pieceId) => pieceStatus(state, pieceId)?.powerModifier === 5000)

    expect(poweredRearGuards).toHaveLength(2)

    state = completeNonLethalVanguardAttack(state, PLAYER_1, PLAYER_2)

    expect(state.status).toBe('in_progress')
  })
})

function startFullMatchOnPlayerOneTurn(
  playerOneDeck: DeckKey,
  playerTwoDeck: DeckKey,
): GameState {
  const bootstrapped = createDeckBackedGameState(
    createBootstrapInput(playerOneDeck, playerTwoDeck, {
      gameId:
        `game-standard-fullmatch:${playerOneDeck}-vs-${playerTwoDeck}` as GameId,
    }),
  )

  expect(bootstrapped.ok).toBe(true)

  if (!bootstrapped.ok) {
    throw new Error(bootstrapped.message)
  }

  let state = bootstrapped.state

  state = readyPlayer(state, PLAYER_1)
  state = readyPlayer(state, PLAYER_2)
  state = startMatch(state)
  state = passMulligan(state, PLAYER_1)
  state = passMulligan(state, PLAYER_2)
  state = endCurrentTurn(state)
  state = endCurrentTurn(state)
  state = advanceToPhase(state, 'ride')
  state = rideDeckToGrade3(state, PLAYER_1)
  state = advanceToPhase(state, 'main')

  expect(state.status).toBe('in_progress')
  expect(state.turn.turnNumber).toBe(2)
  expect(state.turn.turnPlayerId).toBe(PLAYER_1)

  return state
}

function createBootstrapInput(
  playerOneDeck: DeckKey,
  playerTwoDeck: DeckKey,
  options: {
    readonly gameId: GameId
  },
): CreateDeckBackedGameStateInput {
  return {
    gameId: options.gameId,
    formatId: STANDARD_FORMAT_ID,
    startingPlayerId: PLAYER_1,
    openingHandSize: 5,
    players: [
      createPlayerInput(PLAYER_1, 0, 'p1', FIXTURES[playerOneDeck]),
      createPlayerInput(PLAYER_2, 1, 'p2', FIXTURES[playerTwoDeck]),
    ],
  }
}

function createPlayerInput(
  playerId: PlayerId,
  seat: number,
  runtimeKey: string,
  fixture: SliceDeckFixture,
): DeckBackedMatchPlayerInput {
  return {
    playerId,
    seat,
    runtimeKey,
    deckSnapshot: fixture.deckSnapshot,
    cardDefinitions: fixture.cardDefinitions,
    validation: {
      isValid: true,
      source: 'standard-slice-21.0.3-fixture',
      errorCount: 0,
    },
  }
}

function readyPlayer(state: GameState, playerId: PlayerId): GameState {
  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`ready:${playerId}:${state.revision}`),
        type: 'match.ready',
        actor: {
          kind: 'player',
          playerId,
        },
      },
    }),
  ).nextState
}

function startMatch(state: GameState): GameState {
  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`start:${state.revision}`),
        type: 'match.start',
        actor: {
          kind: 'system',
          system: 'match-setup',
        },
      },
    }),
  ).nextState
}

function passMulligan(state: GameState, playerId: PlayerId): GameState {
  const hand = requireZone(state, playerId, 'hand')
  const deck = requireZone(state, playerId, 'deck')
  const begin = expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`mulligan-begin:${playerId}:${state.revision}`),
        type: 'system.begin_mulligan',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        playerId,
        handZoneId: hand.zoneId,
        deckZoneId: deck.zoneId,
      },
    }),
  )
  const request = requireRequest(begin.nextState, 'mulligan.select_cards')
  const result = expectApplied(
    applyGameChoiceResponse(begin.nextState, {
      expectedRevision: begin.nextState.revision,
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.mulligan',
        returnedPieceIds: [],
        shuffledDeckPieceIds: request.currentDeckPieceIds,
      },
    }),
  )

  return result.nextState
}

function endCurrentTurn(state: GameState): GameState {
  let workingState = advanceToPhase(state, 'end')
  const playerId = workingState.turn.turnPlayerId
  workingState = expectApplied(
    applyGameAction(workingState, {
      expectedRevision: workingState.revision,
      action: {
        actionId: actionId(`end-turn:${playerId}:${workingState.revision}`),
        type: 'turn.end_turn',
        actor: {
          kind: 'player',
          playerId,
        },
      },
    }),
  ).nextState

  return workingState
}

function advanceToPhase(state: GameState, targetPhase: PhaseId): GameState {
  let workingState = state

  while (workingState.turn.phase !== targetPhase) {
    const nextPhase = resolveNextTurnPhase(workingState.turn.phase)

    if (nextPhase === undefined) {
      throw new Error(
        `Cannot advance from phase ${workingState.turn.phase} to ${targetPhase}.`,
      )
    }

    workingState = expectApplied(
      applyGameAction(workingState, {
        expectedRevision: workingState.revision,
        action: {
          actionId: actionId(
            `advance:${workingState.turn.phase}:${nextPhase}:${workingState.revision}`,
          ),
          type: 'system.advance_phase',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          nextPhase,
        },
      }),
    ).nextState
  }

  return workingState
}

function rideDeckToGrade3(state: GameState, playerId: PlayerId): GameState {
  let workingState = state

  for (let rideIndex = 0; rideIndex < 3; rideIndex += 1) {
    const rideDeck = requireZone(workingState, playerId, 'ride_deck')
    const vanguard = requireZone(workingState, playerId, 'vanguard_circle')
    const ridingPieceId = rideDeck.occupants[0]?.pieceId
    const ridingOverPieceId = vanguard.occupants[0]?.pieceId

    if (ridingPieceId === undefined || ridingOverPieceId === undefined) {
      throw new Error(`Player ${playerId} cannot ride to grade 3.`)
    }

    workingState = expectApplied(
      applyGameAction(workingState, {
        expectedRevision: workingState.revision,
        action: {
          actionId: actionId(
            `ride:${playerId}:${rideIndex}:${workingState.revision}`,
          ),
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId,
          },
          pieceId: ridingPieceId,
          ridingOverPieceId,
          from: {
            zoneId: rideDeck.zoneId,
          },
          to: {
            zoneId: vanguard.zoneId,
          },
        },
      }),
    ).nextState
  }

  return workingState
}

function playOrderFromHand(
  state: GameState,
  playerId: PlayerId,
  cardId: CardId,
): GameState {
  const hand = requireZone(state, playerId, 'hand')
  const orderZone = requireZone(state, playerId, 'order_zone')
  const pieceId = pieceIdForCard(state, playerId, cardId, 'hand')

  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`play:${cardId}:${state.revision}`),
        type: 'card.play',
        actor: {
          kind: 'player',
          playerId,
        },
        pieceId,
        from: {
          zoneId: hand.zoneId,
        },
        to: {
          zoneId: orderZone.zoneId,
        },
      },
    }),
  ).nextState
}

function callFromHand(
  state: GameState,
  playerId: PlayerId,
  cardId: CardId,
  slotId: ZoneSlotId,
): GameState {
  const hand = requireZone(state, playerId, 'hand')
  const rearGuard = requireZone(state, playerId, 'rear_guard_circle')
  const pieceId = pieceIdForCard(state, playerId, cardId, 'hand')

  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`call:${cardId}:${slotId}:${state.revision}`),
        type: 'card.call',
        actor: {
          kind: 'player',
          playerId,
        },
        pieceId,
        from: {
          zoneId: hand.zoneId,
        },
        to: {
          zoneId: rearGuard.zoneId,
          slotId,
        },
      },
    }),
  ).nextState
}

function completeNonLethalVanguardAttack(
  state: GameState,
  attackingPlayerId: PlayerId,
  defendingPlayerId: PlayerId,
): GameState {
  let workingState =
    state.turn.phase === 'battle' ? state : advanceToPhase(state, 'battle')

  workingState = putFirstDeckCardMatchingOnTop(
    workingState,
    attackingPlayerId,
    (card) => !isTriggerCard(workingState, card),
  )
  workingState = expectApplied(
    applyGameAction(workingState, {
      expectedRevision: workingState.revision,
      action: declareVanguardAttack(
        workingState,
        attackingPlayerId,
        defendingPlayerId,
      ),
    }),
  ).nextState
  workingState = passGuard(workingState)
  workingState = driveCheck(workingState)
  workingState = resolveCombat(workingState)

  if (workingState.battle?.combat?.result === 'hit') {
    workingState = damageCheck(workingState)
    workingState = answerPendingTriggerIfNeeded(workingState)
  }

  return completeBattle(workingState)
}

function passGuard(state: GameState): GameState {
  const battle = requireBattle(state)
  const guard = expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`guard:${battle.battleId}:${state.revision}`),
        type: 'battle.guard',
        actor: {
          kind: 'player',
          playerId: battle.defendingPlayerId,
        },
        againstAttackerPieceId: battle.attackerPieceId,
      },
    }),
  )
  const request = requireRequest(guard.nextState, 'battle.guard_select')

  return expectApplied(
    applyGameChoiceResponse(guard.nextState, {
      expectedRevision: guard.nextState.revision,
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.pass',
        reason: 'pass',
      },
    }),
  ).nextState
}

function driveCheck(state: GameState): GameState {
  const battle = requireBattle(state)
  const deck = requireZone(state, battle.attackingPlayerId, 'deck')
  const hand = requireZone(state, battle.attackingPlayerId, 'hand')

  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`drive:${battle.battleId}:${state.revision}`),
        type: 'system.drive_check',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: battle.battleId,
        playerId: battle.attackingPlayerId,
        fromZoneId: deck.zoneId,
        toZoneId: hand.zoneId,
        count: 1,
      },
    }),
  ).nextState
}

function resolveCombat(state: GameState): GameState {
  const battle = requireBattle(state)

  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`combat:${battle.battleId}:${state.revision}`),
        type: 'system.resolve_combat',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: battle.battleId,
      },
    }),
  ).nextState
}

function damageCheck(state: GameState): GameState {
  const battle = requireBattle(state)
  const deck = requireZone(state, battle.defendingPlayerId, 'deck')
  const damage = requireZone(state, battle.defendingPlayerId, 'damage')
  const count = battle.combat?.damageCheckCount

  if (count === undefined) {
    throw new Error('Damage check requires resolved combat.')
  }

  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`damage:${battle.battleId}:${state.revision}`),
        type: 'system.damage_check',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        battleId: battle.battleId,
        playerId: battle.defendingPlayerId,
        fromZoneId: deck.zoneId,
        toZoneId: damage.zoneId,
        count,
      },
    }),
  ).nextState
}

function completeBattle(state: GameState): GameState {
  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`battle-complete:${state.revision}`),
        type: 'system.resolve_mandatory_flow',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        scope: 'battle',
      },
    }),
  ).nextState
}

function answerPieces(
  state: GameState,
  selectedPieceIds: readonly PieceId[],
): GameState {
  const request = requireRequest(state, 'choose.pieces')

  return expectApplied(
    applyGameChoiceResponse(state, {
      expectedRevision: state.revision,
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.pieces',
        selectedPieceIds,
      },
    }),
  ).nextState
}

function answerTrigger(state: GameState): GameState {
  const request = requireRequest(state, 'trigger.resolve')

  return expectApplied(
    applyGameChoiceResponse(state, {
      expectedRevision: state.revision,
      response: {
        requestId: request.requestId,
        responderPlayerId: request.responderPlayerId,
        type: 'answer.trigger',
        ...(request.powerEligiblePieceIds === undefined
          ? {}
          : {
              powerTargetPieceIds: [request.powerEligiblePieceIds[0]!],
            }),
        ...(request.criticalEligiblePieceIds === undefined
          ? {}
          : {
              criticalTargetPieceId: request.criticalEligiblePieceIds[0]!,
            }),
        ...(request.standEligiblePieceIds === undefined
          ? {}
          : {
              standTargetPieceId: request.standEligiblePieceIds[0]!,
            }),
        ...(request.healEligiblePieceIds === undefined
          ? {}
          : {
              healTargetPieceId: request.healEligiblePieceIds[0]!,
            }),
      },
    }),
  ).nextState
}

function answerPendingTriggerIfNeeded(state: GameState): GameState {
  let workingState = state

  while (workingState.pendingRequests[0]?.type === 'trigger.resolve') {
    workingState = answerTrigger(workingState)
  }

  return workingState
}

function activateVanguardEffect(
  state: GameState,
  playerId: PlayerId,
  effectDefinitionId: EffectDefinitionId,
  key: string,
) {
  return {
    actionId: actionId(`activate:${key}:${state.revision}`),
    type: 'card.activate_effect' as const,
    actor: {
      kind: 'player' as const,
      playerId,
    },
    sourcePieceId: requireZone(state, playerId, 'vanguard_circle').occupants[0]
      ?.pieceId as PieceId,
    effectDefinitionId,
  }
}

function activateByCard(
  state: GameState,
  playerId: PlayerId,
  cardId: CardId,
  effectDefinitionId: EffectDefinitionId,
  key: string,
) {
  return {
    actionId: actionId(`activate:${key}:${state.revision}`),
    type: 'card.activate_effect' as const,
    actor: {
      kind: 'player' as const,
      playerId,
    },
    sourcePieceId: pieceIdForCard(state, playerId, cardId),
    effectDefinitionId,
  }
}

function declareVanguardAttack(
  state: GameState,
  attackingPlayerId: PlayerId,
  defendingPlayerId: PlayerId,
) {
  return {
    actionId: actionId(`attack:${attackingPlayerId}:${state.revision}`),
    type: 'battle.declare_attack' as const,
    actor: {
      kind: 'player' as const,
      playerId: attackingPlayerId,
    },
    attackerPieceId: requireZone(state, attackingPlayerId, 'vanguard_circle')
      .occupants[0]?.pieceId as PieceId,
    target: {
      kind: 'player' as const,
      playerId: defendingPlayerId,
    },
  }
}

function moveTopDeckCardsToDamage(
  state: GameState,
  playerId: PlayerId,
  count: number,
): GameState {
  let workingState = state

  for (let index = 0; index < count; index += 1) {
    const deck = requireZone(workingState, playerId, 'deck')
    const pieceId = deck.occupants[0]?.pieceId

    if (pieceId === undefined) {
      throw new Error(`Player ${playerId} does not have enough deck cards.`)
    }

    workingState = movePieceToZone(
      workingState,
      pieceId,
      deck.zoneId,
      requireZone(workingState, playerId, 'damage').zoneId,
      'damage_check',
    )
  }

  return workingState
}

function moveCardToZone(
  state: GameState,
  pieceOwnerPlayerId: PlayerId,
  cardId: CardId,
  toKind: ZoneKind,
  reason: ZoneTransferReason,
  destinationOwnerPlayerId = pieceOwnerPlayerId,
  slotId?: ZoneSlotId,
): GameState {
  const location = pieceLocationForCard(state, pieceOwnerPlayerId, cardId)
  const destination = requireZone(state, destinationOwnerPlayerId, toKind)
  const alreadyThere =
    location.zoneId === destination.zoneId &&
    (slotId === undefined ||
      destination.occupants.some(
        (occupant) =>
          occupant.pieceId === location.pieceId && occupant.slotId === slotId,
      ))

  if (alreadyThere) {
    return state
  }

  return movePieceToZone(
    state,
    location.pieceId,
    location.zoneId,
    destination.zoneId,
    reason,
    slotId ?? firstOpenSlot(destination),
  )
}

function movePieceToZone(
  state: GameState,
  pieceId: PieceId,
  fromZoneId: ZoneId,
  toZoneId: ZoneId,
  reason: ZoneTransferReason,
  slotId?: ZoneSlotId,
): GameState {
  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`move:${pieceId}:${toZoneId}:${state.revision}`),
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId,
        from: {
          zoneId: fromZoneId,
        },
        to: {
          zoneId: toZoneId,
          ...(slotId === undefined ? {} : { slotId }),
        },
        reason,
      },
    }),
  ).nextState
}

function restPiece(state: GameState, pieceId: PieceId): GameState {
  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`rest:${pieceId}:${state.revision}`),
        type: 'piece.rest',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId,
      },
    }),
  ).nextState
}

function putFirstDeckCardMatchingOnTop(
  state: GameState,
  playerId: PlayerId,
  predicate: (cardDefinitionId: CardId) => boolean,
): GameState {
  const deck = requireZone(state, playerId, 'deck')
  const target = deck.occupants.find((occupant) => {
    const piece = state.pieces.find(
      (candidate) => candidate.pieceId === occupant.pieceId,
    )

    return piece?.cardDefinitionId !== undefined
      ? predicate(piece.cardDefinitionId)
      : false
  })

  if (target === undefined) {
    throw new Error(`Deck ${deck.zoneId} does not contain a matching card.`)
  }

  const orderedPieceIds = [
    target.pieceId,
    ...deck.occupants
      .map((occupant) => occupant.pieceId)
      .filter((pieceId) => pieceId !== target.pieceId),
  ]

  return expectApplied(
    applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: actionId(`deck-top:${playerId}:${state.revision}`),
        type: 'zone.shuffle',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        zoneId: deck.zoneId,
        orderedPieceIds,
      },
    }),
  ).nextState
}

function grantEnergy(
  state: GameState,
  playerId: PlayerId,
  amount: number,
): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.playerId === playerId
        ? {
            ...player,
            counters: player.counters.map((counter) =>
              counter.key === 'energy'
                ? {
                    ...counter,
                    amount,
                  }
                : counter,
            ),
          }
        : player,
    ),
  }
}

function requireRequest<TType extends GameChoiceRequest['type']>(
  state: GameState,
  type: TType,
): Extract<GameChoiceRequest, { readonly type: TType }> {
  const request = state.pendingRequests[0]

  expect(request?.type).toBe(type)

  if (request?.type !== type) {
    throw new Error(`Expected pending request ${type}.`)
  }

  return request as Extract<GameChoiceRequest, { readonly type: TType }>
}

function requireBattle(state: GameState): NonNullable<GameState['battle']> {
  if (state.battle === undefined) {
    throw new Error('Expected an active battle.')
  }

  return state.battle
}

function requireZone(
  state: GameState,
  playerId: PlayerId,
  kind: ZoneKind,
): GameState['zones'][number] {
  const found = zone(state, playerId, kind)

  if (found === undefined) {
    throw new Error(`Player ${playerId} is missing zone ${kind}.`)
  }

  return found
}

function zone(
  state: GameState,
  playerId: PlayerId,
  kind: ZoneKind,
): GameState['zones'][number] | undefined {
  return state.zones.find(
    (candidate) =>
      candidate.ownerPlayerId === playerId && candidate.kind === kind,
  )
}

function firstOpenSlot(
  zoneState: GameState['zones'][number],
): ZoneSlotId | undefined {
  if (zoneState.kind !== 'rear_guard_circle') {
    return undefined
  }

  const occupied = new Set(
    zoneState.occupants
      .map((occupant) => occupant.slotId)
      .filter((slotId): slotId is ZoneSlotId => slotId !== undefined),
  )

  return zoneState.layout.slotIds?.find((slotId) => !occupied.has(slotId))
}

function pieceIdForCard(
  state: GameState,
  ownerPlayerId: PlayerId,
  cardId: CardId,
  zoneKind?: ZoneKind,
): PieceId {
  return pieceLocationForCard(state, ownerPlayerId, cardId, zoneKind).pieceId
}

function pieceLocationForCard(
  state: GameState,
  ownerPlayerId: PlayerId,
  cardId: CardId,
  zoneKind?: ZoneKind,
): {
  readonly pieceId: PieceId
  readonly zoneId: ZoneId
} {
  const pieceIds = state.pieces
    .filter(
      (piece) =>
        piece.ownerPlayerId === ownerPlayerId &&
        piece.cardDefinitionId === cardId,
    )
    .map((piece) => piece.pieceId)
  const location = state.zones.flatMap((currentZone) =>
    currentZone.occupants
      .filter(
        (occupant) =>
          pieceIds.includes(occupant.pieceId) &&
          (zoneKind === undefined || currentZone.kind === zoneKind),
      )
      .map((occupant) => ({
        pieceId: occupant.pieceId,
        zoneId: currentZone.zoneId,
      })),
  )[0]

  if (location === undefined) {
    throw new Error(
      `Could not find card ${cardId} owned by ${ownerPlayerId} in current match state.`,
    )
  }

  return location
}

function zoneCardIds(
  state: GameState,
  playerId: PlayerId,
  kind: ZoneKind,
): readonly CardId[] {
  const pieceIds = zonePieceIds(state, playerId, kind)

  return pieceIds.flatMap((pieceId) => {
    const piece = state.pieces.find(
      (candidate) => candidate.pieceId === pieceId,
    )

    return piece?.cardDefinitionId === undefined ? [] : [piece.cardDefinitionId]
  })
}

function zonePieceIds(
  state: GameState,
  playerId: PlayerId,
  kind: ZoneKind,
): readonly PieceId[] {
  return requireZone(state, playerId, kind).occupants.map(
    (occupant) => occupant.pieceId,
  )
}

function pieceStatusByCard(
  state: GameState,
  ownerPlayerId: PlayerId,
  cardId: CardId,
): GamePieceStatusState | undefined {
  return pieceStatus(state, pieceIdForCard(state, ownerPlayerId, cardId))
}

function pieceStatus(
  state: GameState,
  pieceId: PieceId,
): GamePieceStatusState | undefined {
  return state.pieceStates.find((pieceState) => pieceState.pieceId === pieceId)
}

function playerEnergy(state: GameState, playerId: PlayerId): number {
  return (
    state.players
      .find((player) => player.playerId === playerId)
      ?.counters.find((counter) => counter.key === 'energy')?.amount ?? 0
  )
}

function isTriggerCard(
  state: GameState,
  cardId: CardId,
  triggerType?: GameplayCard['triggerType'],
): boolean {
  const stats = state.cardStats?.cards.find(
    (card) => card.cardDefinitionId === cardId,
  )

  return (
    stats?.cardType === 'trigger-unit' &&
    (triggerType === undefined || stats.triggerType === triggerType)
  )
}

function expectApplied(result: TransitionResult) {
  if (!isAppliedTransitionResult(result)) {
    throw new Error(
      `Expected applied transition result, received ${result.status}: ${
        'message' in result ? result.message : 'no message'
      }`,
    )
  }

  expect(result.status).toBe('applied')

  return result
}

function actionId(key: string): ActionId {
  return `action-standard-fullmatch:${key}` as ActionId
}

function createReguregnusFixture() {
  const ids = createCardIds('reguregnus', [
    'g0',
    'g1',
    'g2',
    'g3',
    'callOfDeepLands',
    'dropCallerA',
    'dropCallerB',
    'replacement',
    'supportA',
    'supportB',
    'critical',
    'normalA',
    'normalB',
  ])
  const cards = [
    unit(ids.g0, 'Reguregnus Starter', 'stoicheia', 0, 6000, 5000),
    unit(ids.g1, 'Reguregnus Grade 1', 'stoicheia', 1, 8000, 5000),
    unit(ids.g2, 'Reguregnus Grade 2', 'stoicheia', 2, 10000, 5000),
    unit(ids.g3, 'Reguregnus', 'stoicheia', 3, 13000, 0, {
      effects: [REGUREGNUS_BATTLE_REPLACE_EFFECT],
    }),
    order(
      ids.callOfDeepLands,
      'Call of the Deep Lands',
      'stoicheia',
      'normal-order',
      [REGUREGNUS_CALL_OF_DEEP_LANDS_EFFECT],
    ),
    unit(ids.dropCallerA, 'Deep Lands Caller A', 'stoicheia', 1, 8000, 5000),
    unit(ids.dropCallerB, 'Deep Lands Caller B', 'stoicheia', 2, 10000, 5000),
    unit(ids.replacement, 'Reguregnus Replacement', 'stoicheia', 3, 13000, 0, {
      effects: [REGUREGNUS_BATTLE_REPLACE_EFFECT],
    }),
    unit(ids.supportA, 'Reguregnus Support A', 'stoicheia', 1, 8000, 5000),
    unit(ids.supportB, 'Reguregnus Support B', 'stoicheia', 2, 10000, 5000),
    trigger(
      ids.critical,
      'Reguregnus Critical Trigger',
      'stoicheia',
      'critical',
    ),
    unit(ids.normalA, 'Reguregnus Normal A', 'stoicheia', 1, 8000, 5000),
    unit(ids.normalB, 'Reguregnus Normal B', 'stoicheia', 2, 10000, 5000),
  ]

  return fixture('reguregnus', 'Stoicheia - Reguregnus', ids, cards, [
    ids.callOfDeepLands,
    ids.dropCallerA,
    ids.dropCallerB,
    ids.replacement,
    ids.supportA,
    ids.critical,
    ids.normalA,
    ids.normalB,
  ])
}

function createHeartluruFixture() {
  const ids = createCardIds('heartluru', [
    'g0',
    'g1',
    'g2',
    'g3',
    'orderA',
    'orderB',
    'orderC',
    'orderD',
    'soulA',
    'soulB',
    'critical',
    'normalA',
    'normalB',
  ])
  const cards = [
    unit(ids.g0, 'Heartluru Starter', 'dark-states', 0, 6000, 5000),
    unit(ids.g1, 'Heartluru Grade 1', 'dark-states', 1, 8000, 5000),
    unit(ids.g2, 'Heartluru Grade 2', 'dark-states', 2, 10000, 5000),
    unit(ids.g3, 'Heartluru', 'dark-states', 3, 13000, 0, {
      effects: [HEARTLURU_SOUL_CALL_EFFECT, HEARTLURU_ATTACK_THRESHOLDS_EFFECT],
    }),
    order(ids.orderA, 'Heartluru Set Order A', 'dark-states', 'set-order'),
    order(ids.orderB, 'Heartluru Set Order B', 'dark-states', 'set-order'),
    order(ids.orderC, 'Heartluru Set Order C', 'dark-states', 'set-order'),
    order(ids.orderD, 'Heartluru Set Order D', 'dark-states', 'set-order'),
    unit(ids.soulA, 'Heartluru Soul A', 'dark-states', 1, 8000, 5000),
    unit(ids.soulB, 'Heartluru Soul B', 'dark-states', 2, 10000, 5000),
    trigger(
      ids.critical,
      'Heartluru Critical Trigger',
      'dark-states',
      'critical',
    ),
    unit(ids.normalA, 'Heartluru Normal A', 'dark-states', 1, 8000, 5000),
    unit(ids.normalB, 'Heartluru Normal B', 'dark-states', 2, 10000, 5000),
  ]

  return fixture('heartluru', 'Dark States - Heartluru', ids, cards, [
    ids.orderA,
    ids.orderB,
    ids.orderC,
    ids.orderD,
    ids.soulA,
    ids.soulB,
    ids.critical,
    ids.normalA,
    ids.normalB,
  ])
}

function createYouthberkFixture() {
  const ids = createCardIds('youthberk', [
    'g0',
    'g1',
    'g2',
    'g3',
    'revoldress',
    'rearA',
    'rearB',
    'critical',
    'normalA',
    'normalB',
  ])
  const cards = [
    unit(ids.g0, 'Youthberk Starter', 'keter-sanctuary', 0, 6000, 5000),
    unit(ids.g1, 'Youthberk Grade 1', 'keter-sanctuary', 1, 8000, 5000),
    unit(ids.g2, 'Youthberk Grade 2', 'keter-sanctuary', 2, 10000, 5000),
    unit(ids.g3, 'Youthberk', 'keter-sanctuary', 3, 13000, 0),
    unit(
      ids.revoldress,
      'Youthberk RevolForm',
      'keter-sanctuary',
      3,
      13000,
      0,
      {
        effects: [YOUTHBERK_REVOLDRESS_EFFECT],
      },
    ),
    unit(ids.rearA, 'Youthberk Rear A', 'keter-sanctuary', 1, 8000, 5000),
    unit(ids.rearB, 'Youthberk Rear B', 'keter-sanctuary', 2, 10000, 5000),
    trigger(
      ids.critical,
      'Youthberk Critical Trigger',
      'keter-sanctuary',
      'critical',
    ),
    unit(ids.normalA, 'Youthberk Normal A', 'keter-sanctuary', 1, 8000, 5000),
    unit(ids.normalB, 'Youthberk Normal B', 'keter-sanctuary', 2, 10000, 5000),
  ]

  return fixture('youthberk', 'Keter Sanctuary - Youthberk', ids, cards, [
    ids.revoldress,
    ids.rearA,
    ids.rearB,
    ids.critical,
    ids.normalA,
    ids.normalB,
  ])
}

function createPrisonFixture() {
  const ids = createCardIds('prison', [
    'g0',
    'g1',
    'g2',
    'g3',
    'orderA',
    'controlA',
    'controlB',
    'releaseCarrier',
    'critical',
    'normalA',
    'normalB',
  ])
  const cards = [
    unit(ids.g0, 'Prison Starter', 'brandt-gate', 0, 6000, 5000),
    unit(ids.g1, 'Prison Grade 1', 'brandt-gate', 1, 8000, 5000),
    unit(ids.g2, 'Prison Grade 2', 'brandt-gate', 2, 10000, 5000),
    unit(
      ids.g3,
      'Aurora Battle Princess, Seraph Snow',
      'brandt-gate',
      3,
      13000,
      0,
      {
        effects: [PRISON_CAPTURE_EFFECT, PRISON_SERAPH_ATTACK_EFFECT],
      },
    ),
    order(ids.orderA, 'Galaxy Central Prison', 'brandt-gate', 'set-order'),
    unit(ids.controlA, 'Prison Control A', 'brandt-gate', 1, 8000, 5000),
    unit(ids.controlB, 'Prison Control B', 'brandt-gate', 2, 10000, 5000),
    unit(
      ids.releaseCarrier,
      'Prison Release Carrier',
      'brandt-gate',
      1,
      8000,
      5000,
      {
        effects: [PRISON_RELEASE_EFFECT],
      },
    ),
    trigger(ids.critical, 'Prison Critical Trigger', 'brandt-gate', 'critical'),
    unit(ids.normalA, 'Prison Normal A', 'brandt-gate', 1, 8000, 5000),
    unit(ids.normalB, 'Prison Normal B', 'brandt-gate', 2, 10000, 5000),
  ]

  return fixture('prison', 'Brandt Gate - Prison', ids, cards, [
    ids.orderA,
    ids.controlA,
    ids.controlB,
    ids.releaseCarrier,
    ids.critical,
    ids.normalA,
    ids.normalB,
  ])
}

function createVyrgillaFixture() {
  const ids = createCardIds('vyrgilla', [
    'g0',
    'g1',
    'g2',
    'g3',
    'rewrite',
    'rearA',
    'rearB',
    'critical',
    'normalA',
    'normalB',
  ])
  const cards = [
    unit(ids.g0, 'Vyrgilla Starter', 'dragon-empire', 0, 6000, 5000),
    unit(ids.g1, 'Vyrgilla Grade 1', 'dragon-empire', 1, 8000, 5000),
    unit(ids.g2, 'Vyrgilla Grade 2', 'dragon-empire', 2, 10000, 5000),
    unit(ids.g3, 'Vyrgilla', 'dragon-empire', 3, 13000, 0),
    unit(ids.rewrite, 'Vyrgilla Rewrite Form', 'dragon-empire', 3, 13000, 0, {
      effects: [VYRGILLA_REWRITE_EFFECT],
    }),
    unit(ids.rearA, 'Vyrgilla Rear A', 'dragon-empire', 1, 8000, 5000),
    unit(ids.rearB, 'Vyrgilla Rear B', 'dragon-empire', 2, 10000, 5000),
    trigger(
      ids.critical,
      'Vyrgilla Critical Trigger',
      'dragon-empire',
      'critical',
    ),
    unit(ids.normalA, 'Vyrgilla Normal A', 'dragon-empire', 1, 8000, 5000),
    unit(ids.normalB, 'Vyrgilla Normal B', 'dragon-empire', 2, 10000, 5000),
  ]

  return fixture('vyrgilla', 'Dragon Empire - Vyrgilla', ids, cards, [
    ids.rewrite,
    ids.rearA,
    ids.rearB,
    ids.critical,
    ids.normalA,
    ids.normalB,
  ])
}

function createKairiFixture() {
  const ids = createCardIds('kairi', [
    'g0',
    'g1',
    'g2',
    'g3',
    'rearA',
    'rearB',
    'replayA',
    'replayB',
    'critical',
    'normalA',
    'normalB',
  ])
  const cards = [
    unit(ids.g0, 'Kairi Starter', 'lyrical-monasterio', 0, 6000, 5000),
    unit(ids.g1, 'Kairi Grade 1', 'lyrical-monasterio', 1, 8000, 5000),
    unit(ids.g2, 'Kairi Grade 2', 'lyrical-monasterio', 2, 10000, 5000),
    unit(ids.g3, 'Astesice, Kairi', 'lyrical-monasterio', 3, 13000, 0, {
      effects: [
        KAIRI_ATTACK_SEQUENCE_EFFECT,
        KAIRI_CHOICE_BOUNCE_EFFECT,
        KAIRI_REPLAY_EFFECT,
      ],
    }),
    unit(ids.rearA, 'Kairi Rear A', 'lyrical-monasterio', 1, 8000, 5000),
    unit(ids.rearB, 'Kairi Rear B', 'lyrical-monasterio', 2, 10000, 5000),
    unit(ids.replayA, 'Kairi Replay A', 'lyrical-monasterio', 1, 8000, 5000),
    unit(ids.replayB, 'Kairi Replay B', 'lyrical-monasterio', 2, 10000, 5000),
    trigger(
      ids.critical,
      'Kairi Critical Trigger',
      'lyrical-monasterio',
      'critical',
    ),
    unit(ids.normalA, 'Kairi Normal A', 'lyrical-monasterio', 1, 8000, 5000),
    unit(ids.normalB, 'Kairi Normal B', 'lyrical-monasterio', 2, 10000, 5000),
  ]

  return fixture('kairi', 'Lyrical Monasterio - Kairi', ids, cards, [
    ids.rearA,
    ids.rearB,
    ids.replayA,
    ids.replayB,
    ids.critical,
    ids.normalA,
    ids.normalB,
  ])
}

function fixture<
  TCards extends Record<string, CardId> & {
    readonly g0: CardId
    readonly g1: CardId
    readonly g2: CardId
    readonly g3: CardId
  },
>(
  key: DeckKey,
  label: string,
  cards: TCards,
  cardDefinitions: readonly GameplayCard[],
  mainCards: readonly CardId[],
): SliceDeckFixture & { readonly cards: TCards } {
  const rideCards = [cards.g0, cards.g1, cards.g2, cards.g3]
  const filler = createCardIds(key, [
    'fillerA',
    'fillerB',
    'fillerC',
    'fillerD',
    'fillerE',
    'fillerF',
  ])
  const fillerCards = Object.entries(filler).map(([name, cardId], index) =>
    unit(
      cardId,
      `${label} Filler ${name}`,
      cardDefinitions[0]?.nation as GameplayCard['nation'],
      index % 2 === 0 ? 1 : 2,
      index % 2 === 0 ? 8000 : 10000,
      5000,
    ),
  )
  const allDefinitions = [...cardDefinitions, ...fillerCards]
  const criticalCardId = Object.entries(cards).find(([name]) =>
    name.toLowerCase().includes('critical'),
  )?.[1]
  const mainEntryCounts = new Map<CardId, number>()

  for (const cardId of mainCards) {
    mainEntryCounts.set(cardId, (mainEntryCounts.get(cardId) ?? 0) + 1)
  }

  if (criticalCardId !== undefined) {
    mainEntryCounts.set(
      criticalCardId,
      (mainEntryCounts.get(criticalCardId) ?? 0) + 3,
    )
  }

  for (const cardId of Object.values(filler)) {
    mainEntryCounts.set(cardId, (mainEntryCounts.get(cardId) ?? 0) + 2)
  }

  const mainEntries = Array.from(mainEntryCounts, ([cardId, count]) => ({
    cardId,
    count,
  }))

  return {
    key,
    label,
    cards,
    cardDefinitions: allDefinitions,
    deckSnapshot: {
      deckId: `deck-standard-slice-${key}` as DeckId,
      formatId: STANDARD_FORMAT_ID,
      revision: 21_003,
      completeness: 'complete',
      sections: [
        {
          section: 'main',
          entries: mainEntries,
        },
        {
          section: 'ride',
          entries: rideCards.map((cardId) => ({
            cardId,
            count: 1,
          })),
        },
      ],
    },
    boundEffects: allDefinitions.flatMap((card) =>
      card.effectRefs.map(
        (effectRef) => effectRef.id as unknown as EffectDefinitionId,
      ),
    ),
  }
}

function createCardIds<TKey extends string>(
  deck: DeckKey,
  keys: readonly TKey[],
): Record<TKey, CardId> {
  return Object.fromEntries(
    keys.map((key) => [key, `slice:${deck}:${key}` as CardId]),
  ) as Record<TKey, CardId>
}

function unit(
  cardId: CardId,
  name: string,
  nation: string,
  grade: GameplayCard['grade'],
  power: number,
  shield: number,
  options: {
    readonly effects?: readonly EffectDefinition[]
  } = {},
): GameplayCard {
  return gameplayCard(
    cardId,
    name,
    nation,
    'normal-unit',
    grade,
    power,
    shield,
    options.effects === undefined ? {} : { effects: options.effects },
  )
}

function trigger(
  cardId: CardId,
  name: string,
  nation: string,
  triggerType: NonNullable<GameplayCard['triggerType']>,
): GameplayCard {
  return gameplayCard(cardId, name, nation, 'trigger-unit', 0, 5000, 15000, {
    triggerType,
  })
}

function order(
  cardId: CardId,
  name: string,
  nation: string,
  cardType: Extract<GameplayCard['cardType'], 'normal-order' | 'set-order'>,
  effects: readonly EffectDefinition[] = [],
): GameplayCard {
  return gameplayCard(cardId, name, nation, cardType, 1, 0, 0, {
    critical: 0,
    effects,
  })
}

function gameplayCard(
  cardId: CardId,
  name: string,
  nation: string,
  cardType: GameplayCard['cardType'],
  grade: GameplayCard['grade'],
  power: number,
  shield: number,
  options: {
    readonly critical?: number
    readonly triggerType?: GameplayCard['triggerType']
    readonly effects?: readonly EffectDefinition[]
  } = {},
): GameplayCard {
  return {
    cardId,
    name,
    cardType,
    grade,
    nation: nation as GameplayCard['nation'],
    power,
    shield,
    critical: options.critical ?? 1,
    ...(options.triggerType === undefined
      ? {}
      : {
          triggerType: options.triggerType,
        }),
    keywords: [],
    effectRefs: (options.effects ?? []).map((effect) => ({
      id: effect.id as unknown as EffectRefId,
      sourceCardId: cardId,
      source: 'printed',
      key: effect.identity.key,
    })),
  }
}
