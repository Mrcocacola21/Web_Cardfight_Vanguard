import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  closeMatchRoomClockState,
  createInMemoryPersistedMatchSessionStorage,
  createMatchRoom,
  createSerializableMatchSessionDocument,
  type MatchRoomId,
  type MatchRoomParticipantId,
  type MatchRoomWithEngineState,
  type SerializableMatchSessionDocument,
} from '@web-vg/match-session'
import { STANDARD_FORMAT_ID } from '@web-vg/rules-core'
import type { UserId } from '@web-vg/shared'

import {
  LOCAL_MATCH_PARTICIPANT_ONE_ID,
  createLocalPrototypeMatchRoom,
} from '@/features/matches/play/local-match-room'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createDbClient: vi.fn(),
  createDbPersistedMatchSessionStorage: vi.fn(),
  createProfilesRepository: vi.fn(),
  getProfileByAuthUserId: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@web-vg/db', () => ({
  createDbClient: mocks.createDbClient,
  createDbPersistedMatchSessionStorage:
    mocks.createDbPersistedMatchSessionStorage,
  createProfilesRepository: mocks.createProfilesRepository,
}))

import { getProjectedPersistedMatchRoomPageState } from './projected-persisted-room-read'

const ROOM_ID = 'persisted-projected-room-1'
const LOCAL_USER_ONE_ID = 'local-user-1'
const AUTH_USER_ID = 'auth-user-1'

describe('getProjectedPersistedMatchRoomPageState', () => {
  let authClient: Record<string, unknown>
  let serviceDbClient: Record<string, unknown>
  let documents: readonly SerializableMatchSessionDocument[]

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    authClient = {
      kind: 'auth-client',
    }
    serviceDbClient = {
      kind: 'service-db-client',
    }
    documents = [createLocalSessionDocument(ROOM_ID)]

    mocks.createSupabaseServerClient.mockResolvedValue(authClient)
    mocks.getCurrentAuthState.mockResolvedValue({
      kind: 'ready',
      user: {
        id: AUTH_USER_ID,
        email: 'pilot@example.com',
      },
    })
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: mocks.getProfileByAuthUserId,
    })
    mocks.getProfileByAuthUserId.mockResolvedValue({
      ok: true,
      data: createProfileRecord(LOCAL_USER_ONE_ID),
    })
    mocks.createDbClient.mockReturnValue(serviceDbClient)
    mocks.createDbPersistedMatchSessionStorage.mockImplementation(() =>
      createInMemoryPersistedMatchSessionStorage(documents),
    )
  })

  it('loads persisted room truth and returns participant-safe projected client state', async () => {
    const state = await getProjectedPersistedMatchRoomPageState({
      roomId: ROOM_ID,
    })

    expect(state.kind).toBe('ready')

    if (state.kind !== 'ready') {
      throw new Error(`Expected ready state, got ${state.kind}.`)
    }

    expect(mocks.createDbClient).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:54321',
      serviceRoleKey: 'test-service-role-key',
    })
    expect(mocks.createDbPersistedMatchSessionStorage).toHaveBeenCalledWith(
      serviceDbClient,
    )
    expect(state.room).toMatchObject({
      source: 'participant_projection',
      roomId: ROOM_ID,
      viewer: {
        participantId: LOCAL_MATCH_PARTICIPANT_ONE_ID,
      },
    })
    expect(state.actions.mode).toBe('normal')
    const opponentHand = state.room.board.opponentSides[0]?.handZones[0]

    expect(
      opponentHand?.pieces.every((piece) => piece.visibility === 'masked'),
    ).toBe(true)
    expect(JSON.stringify(opponentHand)).not.toContain('cardDefinitionId')
    expect(JSON.stringify(opponentHand)).not.toContain('pieceId')
    expect(JSON.stringify(state.room)).not.toContain('engineState')
  })

  it('denies authenticated profiles that are not persisted room participants', async () => {
    mocks.getProfileByAuthUserId.mockResolvedValueOnce({
      ok: true,
      data: createProfileRecord('not-a-room-participant'),
    })

    const state = await getProjectedPersistedMatchRoomPageState({
      roomId: ROOM_ID,
    })

    expect(state).toMatchObject({
      kind: 'error',
      code: 'room_access_denied',
    })
  })

  it('returns not_found when persisted storage has no room record', async () => {
    documents = []

    const state = await getProjectedPersistedMatchRoomPageState({
      roomId: ROOM_ID,
    })

    expect(state).toEqual({
      kind: 'not_found',
    })
  })

  it('supports completed persisted rooms as closed projected views', async () => {
    documents = [createCompletedLocalSessionDocument(ROOM_ID)]

    const state = await getProjectedPersistedMatchRoomPageState({
      roomId: ROOM_ID,
    })

    expect(state.kind).toBe('ready')

    if (state.kind !== 'ready') {
      throw new Error(`Expected ready state, got ${state.kind}.`)
    }

    expect(state.room.status).toBe('completed')
    expect(state.actions.mode).toBe('closed')
  })

  it('fails safely when persisted truth cannot be projected', async () => {
    documents = [createUninitializedSessionDocument(ROOM_ID)]

    const state = await getProjectedPersistedMatchRoomPageState({
      roomId: ROOM_ID,
    })

    expect(state).toMatchObject({
      kind: 'error',
      code: 'projection_failed',
    })
    expect(JSON.stringify(state)).not.toContain('engineState')
  })
})

function createLocalSessionDocument(
  roomId: string,
): SerializableMatchSessionDocument {
  const document = createSerializableMatchSessionDocument({
    room: createLocalPrototypeMatchRoom(roomId),
  })

  if (!document.ok) {
    throw new Error(document.message)
  }

  return document.document
}

function createCompletedLocalSessionDocument(
  roomId: string,
): SerializableMatchSessionDocument {
  const room = createLocalPrototypeMatchRoom(roomId)
  const completedAt = '2026-06-07T13:00:00.000Z'
  const completedRoom: MatchRoomWithEngineState = {
    ...room,
    status: 'completed',
    metadata: {
      ...room.metadata,
      completedAt,
      updatedAt: completedAt,
    },
    clock: closeMatchRoomClockState(room.clock, completedAt),
  }
  const document = createSerializableMatchSessionDocument({
    room: completedRoom,
  })

  if (!document.ok) {
    throw new Error(document.message)
  }

  return document.document
}

function createUninitializedSessionDocument(
  roomId: string,
): SerializableMatchSessionDocument {
  const room = createMatchRoom({
    roomId: roomId as MatchRoomId,
    formatId: STANDARD_FORMAT_ID,
    createdAt: '2026-06-07T12:00:00.000Z',
    participants: [
      {
        participantId:
          'persisted-projection-created-participant' as MatchRoomParticipantId,
        seat: 0,
        userId: LOCAL_USER_ONE_ID as UserId,
        displayName: 'Aichi Sendou',
      },
    ],
  })
  const document = createSerializableMatchSessionDocument({ room })

  if (!document.ok) {
    throw new Error(document.message)
  }

  return document.document
}

function createProfileRecord(profileId: string) {
  return {
    id: profileId,
    username: null,
    displayName: 'Pilot',
    bio: null,
    avatarUrl: null,
    visibility: 'private',
    bioVisibility: 'private',
    createdAt: '2026-06-07T11:00:00.000Z',
    updatedAt: '2026-06-07T11:00:00.000Z',
  }
}
