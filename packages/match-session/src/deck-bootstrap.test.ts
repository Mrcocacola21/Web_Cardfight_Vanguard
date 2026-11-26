import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  applyGameAction,
  type ActionId,
  STANDARD_FORMAT_ID,
  type GameId,
  type PlayerId,
} from '@web-vg/rules-core'
import type {
  CardId,
  DeckId,
  DeckSnapshot,
  EffectRefId,
  GameplayCard,
  UserId,
} from '@web-vg/shared'

import { createDeckBackedGameState } from './deck-bootstrap'
import type {
  CreateDeckBackedGameStateInput,
  DeckBackedMatchPlayerInput,
} from './deck-bootstrap'
import {
  createMatchRoom,
  initializeMatchRoom,
  type MatchRoomId,
  type MatchRoomParticipantId,
} from './match-room'

const PLAYER_1 = 'player-bootstrap-1' as PlayerId
const PLAYER_2 = 'player-bootstrap-2' as PlayerId
const PARTICIPANT_1 = 'participant-bootstrap-1' as MatchRoomParticipantId
const PARTICIPANT_2 = 'participant-bootstrap-2' as MatchRoomParticipantId
const CARD_G0 = 'catalog:keter:g0-starter' as CardId
const CARD_G1 = 'catalog:keter:g1-unit' as CardId
const CARD_G2 = 'catalog:keter:g2-unit' as CardId
const CARD_G3 = 'catalog:keter:g3-unit' as CardId
const CARD_TRIGGER = 'catalog:keter:critical-trigger' as CardId

describe('real deck-to-match bootstrap', () => {
  it('translates validated deck snapshots into deterministic gameplay state', () => {
    const input = createBootstrapInput()
    const firstResult = createDeckBackedGameState(input)
    const secondResult = createDeckBackedGameState(input)

    expect(firstResult).toEqual(secondResult)
    expect(firstResult.ok).toBe(true)

    if (!firstResult.ok) {
      throw new Error(firstResult.message)
    }

    const state = firstResult.state
    const playerOneVanguard = state.zones.find(
      (zone) =>
        zone.ownerPlayerId === PLAYER_1 && zone.kind === 'vanguard_circle',
    )
    const playerOneHand = state.zones.find(
      (zone) => zone.ownerPlayerId === PLAYER_1 && zone.kind === 'hand',
    )
    const playerOneDeck = state.zones.find(
      (zone) => zone.ownerPlayerId === PLAYER_1 && zone.kind === 'deck',
    )
    const playerOneOrderZone = state.zones.find(
      (zone) => zone.ownerPlayerId === PLAYER_1 && zone.kind === 'order_zone',
    )
    const playerOnePrison = state.zones.find(
      (zone) => zone.ownerPlayerId === PLAYER_1 && zone.kind === 'prison',
    )
    const playerOneRideDeck = state.zones.find(
      (zone) => zone.ownerPlayerId === PLAYER_1 && zone.kind === 'ride_deck',
    )
    const playerOne = state.players.find(
      (player) => player.playerId === PLAYER_1,
    )
    const starterPiece = state.pieces.find(
      (piece) => piece.pieceId === playerOneVanguard?.occupants[0]?.pieceId,
    )

    expect(state.status).toBe('setup')
    expect(state.turn.turnPlayerId).toBe(PLAYER_1)
    expect(playerOneVanguard?.occupants).toHaveLength(1)
    expect(starterPiece?.cardDefinitionId).toBe(CARD_G0)
    expect(playerOneHand?.occupants).toHaveLength(2)
    expect(playerOneDeck?.occupants).toHaveLength(1)
    expect(playerOneRideDeck?.occupants).toHaveLength(3)
    expect(playerOneOrderZone).toMatchObject({
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
    })
    expect(playerOnePrison).toMatchObject({
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
    })
    expect(playerOne?.counters).toContainEqual({
      key: 'energy',
      amount: 0,
      visibility: 'public',
    })
    expect(
      state.pieces
        .filter((piece) => piece.ownerPlayerId === PLAYER_1)
        .map((piece) => piece.cardDefinitionId),
    ).toEqual([
      CARD_G1,
      CARD_G1,
      CARD_TRIGGER,
      CARD_G0,
      CARD_G1,
      CARD_G2,
      CARD_G3,
    ])
    expect(
      state.cardStats?.cards.find((card) => card.cardDefinitionId === CARD_G3),
    ).toMatchObject({
      power: 13000,
      shield: 0,
      critical: 1,
      triggerType: null,
    })
    expect(
      state.cardStats?.cards.find(
        (card) => card.cardDefinitionId === CARD_TRIGGER,
      ),
    ).toMatchObject({
      cardType: 'trigger-unit',
      triggerType: 'critical',
    })
    expect(
      state.pieces.find((piece) => piece.cardDefinitionId === CARD_G3)
        ?.effectDefinitionIds,
    ).toEqual(['effect:test:grade-3-activated'])
  })

  it('copies printed keywords onto runtime pieces so keyword mechanics apply', () => {
    const input = createBootstrapInput()
    const [playerOne, playerTwo] = input.players
    const twinDriveCard = playerOne!.cardDefinitions[0]!
    const result = createDeckBackedGameState({
      ...input,
      players: [
        {
          ...playerOne!,
          cardDefinitions: playerOne!.cardDefinitions.map((card) =>
            card.cardId === twinDriveCard.cardId
              ? { ...card, keywords: ['twin-drive' as never] }
              : card,
          ),
        },
        playerTwo!,
      ],
    })

    if (!result.ok) {
      throw new Error(result.message)
    }

    const pieces = result.state.pieces.filter(
      (piece) => piece.ownerPlayerId === PLAYER_1,
    )

    expect(
      pieces
        .filter((piece) => piece.cardDefinitionId === twinDriveCard.cardId)
        .every((piece) => piece.keywords?.includes('twin-drive' as never)),
    ).toBe(true)
    expect(
      pieces
        .filter((piece) => piece.cardDefinitionId !== twinDriveCard.cardId)
        .every((piece) => piece.keywords === undefined),
    ).toBe(true)
  })

  it('lets the Standard prison zone hold opponent-owned cards without rewriting ownership', () => {
    const result = createDeckBackedGameState(createBootstrapInput())

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    const state = result.state
    const playerOnePrison = state.zones.find(
      (zone) => zone.ownerPlayerId === PLAYER_1 && zone.kind === 'prison',
    )
    const playerTwoHand = state.zones.find(
      (zone) => zone.ownerPlayerId === PLAYER_2 && zone.kind === 'hand',
    )
    const imprisonedPieceId = playerTwoHand?.occupants[0]?.pieceId

    if (
      playerOnePrison === undefined ||
      playerTwoHand === undefined ||
      imprisonedPieceId === undefined
    ) {
      throw new Error(
        'Expected Standard bootstrap to create prison and hand zones.',
      )
    }

    const transition = applyGameAction(state, {
      expectedRevision: state.revision,
      action: {
        actionId: 'action-imprison-opponent-card' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'rules-engine',
        },
        pieceId: imprisonedPieceId,
        from: {
          zoneId: playerTwoHand.zoneId,
        },
        to: {
          zoneId: playerOnePrison.zoneId,
        },
        reason: 'imprison',
      },
    })

    expect(transition.status).toBe('applied')

    if (transition.status !== 'applied') {
      throw new Error(transition.message)
    }

    const nextState = transition.nextState
    const nextPrison = nextState.zones.find(
      (zone) => zone.zoneId === playerOnePrison.zoneId,
    )
    const movedPiece = nextState.pieces.find(
      (piece) => piece.pieceId === imprisonedPieceId,
    )

    expect(nextPrison?.occupants).toContainEqual({
      pieceId: imprisonedPieceId,
    })
    expect(movedPiece).toMatchObject({
      ownerPlayerId: PLAYER_2,
      controllerPlayerId: PLAYER_2,
    })
  })

  it('initializes a match room from deck-backed state without session-side deck storage', () => {
    const result = createDeckBackedGameState(createBootstrapInput())

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.message)
    }

    const room = createMatchRoom({
      roomId: 'room-deck-bootstrap' as MatchRoomId,
      formatId: STANDARD_FORMAT_ID,
      hostParticipantId: PARTICIPANT_1,
      createdAt: '2026-05-08T00:00:00.000Z',
      participants: [
        {
          participantId: PARTICIPANT_1,
          seat: 0,
          userId: 'user-bootstrap-1' as UserId,
          submittedDeckId: 'deck-bootstrap-1' as DeckId,
        },
        {
          participantId: PARTICIPANT_2,
          seat: 1,
          userId: 'user-bootstrap-2' as UserId,
          submittedDeckId: 'deck-bootstrap-2' as DeckId,
        },
      ],
    })
    const initializedRoom = initializeMatchRoom(room, {
      initialState: result.state,
      initializedAt: '2026-05-08T00:00:01.000Z',
      playerBindings: [
        {
          participantId: PARTICIPANT_1,
          playerId: PLAYER_1,
        },
        {
          participantId: PARTICIPANT_2,
          playerId: PLAYER_2,
        },
      ],
    })

    expect(initializedRoom.status).toBe('initialized')
    expect(initializedRoom.engineState).toBe(result.state)
    expect(initializedRoom.participants[0]?.enginePlayerId).toBe(PLAYER_1)
  })

  it('rejects invalid deck validation proofs before creating gameplay pieces', () => {
    const basePlayer = createPlayerInput(
      PLAYER_1,
      0,
      'p1',
      'deck-bootstrap-1' as DeckId,
    )
    const result = createDeckBackedGameState({
      ...createBootstrapInput(),
      players: [
        {
          ...basePlayer,
          validation: {
            isValid: false,
            source: 'deck-validation',
            errorCount: 1,
            issueCodes: ['main-deck-too-small'],
          },
        },
      ],
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'deck_not_valid',
    })
  })

  it('rejects missing gameplay card definitions for deck entries', () => {
    const input = createBootstrapInput()
    const basePlayer = createPlayerInput(
      PLAYER_1,
      0,
      'p1',
      'deck-bootstrap-1' as DeckId,
    )
    const result = createDeckBackedGameState({
      ...input,
      players: [
        {
          ...basePlayer,
          cardDefinitions: catalogCards().filter(
            (card) => card.cardId !== CARD_TRIGGER,
          ),
        },
      ],
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'missing_card_definition',
    })
  })

  it('keeps deck storage, validation, and catalog runtime packages outside the bootstrap boundary', () => {
    const source = readFileSync(
      new URL('./deck-bootstrap.ts', import.meta.url),
      'utf8',
    )

    expect(source).not.toContain('@web-vg/decks')
    expect(source).not.toContain('@web-vg/deck-validation')
    expect(source).not.toContain('@web-vg/catalog')
    expect(source).not.toContain('supabase')
    expect(source).not.toContain('repository')
  })
})

function createBootstrapInput(): CreateDeckBackedGameStateInput {
  return {
    gameId: 'game-deck-bootstrap' as GameId,
    formatId: STANDARD_FORMAT_ID,
    startingPlayerId: PLAYER_1,
    openingHandSize: 2,
    players: [
      createPlayerInput(PLAYER_1, 0, 'p1', 'deck-bootstrap-1' as DeckId),
      createPlayerInput(PLAYER_2, 1, 'p2', 'deck-bootstrap-2' as DeckId),
    ],
  }
}

function createPlayerInput(
  playerId: PlayerId,
  seat: number,
  runtimeKey: string,
  deckId: DeckId,
): DeckBackedMatchPlayerInput {
  return {
    playerId,
    seat,
    runtimeKey,
    deckSnapshot: deckSnapshot(deckId),
    cardDefinitions: catalogCards(),
    validation: {
      isValid: true,
      source: 'deck-validation',
      errorCount: 0,
    },
  }
}

function deckSnapshot(deckId: DeckId): DeckSnapshot {
  return {
    deckId,
    formatId: STANDARD_FORMAT_ID,
    revision: 7,
    completeness: 'complete',
    sections: [
      {
        section: 'main',
        entries: [
          {
            cardId: CARD_G1,
            count: 2,
          },
          {
            cardId: CARD_TRIGGER,
            count: 1,
          },
        ],
      },
      {
        section: 'ride',
        entries: [
          {
            cardId: CARD_G0,
            count: 1,
          },
          {
            cardId: CARD_G1,
            count: 1,
          },
          {
            cardId: CARD_G2,
            count: 1,
          },
          {
            cardId: CARD_G3,
            count: 1,
          },
        ],
      },
    ],
  }
}

function catalogCards(): readonly GameplayCard[] {
  return [
    gameplayCard(CARD_G0, 'Keter Starter', 0, 6000, 5000),
    gameplayCard(CARD_G1, 'Keter Grade 1', 1, 8000, 5000),
    gameplayCard(CARD_G2, 'Keter Grade 2', 2, 10000, 5000),
    gameplayCard(CARD_G3, 'Keter Grade 3', 3, 13000, 0, {
      effectRefs: [
        {
          id: 'effect:test:grade-3-activated' as EffectRefId,
          sourceCardId: CARD_G3,
          source: 'printed',
          key: 'grade-3-activated',
        },
      ],
    }),
    gameplayCard(CARD_TRIGGER, 'Keter Critical Trigger', 0, 5000, 15000, {
      cardType: 'trigger-unit',
      triggerType: 'critical',
    }),
  ]
}

function gameplayCard(
  cardId: CardId,
  name: string,
  grade: GameplayCard['grade'],
  power: number,
  shield: number,
  options: {
    readonly cardType?: GameplayCard['cardType']
    readonly triggerType?: GameplayCard['triggerType']
    readonly effectRefs?: GameplayCard['effectRefs']
  } = {},
): GameplayCard {
  return {
    cardId,
    name,
    cardType: options.cardType ?? 'normal-unit',
    grade,
    nation: 'keter-sanctuary' as GameplayCard['nation'],
    power,
    shield,
    critical: 1,
    ...(options.triggerType === undefined
      ? {}
      : {
          triggerType: options.triggerType,
        }),
    keywords: [],
    effectRefs: options.effectRefs ?? [],
  }
}
