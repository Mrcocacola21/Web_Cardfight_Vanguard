import { randomUUID } from 'node:crypto'

import {
  buildEngineCardStatsSnapshot,
  STANDARD_FORMAT_ID,
  type GameState,
  type PlayerId,
  type ZoneId,
} from '../../../packages/rules-core/src'
import type { CardId, UserId } from '../../../packages/shared/src'
import {
  createDbClient,
  type CreateDbClientInput,
} from '../../../packages/db/src/client'
import { createDbPersistedMatchSessionStorage } from '../../../packages/db/src/repositories/gameplay'
import {
  createMatchRoom,
  createPersistedMatchSessionAdapter,
  initializeMatchRoom,
  MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
  type MatchRoomId,
  type MatchRoomParticipantId,
} from '../../../packages/match-session/src'

interface TestProfile {
  readonly id: string
  readonly displayName: string
}

export function getServiceRoleConfig(): CreateDbClientInput {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Local Supabase service role config is required for this e2e helper.',
    )
  }

  return {
    url,
    serviceRoleKey,
  }
}

export async function getProfileByDisplayName(
  displayName: string,
): Promise<TestProfile> {
  const client = createDbClient(getServiceRoleConfig())
  const { data, error } = await client
    .schema('user_data')
    .from('profiles')
    .select('id, display_name')
    .eq('display_name', displayName)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load profile "${displayName}": ${error.message}`)
  }

  if (!data) {
    throw new Error(`Profile "${displayName}" was not found.`)
  }

  return {
    id: data.id,
    displayName: data.display_name,
  }
}

export async function createPersistedE2EMatchRoom(input: {
  readonly firstProfile: TestProfile
  readonly secondProfile: TestProfile
}): Promise<string> {
  const roomId = randomUUID() as MatchRoomId
  const participantOneId =
    `e2e-participant-one-${roomId}` as MatchRoomParticipantId
  const participantTwoId =
    `e2e-participant-two-${roomId}` as MatchRoomParticipantId
  const playerOneId = `e2e-player-one-${roomId}` as PlayerId
  const playerTwoId = `e2e-player-two-${roomId}` as PlayerId
  const createdAt = '2026-06-12T12:00:00.000Z'
  const createdRoom = createMatchRoom({
    roomId,
    formatId: STANDARD_FORMAT_ID,
    engineAdapterId: MATCH_ROOM_STANDARD_ENGINE_ADAPTER_ID,
    hostParticipantId: participantOneId,
    createdAt,
    participants: [
      {
        participantId: participantOneId,
        seat: 0,
        userId: input.firstProfile.id as UserId,
        displayName: input.firstProfile.displayName,
      },
      {
        participantId: participantTwoId,
        seat: 1,
        userId: input.secondProfile.id as UserId,
        displayName: input.secondProfile.displayName,
      },
    ],
  })
  const room = initializeMatchRoom(createdRoom, {
    initializedAt: '2026-06-12T12:00:01.000Z',
    initialState: createInitialState({
      roomId,
      playerOneId,
      playerTwoId,
    }),
    playerBindings: [
      {
        participantId: participantOneId,
        playerId: playerOneId,
      },
      {
        participantId: participantTwoId,
        playerId: playerTwoId,
      },
    ],
  })
  const adapter = createPersistedMatchSessionAdapter({
    storage: createDbPersistedMatchSessionStorage(
      createDbClient(getServiceRoleConfig()),
    ),
  })
  const persisted = await adapter.createPersistedRoom({
    room,
    recordedAt: '2026-06-12T12:00:02.000Z',
  })

  if (!persisted.ok) {
    throw new Error(persisted.error.message)
  }

  return roomId
}

function createInitialState(input: {
  readonly roomId: MatchRoomId
  readonly playerOneId: PlayerId
  readonly playerTwoId: PlayerId
}): GameState {
  const cardDefinitions = [
    'card-e2e-p1-hand',
    'card-e2e-p1-vanguard',
    'card-e2e-p2-hand',
    'card-e2e-p2-vanguard',
  ].map((cardDefinitionId) => ({
    cardDefinitionId: cardDefinitionId as CardId,
    cardType: 'normal-unit' as const,
    grade: 0 as const,
    power: 6000,
    shield: 5000,
    critical: 1,
    triggerType: null,
    keywords: [],
  }))

  return {
    gameId: `game:${input.roomId}` as GameState['gameId'],
    formatId: STANDARD_FORMAT_ID,
    status: 'setup',
    revision: 0,
    turn: {
      turnNumber: 0,
      turnPlayerId: input.playerOneId,
      phase: 'pregame',
      step: 'setup',
    },
    players: [
      player(input.playerOneId, 0, [
        'zone-e2e-p1-hand',
        'zone-e2e-p1-vanguard',
      ]),
      player(input.playerTwoId, 1, [
        'zone-e2e-p2-hand',
        'zone-e2e-p2-vanguard',
      ]),
    ],
    zones: [
      zone('zone-e2e-p1-hand', 'hand', input.playerOneId, 'owner-private', [
        'piece-e2e-p1-hand',
      ]),
      zone(
        'zone-e2e-p1-vanguard',
        'vanguard_circle',
        input.playerOneId,
        'public',
        ['piece-e2e-p1-vanguard'],
      ),
      zone('zone-e2e-p2-hand', 'hand', input.playerTwoId, 'owner-private', [
        'piece-e2e-p2-hand',
      ]),
      zone(
        'zone-e2e-p2-vanguard',
        'vanguard_circle',
        input.playerTwoId,
        'public',
        ['piece-e2e-p2-vanguard'],
      ),
    ],
    pieces: [
      piece('piece-e2e-p1-hand', 'card-e2e-p1-hand', input.playerOneId),
      piece('piece-e2e-p1-vanguard', 'card-e2e-p1-vanguard', input.playerOneId),
      piece('piece-e2e-p2-hand', 'card-e2e-p2-hand', input.playerTwoId),
      piece('piece-e2e-p2-vanguard', 'card-e2e-p2-vanguard', input.playerTwoId),
    ],
    cardStats: buildEngineCardStatsSnapshot(cardDefinitions),
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

function player(
  playerId: PlayerId,
  seat: number,
  ownedZoneIds: readonly string[],
): GameState['players'][number] {
  return {
    playerId,
    seat,
    status: 'waiting',
    ownedZoneIds: ownedZoneIds.map((zoneId) => zoneId as ZoneId),
    counters: [],
    flags: [],
  }
}

function zone(
  zoneId: string,
  kind: GameState['zones'][number]['kind'],
  ownerPlayerId: PlayerId,
  visibility: GameState['zones'][number]['visibility'],
  pieceIds: readonly string[],
): GameState['zones'][number] {
  return {
    zoneId: zoneId as ZoneId,
    kind,
    scope: 'player',
    ownerPlayerId,
    visibility,
    layout: {
      ordering: kind === 'hand' ? 'unordered' : 'ordered',
      occupancy: kind === 'vanguard_circle' ? 'single' : 'multi',
    },
    occupants: pieceIds.map((pieceId) => ({
      pieceId: pieceId as GameState['pieces'][number]['pieceId'],
    })),
  }
}

function piece(
  pieceId: string,
  cardDefinitionId: string,
  playerId: PlayerId,
): GameState['pieces'][number] {
  return {
    pieceId: pieceId as GameState['pieces'][number]['pieceId'],
    kind: 'card',
    cardDefinitionId: cardDefinitionId as CardId,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
  }
}
