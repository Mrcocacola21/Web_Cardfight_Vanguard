import { describe, expect, it } from 'vitest'

import type {
  ActionId,
  GameState,
  PieceId,
  PlayerId,
  ZoneId,
  ZoneSlotId,
} from '@web-vg/rules-core'
import {
  EXAMPLE_CARD_SCRIPTS,
  STANDARD_FORMAT_ID,
  buildEngineCardStatsSnapshot,
  createCardScriptRuntime,
} from '@web-vg/rules-core'
import type { CardId, UserId } from '@web-vg/shared'

import {
  createMatchRoom,
  createScriptedMatchRoomEngineAdapters,
  initializeMatchRoom,
  submitMatchRoomCommand,
} from './match-room'
import type {
  MatchRoom,
  MatchRoomCommandResult,
  MatchRoomId,
  MatchRoomParticipantId,
} from './match-room'
import {
  submitRealtimeClientCommand,
  type RealtimeClientCommand,
} from './realtime-runtime'
import {
  createSerializableMatchSessionDocument,
  type SerializableMatchSessionDocument,
} from './session-persistence'

const P1 = 'engine-player-1' as PlayerId
const P2 = 'engine-player-2' as PlayerId
const PARTICIPANT_1 = 'participant-1' as MatchRoomParticipantId
const PARTICIPANT_2 = 'participant-2' as MatchRoomParticipantId
const SQUIRE = 'p1-squire' as PieceId
const DECK_TOP = 'p1-deck-1' as PieceId
const DAMAGE = ['p1-dmg-1', 'p1-dmg-2'] as PieceId[]

const runtime = createCardScriptRuntime(EXAMPLE_CARD_SCRIPTS)
const scriptedAdapters = createScriptedMatchRoomEngineAdapters(runtime)

describe('match rooms with card scripts', () => {
  it('runs a scripted AUTO ability through participant commands', () => {
    const start = makeRoom()
    const called = submit(start, callSquire(start))

    expect(called.status).toBe('accepted')
    const room = acceptedRoom(called)
    const confirm = room.engineState.pendingRequests[0]!

    expect(confirm).toMatchObject({
      type: 'confirm.boolean',
      responderPlayerId: P1,
    })

    // The opponent cannot answer for the card's controller.
    const wrongPlayer = submit(room, {
      participantId: PARTICIPANT_2,
      command: {
        kind: 'choice_response',
        submission: {
          expectedRevision: room.engineState.revision,
          response: {
            requestId: confirm.requestId,
            responderPlayerId: P2,
            type: 'answer.boolean',
            accepted: true,
          },
        },
      },
    })
    expect(wrongPlayer.status).not.toBe('accepted')

    const accepted = acceptedRoom(
      submit(room, answerBoolean(room, confirm.requestId)),
    )
    const cost = accepted.engineState.pendingRequests[0]!

    expect(cost).toMatchObject({ type: 'choose.pieces', purpose: 'cost' })

    const paid = acceptedRoom(
      submit(accepted, {
        participantId: PARTICIPANT_1,
        command: {
          kind: 'choice_response',
          submission: {
            expectedRevision: accepted.engineState.revision,
            response: {
              requestId: cost.requestId,
              responderPlayerId: P1,
              type: 'answer.pieces',
              selectedPieceIds: [DAMAGE[0]!],
            },
          },
        },
      }),
    )

    expect(zoneOf(paid.engineState, DECK_TOP)).toBe(zone(P1, 'hand'))
    expect(paid.engineState.pendingRequests).toEqual([])
  })

  it('leaves rooms without scripts unchanged when the default adapters are used', () => {
    const start = makeRoom()
    const called = submitMatchRoomCommand(
      start,
      {
        source: { kind: 'participant', participantId: PARTICIPANT_1 },
        command: callSquire(start).command,
      },
      { submittedAt: '2026-11-26T09:03:00.000Z' },
    )

    expect(acceptedRoom(called).engineState.pendingRequests).toEqual([])
  })
})

describe('server-driven battle flow', () => {
  it('finishes the battle after the last player choice and retires a hit rear-guard', () => {
    let document = makeDocument(makeRoom({ phase: 'battle' }))
    const attacker = 'p1-vanguard' as PieceId
    const target = 'p2-rear' as PieceId

    document = realtime(document, PARTICIPANT_1, {
      kind: 'action',
      submission: {
        expectedRevision: engineRevision(document),
        action: {
          actionId: 'action-attack' as ActionId,
          type: 'battle.declare_attack',
          actor: { kind: 'player', playerId: P1 },
          attackerPieceId: attacker,
          target: { kind: 'piece', pieceId: target },
        },
      },
    }).document
    document = realtime(document, PARTICIPANT_2, {
      kind: 'action',
      submission: {
        expectedRevision: engineRevision(document),
        action: {
          actionId: 'action-guard' as ActionId,
          type: 'battle.guard',
          actor: { kind: 'player', playerId: P2 },
          againstAttackerPieceId: attacker,
        },
      },
    }).document

    const guardRequest = roomState(document).pendingRequests[0]!
    const passed = realtime(document, PARTICIPANT_2, {
      kind: 'choice_response',
      submission: {
        expectedRevision: engineRevision(document),
        response: {
          requestId: guardRequest.requestId,
          responderPlayerId: P2,
          type: 'answer.pass',
          reason: 'pass',
        },
      },
    })
    const finalState = roomState(passed.document)

    // The player's pass, then drive check, combat and battle close are
    // recorded in history as the server's own steps.
    const recordedTypes = (
      passed.status === 'accepted' ? passed.acceptedHistory : []
    ).flatMap((entry) =>
      entry.event.kind === 'engine_event' ? [entry.event.event.type] : [],
    )
    expect(recordedTypes).toEqual(
      expect.arrayContaining([
        'battle.drive_checked',
        'battle.attack_hit',
        'battle.completed',
      ]),
    )
    expect(finalState.battle).toBeUndefined()
    expect(zoneOf(finalState, target)).toBe(zone(P2, 'drop'))
    expect(zoneOf(finalState, DECK_TOP)).toBe(zone(P1, 'hand'))
  })
})

function makeDocument(room: MatchRoom): SerializableMatchSessionDocument {
  const created = createSerializableMatchSessionDocument({ room })

  if (!created.ok) {
    throw new Error(created.message)
  }

  return created.document
}

function roomState(document: SerializableMatchSessionDocument): GameState {
  const state = document.room.engineState

  if (state === undefined) {
    throw new Error('Room has no engine state.')
  }

  return state
}

function engineRevision(document: SerializableMatchSessionDocument): number {
  return roomState(document).revision
}

let realtimeCommandCounter = 0

function realtime(
  document: SerializableMatchSessionDocument,
  participantId: MatchRoomParticipantId,
  payload: RealtimeClientCommand['payload'],
) {
  realtimeCommandCounter += 1
  const result = submitRealtimeClientCommand({
    document,
    command: {
      commandId:
        `command-${realtimeCommandCounter}` as RealtimeClientCommand['commandId'],
      roomId: document.room.roomId,
      participantId,
      payload,
    },
    engineAdapters: scriptedAdapters,
    receivedAt: '2026-11-26T09:03:00.000Z',
  })

  if (result.status !== 'accepted') {
    throw new Error(
      `${result.status}: ${'message' in result ? result.message : ''}`,
    )
  }

  return result
}

function submit(
  room: MatchRoom,
  input: {
    readonly participantId: MatchRoomParticipantId
    readonly command: Parameters<typeof submitMatchRoomCommand>[1]['command']
  },
): MatchRoomCommandResult {
  return submitMatchRoomCommand(
    room,
    {
      source: { kind: 'participant', participantId: input.participantId },
      command: input.command,
    },
    {
      engineAdapters: scriptedAdapters,
      submittedAt: '2026-11-26T09:03:00.000Z',
    },
  )
}

function acceptedRoom(
  result: MatchRoomCommandResult,
): MatchRoom & { readonly engineState: GameState } {
  if (result.status !== 'accepted') {
    throw new Error(
      `Expected accepted, got ${result.status}: ${JSON.stringify(result)}`,
    )
  }

  return result.room as MatchRoom & { readonly engineState: GameState }
}

function callSquire(room: MatchRoom & { readonly engineState: GameState }) {
  return {
    participantId: PARTICIPANT_1,
    command: {
      kind: 'action' as const,
      submission: {
        expectedRevision: room.engineState.revision,
        action: {
          actionId: 'action-call-squire' as ActionId,
          type: 'card.call' as const,
          actor: { kind: 'player' as const, playerId: P1 },
          pieceId: SQUIRE,
          from: { zoneId: zone(P1, 'hand') },
          to: {
            zoneId: zone(P1, 'rear_guard_circle'),
            slotId: `${P1}-rc-front-left` as ZoneSlotId,
          },
        },
      },
    },
  }
}

function answerBoolean(
  room: MatchRoom & { readonly engineState: GameState },
  requestId: GameState['pendingRequests'][number]['requestId'],
) {
  return {
    participantId: PARTICIPANT_1,
    command: {
      kind: 'choice_response' as const,
      submission: {
        expectedRevision: room.engineState.revision,
        response: {
          requestId,
          responderPlayerId: P1,
          type: 'answer.boolean' as const,
          accepted: true,
        },
      },
    },
  }
}

function zone(player: PlayerId, kind: string): ZoneId {
  return `${player}-${kind}` as ZoneId
}

function zoneOf(state: GameState, pieceId: PieceId): ZoneId | undefined {
  return state.zones.find((candidate) =>
    candidate.occupants.some((occupant) => occupant.pieceId === pieceId),
  )?.zoneId
}

function makeRoom(
  options: { readonly phase?: string } = {},
): MatchRoom & { readonly engineState: GameState } {
  const created = createMatchRoom({
    roomId: 'room-scripted' as MatchRoomId,
    formatId: STANDARD_FORMAT_ID,
    hostParticipantId: PARTICIPANT_1,
    createdAt: '2026-11-26T09:00:00.000Z',
    participants: [
      {
        participantId: PARTICIPANT_1,
        seat: 0,
        userId: 'user-1' as UserId,
        displayName: 'Player One',
      },
      {
        participantId: PARTICIPANT_2,
        seat: 1,
        userId: 'user-2' as UserId,
        displayName: 'Player Two',
      },
    ],
  })

  const initialized = initializeMatchRoom(created, {
    initialState: makeState(options),
    initializedAt: '2026-11-26T09:01:00.000Z',
    playerBindings: [
      { participantId: PARTICIPANT_1, playerId: P1 },
      { participantId: PARTICIPANT_2, playerId: P2 },
    ],
  })
  const started = submitMatchRoomCommand(
    initialized,
    {
      source: { kind: 'system', source: 'local-session' },
      command: {
        kind: 'action',
        submission: {
          expectedRevision: initialized.engineState.revision,
          action: {
            actionId: 'action-start' as ActionId,
            type: 'match.start',
            actor: { kind: 'system', system: 'match-setup' },
          },
        },
      },
    },
    { submittedAt: '2026-11-26T09:02:00.000Z' },
  )

  return acceptedRoom(started)
}

/** Note: pieces carry no effect ids; the scripted adapters bind them. */
function makeState(options: { readonly phase?: string } = {}): GameState {
  const kinds = [
    'deck',
    'hand',
    'drop',
    'soul',
    'damage',
    'vanguard_circle',
    'rear_guard_circle',
    'guardian_circle',
  ]
  const contents: Record<string, Record<string, readonly PieceId[]>> = {
    [P1]: {
      deck: [DECK_TOP],
      hand: [SQUIRE],
      damage: DAMAGE,
      vanguard_circle: ['p1-vanguard' as PieceId],
    },
    [P2]: {
      deck: ['p2-deck-1' as PieceId],
      vanguard_circle: ['p2-vanguard' as PieceId],
    },
  }
  const pieces: [string, string, PlayerId, number][] = [
    ['p1-vanguard', 'filler-grade-3', P1, 3],
    [SQUIRE, 'test-ember-squire', P1, 1],
    [DECK_TOP, 'filler-grade-0', P1, 0],
    [DAMAGE[0]!, 'filler-grade-0', P1, 0],
    [DAMAGE[1]!, 'filler-grade-0', P1, 0],
    ['p2-vanguard', 'filler-grade-3', P2, 3],
    ['p2-deck-1', 'filler-grade-0', P2, 0],
    ['p2-rear', 'filler-grade-1', P2, 1],
  ]
  const grades = new Map(pieces.map(([, cardId, , grade]) => [cardId, grade]))

  return {
    gameId: 'game-scripted' as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status: 'ready',
    revision: 0,
    turn: {
      turnNumber: 3,
      turnPlayerId: P1,
      priorityPlayerId: P1,
      phase: (options.phase ?? 'main') as GameState['turn']['phase'],
    },
    players: [P1, P2].map((playerId, seat) => ({
      playerId,
      seat,
      status: playerId === P1 ? 'active' : 'waiting',
      ownedZoneIds: kinds.map((kind) => zone(playerId, kind)),
      counters: [],
      flags: [],
    })),
    zones: [P1, P2].flatMap((playerId) =>
      kinds.map((kind) => ({
        zoneId: zone(playerId, kind),
        kind,
        scope: 'player' as const,
        ownerPlayerId: playerId,
        visibility:
          kind === 'deck' || kind === 'hand'
            ? ('owner-private' as const)
            : ('public' as const),
        layout:
          kind === 'rear_guard_circle'
            ? {
                ordering: 'unordered' as const,
                occupancy: 'slotted' as const,
                slotIds: ['front-left', 'front-right'].map(
                  (name) => `${playerId}-rc-${name}` as ZoneSlotId,
                ),
              }
            : {
                ordering:
                  kind === 'deck'
                    ? ('ordered' as const)
                    : ('unordered' as const),
                occupancy:
                  kind === 'vanguard_circle'
                    ? ('single' as const)
                    : ('multi' as const),
              },
        occupants:
          playerId === P2 && kind === 'rear_guard_circle'
            ? [
                {
                  pieceId: 'p2-rear' as PieceId,
                  slotId: `${P2}-rc-front-left` as ZoneSlotId,
                },
              ]
            : (contents[playerId]?.[kind] ?? []).map((pieceId) => ({
                pieceId,
              })),
      })),
    ),
    pieces: pieces.map(([pieceId, cardId, owner]) => ({
      pieceId: pieceId as PieceId,
      kind: 'card' as const,
      cardDefinitionId: cardId as CardId,
      ownerPlayerId: owner,
      controllerPlayerId: owner,
    })),
    cardStats: buildEngineCardStatsSnapshot(
      Array.from(grades, ([cardId, grade]) => ({
        cardDefinitionId: cardId as CardId,
        cardType: 'normal-unit' as const,
        grade: grade as never,
        power: 10000,
        shield: 5000,
        critical: 1,
        triggerType: null,
        keywords: [],
      })),
    ),
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}
