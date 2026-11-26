import {
  createDbClient,
  createDbPersistedMatchSessionStorage,
  createProfilesRepository,
} from '@web-vg/db'
import {
  createPersistedMatchSessionAdapter,
  createServerRouteRealtimeTransport,
  type MatchRoomId,
  type MatchRoomParticipantId,
  type RealtimeClientCommand,
  type RealtimeClientCommandId,
  type ServerRouteRealtimeTransport,
} from '@web-vg/match-session'
import { NextResponse, type NextRequest } from 'next/server'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import { matchEngineAdapters } from '@/features/matches/engine/match-engine'
import { getSupabaseServiceRoleEnv } from '@/lib/supabase/config'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/route-handler'

export const dynamic = 'force-dynamic'

interface MatchRoomRealtimeRouteContext {
  readonly params: Promise<{
    readonly roomId: string
  }>
}

interface ResolvedRealtimeRouteContext {
  readonly roomId: MatchRoomId
  readonly participantId: MatchRoomParticipantId
  readonly transport: ServerRouteRealtimeTransport
  readonly applyResponseCookies: (response: NextResponse) => NextResponse
}

type RouteResolution =
  | {
      readonly ok: true
      readonly context: ResolvedRealtimeRouteContext
    }
  | {
      readonly ok: false
      readonly response: NextResponse
    }

interface ParsedRealtimeCommandBody {
  readonly commandId: string
  readonly expectedRoomRevision?: number
  readonly payload: RealtimeClientCommand['payload']
}

type ParsedRealtimeCommandBodyResult =
  | {
      readonly ok: true
      readonly body: ParsedRealtimeCommandBody
    }
  | {
      readonly ok: false
      readonly message: string
    }

export async function GET(
  request: NextRequest,
  routeContext: MatchRoomRealtimeRouteContext,
) {
  const resolved = await resolveRealtimeRouteContext(request, routeContext)

  if (!resolved.ok) {
    return resolved.response
  }

  const { roomId, participantId, transport, applyResponseCookies } =
    resolved.context
  const response = await transport.loadParticipantSnapshot({
    roomId,
    participantId,
    requestedAt: new Date().toISOString(),
  })

  return createJsonResponse(applyResponseCookies, response)
}

export async function POST(
  request: NextRequest,
  routeContext: MatchRoomRealtimeRouteContext,
) {
  const resolved = await resolveRealtimeRouteContext(request, routeContext)

  if (!resolved.ok) {
    return resolved.response
  }

  const parsedBody = await parseRealtimeCommandBody(request)

  if (!parsedBody.ok) {
    return createJsonResponse(
      resolved.context.applyResponseCookies,
      {
        status: 'error',
        code: 'invalid_request',
        message: parsedBody.message,
      },
      400,
    )
  }

  const { roomId, participantId, transport, applyResponseCookies } =
    resolved.context
  const command: RealtimeClientCommand = {
    commandId: parsedBody.body.commandId as RealtimeClientCommandId,
    roomId,
    participantId,
    payload: parsedBody.body.payload,
    ...(parsedBody.body.expectedRoomRevision === undefined
      ? {}
      : {
          expectedRoomRevision: parsedBody.body.expectedRoomRevision,
        }),
  }
  const response = await transport.submitCommand({
    command,
    receivedAt: new Date().toISOString(),
  })

  return createJsonResponse(applyResponseCookies, response)
}

async function resolveRealtimeRouteContext(
  request: NextRequest,
  routeContext: MatchRoomRealtimeRouteContext,
): Promise<RouteResolution> {
  const { client, applyResponseCookies } =
    createSupabaseRouteHandlerClient(request)
  const roomIdResult = await resolveRoomId(routeContext)

  if (!roomIdResult.ok) {
    return {
      ok: false,
      response: createJsonResponse(
        applyResponseCookies,
        {
          status: 'error',
          code: 'invalid_request',
          message: roomIdResult.message,
        },
        400,
      ),
    }
  }

  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      ok: false,
      response: createJsonResponse(
        applyResponseCookies,
        {
          status: 'error',
          code: 'auth_required',
          message: 'Sign in before interacting with a multiplayer match room.',
        },
        401,
      ),
    }
  }

  if (authState.kind === 'error') {
    return {
      ok: false,
      response: createJsonResponse(
        applyResponseCookies,
        {
          status: 'error',
          code: 'auth_unavailable',
          message: authState.message,
        },
        503,
      ),
    }
  }

  const profileResult = await createProfilesRepository(
    client,
  ).getProfileByAuthUserId(authState.user.id)

  if (!profileResult.ok) {
    return {
      ok: false,
      response: createJsonResponse(
        applyResponseCookies,
        {
          status: 'error',
          code: 'profile_load_failed',
          message: profileResult.error.message,
        },
        503,
      ),
    }
  }

  if (profileResult.data === null) {
    return {
      ok: false,
      response: createJsonResponse(
        applyResponseCookies,
        {
          status: 'error',
          code: 'profile_required',
          message:
            'The authenticated user must have a profile before interacting with a multiplayer match room.',
        },
        403,
      ),
    }
  }

  const profile = profileResult.data
  let storage

  try {
    const serviceEnv = getSupabaseServiceRoleEnv()
    const dbClient = createDbClient(serviceEnv)
    storage = createDbPersistedMatchSessionStorage(dbClient)
  } catch {
    return {
      ok: false,
      response: createJsonResponse(
        applyResponseCookies,
        {
          status: 'error',
          code: 'storage_unavailable',
          message:
            'The multiplayer match storage backend is not available for server route transport.',
        },
        503,
      ),
    }
  }

  const sessions = createPersistedMatchSessionAdapter({ storage })
  const loaded = await sessions.loadRoomSession(roomIdResult.roomId)

  if (!loaded.ok) {
    return {
      ok: false,
      response: createJsonResponse(
        applyResponseCookies,
        {
          status: 'error',
          code: loaded.error.code,
          message: loaded.error.message,
        },
        mapSessionLoadIssueStatus(loaded.error.code),
      ),
    }
  }

  const participant = loaded.data.document.room.participants.find(
    (candidate) => candidate.userId === profile.id,
  )

  if (participant === undefined) {
    return {
      ok: false,
      response: createJsonResponse(
        applyResponseCookies,
        {
          status: 'error',
          code: 'room_access_denied',
          message:
            'The authenticated profile is not a participant in this match room.',
        },
        403,
      ),
    }
  }

  return {
    ok: true,
    context: {
      roomId: roomIdResult.roomId,
      participantId: participant.participantId,
      transport: createServerRouteRealtimeTransport({
        sessions,
        engineAdapters: matchEngineAdapters,
      }),
      applyResponseCookies,
    },
  }
}

async function resolveRoomId(
  routeContext: MatchRoomRealtimeRouteContext,
): Promise<
  | {
      readonly ok: true
      readonly roomId: MatchRoomId
    }
  | {
      readonly ok: false
      readonly message: string
    }
> {
  const params = await routeContext.params
  const roomId = decodeURIComponent(params.roomId).trim()

  if (!roomId) {
    return {
      ok: false,
      message: 'A match room id is required.',
    }
  }

  return {
    ok: true,
    roomId: roomId as MatchRoomId,
  }
}

async function parseRealtimeCommandBody(
  request: NextRequest,
): Promise<ParsedRealtimeCommandBodyResult> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return {
      ok: false,
      message: 'Realtime command requests must contain a JSON body.',
    }
  }

  if (!isRecord(body)) {
    return {
      ok: false,
      message: 'Realtime command requests must contain a JSON object.',
    }
  }

  if (!isNonEmptyString(body.commandId)) {
    return {
      ok: false,
      message: 'Realtime command requests require a non-empty commandId.',
    }
  }

  const rawExpectedRoomRevision = body.expectedRoomRevision

  if (
    rawExpectedRoomRevision !== undefined &&
    !Number.isSafeInteger(rawExpectedRoomRevision)
  ) {
    return {
      ok: false,
      message:
        'Realtime command expectedRoomRevision must be a safe integer when provided.',
    }
  }

  if (!isEngineCommandEnvelope(body.payload)) {
    return {
      ok: false,
      message:
        'Realtime command payload must be an action or choice_response command envelope.',
    }
  }

  const expectedRoomRevision =
    rawExpectedRoomRevision === undefined
      ? undefined
      : Number(rawExpectedRoomRevision)
  const parsed = {
    commandId: body.commandId.trim(),
    payload: body.payload as RealtimeClientCommand['payload'],
  }

  if (expectedRoomRevision === undefined) {
    return {
      ok: true,
      body: parsed,
    }
  }

  return {
    ok: true,
    body: {
      ...parsed,
      expectedRoomRevision,
    },
  }
}

function isEngineCommandEnvelope(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.submission)) {
    return false
  }

  if (
    value.submission.expectedRevision !== undefined &&
    !Number.isSafeInteger(value.submission.expectedRevision)
  ) {
    return false
  }

  if (value.kind === 'action') {
    if (!isRecord(value.submission.action)) {
      return false
    }

    const actor = value.submission.action.actor

    return (
      isRecord(actor) && (actor.kind === 'player' || actor.kind === 'system')
    )
  }

  if (value.kind === 'choice_response') {
    return isRecord(value.submission.response)
  }

  return false
}

function mapSessionLoadIssueStatus(code: string): number {
  switch (code) {
    case 'room_not_found':
      return 404
    case 'storage_failed':
      return 503
    default:
      return 409
  }
}

function createJsonResponse(
  applyResponseCookies: (response: NextResponse) => NextResponse,
  body: unknown,
  status = 200,
) {
  return applyResponseCookies(NextResponse.json(body, { status }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
