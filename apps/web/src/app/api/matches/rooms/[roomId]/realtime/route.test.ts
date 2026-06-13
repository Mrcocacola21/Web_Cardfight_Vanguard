// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ROOM_ID = '00000000-0000-4000-8000-000000000202'
const AUTH_USER_ID = 'auth-user-1'
const PROFILE_ID = 'profile-1'
const PARTICIPANT_ID = 'participant-authorized'
const OTHER_PROFILE_ID = 'profile-2'
const OTHER_PARTICIPANT_ID = 'participant-other'
const PLAYER_ID = 'player-1'

const mocks = vi.hoisted(() => ({
  createSupabaseRouteHandlerClient: vi.fn(),
  applyResponseCookies: vi.fn(),
  getUser: vi.fn(),
  createDbClient: vi.fn(),
  createProfilesRepository: vi.fn(),
  getProfileByAuthUserId: vi.fn(),
  createDbPersistedMatchSessionStorage: vi.fn(),
  createPersistedMatchSessionAdapter: vi.fn(),
  createServerRouteRealtimeTransport: vi.fn(),
  loadRoomSession: vi.fn(),
  submitCommand: vi.fn(),
  loadParticipantSnapshot: vi.fn(),
}))

vi.mock('@/lib/supabase/route-handler', () => ({
  createSupabaseRouteHandlerClient: mocks.createSupabaseRouteHandlerClient,
}))

vi.mock('@web-vg/db', () => ({
  createDbClient: mocks.createDbClient,
  createProfilesRepository: mocks.createProfilesRepository,
  createDbPersistedMatchSessionStorage:
    mocks.createDbPersistedMatchSessionStorage,
}))

vi.mock('@web-vg/match-session', () => ({
  createPersistedMatchSessionAdapter: mocks.createPersistedMatchSessionAdapter,
  createServerRouteRealtimeTransport: mocks.createServerRouteRealtimeTransport,
}))

import { GET, POST } from './route'

describe('/api/matches/rooms/[roomId]/realtime', () => {
  let authClient: Record<string, unknown>
  let serviceDbClient: Record<string, unknown>
  let storage: Record<string, unknown>
  let sessions: Record<string, unknown>
  let transport: Record<string, unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

    authClient = {
      auth: {
        getUser: mocks.getUser,
      },
    }
    serviceDbClient = {
      kind: 'service-db-client',
    }
    storage = {
      kind: 'db-backed-persisted-session-storage',
    }
    sessions = {
      loadRoomSession: mocks.loadRoomSession,
      persistAcceptedRoomTransition: vi.fn(),
    }
    transport = {
      submitCommand: mocks.submitCommand,
      loadParticipantSnapshot: mocks.loadParticipantSnapshot,
    }

    mocks.applyResponseCookies.mockImplementation(
      (response: Response) => response,
    )
    mocks.createSupabaseRouteHandlerClient.mockReturnValue({
      client: authClient,
      applyResponseCookies: mocks.applyResponseCookies,
    })
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: AUTH_USER_ID,
          email: 'pilot@example.com',
        },
      },
      error: null,
    })
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: mocks.getProfileByAuthUserId,
    })
    mocks.getProfileByAuthUserId.mockResolvedValue({
      ok: true,
      data: createProfileRecord(PROFILE_ID),
    })
    mocks.createDbClient.mockReturnValue(serviceDbClient)
    mocks.createDbPersistedMatchSessionStorage.mockReturnValue(storage)
    mocks.createPersistedMatchSessionAdapter.mockReturnValue(sessions)
    mocks.createServerRouteRealtimeTransport.mockReturnValue(transport)
    mocks.loadRoomSession.mockResolvedValue(createLoadedSession())
  })

  it('submits an authenticated participant command through server route transport', async () => {
    mocks.submitCommand.mockResolvedValue(
      createAcceptedCommandResponse('command-accepted'),
    )

    const response = await POST(
      createPostRequest({
        commandId: 'command-accepted',
        participantId: 'forged-client-participant',
        expectedRoomRevision: 7,
        payload: createPlayerActionPayload(),
      }),
      createRouteContext(),
    )
    const json = await readJson(response)

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'accepted',
      commandId: 'command-accepted',
      participantId: PARTICIPANT_ID,
      projectedUpdate: {
        participantId: PARTICIPANT_ID,
      },
    })
    expect(mocks.createDbClient).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:54321',
      serviceRoleKey: 'test-service-role-key',
    })
    expect(mocks.createDbPersistedMatchSessionStorage).toHaveBeenCalledWith(
      serviceDbClient,
    )
    expect(mocks.createPersistedMatchSessionAdapter).toHaveBeenCalledWith({
      storage,
    })
    expect(mocks.createServerRouteRealtimeTransport).toHaveBeenCalledWith({
      sessions,
    })
    const submitRequest = requireRecord(
      mocks.submitCommand.mock.calls[0]?.[0] as unknown,
    )

    expect(submitRequest.command).toMatchObject({
      commandId: 'command-accepted',
      roomId: ROOM_ID,
      participantId: PARTICIPANT_ID,
      expectedRoomRevision: 7,
      payload: createPlayerActionPayload(),
    })
    expect(typeof submitRequest.receivedAt).toBe('string')
    expect(JSON.stringify(json)).not.toContain('engineState')
    expect(JSON.stringify(json)).not.toContain('opponent-secret-card')
  })

  it('denies unauthenticated callers before loading service-role storage', async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: {
        user: null,
      },
      error: null,
    })

    const response = await POST(
      createPostRequest({
        commandId: 'command-denied',
        payload: createPlayerActionPayload(),
      }),
      createRouteContext(),
    )
    const json = await readJson(response)

    expect(response.status).toBe(401)
    expect(json).toMatchObject({
      status: 'error',
      code: 'auth_required',
    })
    expect(mocks.createDbClient).not.toHaveBeenCalled()
    expect(mocks.createServerRouteRealtimeTransport).not.toHaveBeenCalled()
    expect(mocks.submitCommand).not.toHaveBeenCalled()
  })

  it('denies authenticated users that are not room participants', async () => {
    mocks.getProfileByAuthUserId.mockResolvedValueOnce({
      ok: true,
      data: createProfileRecord('profile-not-in-room'),
    })

    const response = await POST(
      createPostRequest({
        commandId: 'command-nonparticipant',
        payload: createPlayerActionPayload(),
      }),
      createRouteContext(),
    )
    const json = await readJson(response)

    expect(response.status).toBe(403)
    expect(json).toMatchObject({
      status: 'error',
      code: 'room_access_denied',
    })
    expect(mocks.createServerRouteRealtimeTransport).not.toHaveBeenCalled()
    expect(mocks.submitCommand).not.toHaveBeenCalled()
  })

  it('returns invalid command responses without exposing canonical room state', async () => {
    mocks.submitCommand.mockResolvedValue(
      createInvalidCommandResponse('command-stale', 'stale_room_revision'),
    )

    const response = await POST(
      createPostRequest({
        commandId: 'command-stale',
        expectedRoomRevision: 6,
        payload: createPlayerActionPayload(),
      }),
      createRouteContext(),
    )
    const json = await readJson(response)

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'invalid',
      commandId: 'command-stale',
      code: 'stale_room_revision',
      projectedUpdate: {
        roomRevision: 7,
      },
    })
    expect(JSON.stringify(json)).not.toContain('engineState')
  })

  it('passes blocked pending request surfaces through as projected participant-safe data', async () => {
    mocks.submitCommand.mockResolvedValue(
      createBlockedCommandResponse('command-pending'),
    )

    const response = await POST(
      createPostRequest({
        commandId: 'command-pending',
        expectedRoomRevision: 7,
        payload: createPlayerActionPayload(),
      }),
      createRouteContext(),
    )
    const json = await readJson(response)

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'blocked',
      commandId: 'command-pending',
      projectedUpdate: {
        projection: {
          pendingRequests: [
            {
              requestId: 'guard-request-1',
              deadlineAt: '2026-06-07T12:00:30.000Z',
            },
          ],
          availableActions: [
            {
              actionId: 'guard-pass',
            },
          ],
        },
      },
    })
  })

  it('loads a participant snapshot through the same authenticated transport path', async () => {
    mocks.loadParticipantSnapshot.mockResolvedValue(createSnapshotResponse())

    const response = await GET(
      new NextRequest(
        `http://127.0.0.1:3000/api/matches/rooms/${ROOM_ID}/realtime`,
      ),
      createRouteContext(),
    )
    const json = await readJson(response)

    expect(response.status).toBe(200)
    expect(json).toMatchObject({
      status: 'ok',
      participantId: PARTICIPANT_ID,
      projectedUpdate: {
        reason: 'reconnect_snapshot',
      },
    })
    const snapshotRequest = requireRecord(
      mocks.loadParticipantSnapshot.mock.calls[0]?.[0] as unknown,
    )

    expect(snapshotRequest).toMatchObject({
      roomId: ROOM_ID,
      participantId: PARTICIPANT_ID,
    })
    expect(typeof snapshotRequest.requestedAt).toBe('string')
    expect(JSON.stringify(json)).not.toContain('engineState')
  })

  it('returns room_not_found as a structured route error', async () => {
    mocks.loadRoomSession.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'room_not_found',
        message: 'Match room was not found.',
      },
    })

    const response = await GET(
      new NextRequest(
        `http://127.0.0.1:3000/api/matches/rooms/${ROOM_ID}/realtime`,
      ),
      createRouteContext(),
    )
    const json = await readJson(response)

    expect(response.status).toBe(404)
    expect(json).toMatchObject({
      status: 'error',
      code: 'room_not_found',
    })
    expect(mocks.createServerRouteRealtimeTransport).not.toHaveBeenCalled()
    expect(mocks.loadParticipantSnapshot).not.toHaveBeenCalled()
  })
})

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest(
    `http://127.0.0.1:3000/api/matches/rooms/${ROOM_ID}/realtime`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
}

function createRouteContext() {
  return {
    params: Promise.resolve({
      roomId: ROOM_ID,
    }),
  }
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as unknown as Record<string, unknown>
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error('Expected a record value.')
  }

  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

function createLoadedSession() {
  return {
    ok: true,
    data: {
      document: {
        version: 1,
        persistenceModel: 'snapshot+event-history',
        room: {
          roomId: ROOM_ID,
          revision: 7,
          participants: [
            {
              participantId: PARTICIPANT_ID,
              userId: PROFILE_ID,
              enginePlayerId: PLAYER_ID,
              seat: 0,
            },
            {
              participantId: OTHER_PARTICIPANT_ID,
              userId: OTHER_PROFILE_ID,
              enginePlayerId: 'player-2',
              seat: 1,
            },
          ],
        },
        history: [],
      },
      session: {
        room: {
          roomId: ROOM_ID,
        },
        history: [],
      },
      persistedAt: '2026-06-07T11:59:00.000Z',
    },
  }
}

function createPlayerActionPayload() {
  return {
    kind: 'action',
    submission: {
      expectedRevision: 11,
      action: {
        actionId: 'action-ready',
        type: 'match.ready',
        actor: {
          kind: 'player',
          playerId: PLAYER_ID,
        },
        playerId: PLAYER_ID,
      },
    },
  }
}

function createAcceptedCommandResponse(commandId: string) {
  return {
    transport: 'server_route_commands_with_projected_snapshots',
    status: 'accepted',
    commandId,
    roomId: ROOM_ID,
    participantId: PARTICIPANT_ID,
    roomRevision: 8,
    engineRevision: 12,
    acceptedHistoryEntryIds: [`${ROOM_ID}:history:8`],
    projectedUpdate: createProjectedUpdate({
      reason: 'command_accepted',
      roomRevision: 8,
      engineRevision: 12,
    }),
  }
}

function createInvalidCommandResponse(commandId: string, code: string) {
  return {
    transport: 'server_route_commands_with_projected_snapshots',
    status: 'invalid',
    commandId,
    roomId: ROOM_ID,
    participantId: PARTICIPANT_ID,
    code,
    message: 'The client command targeted a stale room revision.',
    projectedUpdate: createProjectedUpdate({
      reason: 'reconnect_snapshot',
      roomRevision: 7,
      engineRevision: 11,
    }),
  }
}

function createBlockedCommandResponse(commandId: string) {
  return {
    transport: 'server_route_commands_with_projected_snapshots',
    status: 'blocked',
    commandId,
    roomId: ROOM_ID,
    participantId: PARTICIPANT_ID,
    code: 'pending_choice_required',
    message: 'A pending choice must be resolved before this command.',
    projectedUpdate: createProjectedUpdate({
      reason: 'reconnect_snapshot',
      roomRevision: 7,
      engineRevision: 11,
      pendingRequests: [
        {
          requestId: 'guard-request-1',
          responderPlayerId: PLAYER_ID,
          deadlineAt: '2026-06-07T12:00:30.000Z',
        },
      ],
      availableActions: [
        {
          actionId: 'guard-pass',
          label: 'Pass',
        },
      ],
    }),
  }
}

function createSnapshotResponse() {
  return {
    transport: 'server_route_commands_with_projected_snapshots',
    status: 'ok',
    roomId: ROOM_ID,
    participantId: PARTICIPANT_ID,
    roomRevision: 7,
    engineRevision: 11,
    projectedUpdate: createProjectedUpdate({
      reason: 'reconnect_snapshot',
      roomRevision: 7,
      engineRevision: 11,
    }),
  }
}

function createProjectedUpdate(input: {
  readonly reason: 'command_accepted' | 'reconnect_snapshot'
  readonly roomRevision: number
  readonly engineRevision: number
  readonly pendingRequests?: readonly Record<string, unknown>[]
  readonly availableActions?: readonly Record<string, unknown>[]
}) {
  return {
    type: 'projected_state',
    reason: input.reason,
    roomId: ROOM_ID,
    participantId: PARTICIPANT_ID,
    roomRevision: input.roomRevision,
    engineRevision: input.engineRevision,
    acceptedHistoryEntryIds:
      input.reason === 'command_accepted'
        ? [`${ROOM_ID}:history:${input.roomRevision}`]
        : [],
    projection: {
      viewer: {
        participantId: PARTICIPANT_ID,
        playerId: PLAYER_ID,
      },
      visibleState: {
        selfHand: ['visible-self-card'],
        opponentHand: {
          count: 5,
          cards: ['hidden-card-back'],
        },
      },
      clock: {
        serverNow: '2026-06-07T12:00:00.000Z',
        activeDeadlineAt: '2026-06-07T12:00:30.000Z',
      },
      pendingRequests: input.pendingRequests ?? [],
      availableActions: input.availableActions ?? [],
      eventLog: [
        {
          entryId: `${ROOM_ID}:history:${input.roomRevision}`,
          label: 'Ready accepted',
        },
      ],
    },
  }
}
