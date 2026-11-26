import {
  createDbClient,
  createDbPersistedMatchSessionStorage,
  createProfilesRepository,
} from '@web-vg/db'
import {
  createPersistedMatchSessionAdapter,
  projectMatchRoomForParticipant,
  type MatchRoomHistoryEntry,
  type MatchRoomId,
} from '@web-vg/match-session'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import {
  buildProjectedMatchRoomClientState,
  createProjectedMatchActionsProjection,
  type MatchClientActionsProjection,
  type ProjectedMatchRoomClientState,
} from '@/features/matches/play/projected-client-state'
import { getSupabaseServiceRoleEnv } from '@/lib/supabase/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { matchEngineAdapters } from '@/features/matches/engine/match-engine'

export type ProjectedPersistedMatchRoomPageState =
  | {
      readonly kind: 'ready'
      readonly room: ProjectedMatchRoomClientState
      readonly actions: MatchClientActionsProjection
    }
  | {
      readonly kind: 'not_found'
    }
  | {
      readonly kind: 'error'
      readonly code:
        | 'auth_required'
        | 'auth_unavailable'
        | 'profile_required'
        | 'profile_load_failed'
        | 'storage_unavailable'
        | 'room_access_denied'
        | 'room_load_failed'
        | 'projection_failed'
      readonly title: string
      readonly message: string
    }

export async function getProjectedPersistedMatchRoomPageState(input: {
  readonly roomId: string
}): Promise<ProjectedPersistedMatchRoomPageState> {
  const roomId = normalizeRoomId(input.roomId)

  if (roomId === null) {
    return {
      kind: 'not_found',
    }
  }

  const authClient = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client: authClient })

  if (authState.kind === 'signed-out') {
    return createPageError({
      code: 'auth_required',
      title: 'Match room requires sign in',
      message: 'Sign in before opening a multiplayer match room.',
    })
  }

  if (authState.kind === 'error') {
    return createPageError({
      code: 'auth_unavailable',
      title: 'Match room authentication is unavailable',
      message: authState.message,
    })
  }

  const profileResult = await createProfilesRepository(
    authClient,
  ).getProfileByAuthUserId(authState.user.id)

  if (!profileResult.ok) {
    return createPageError({
      code: 'profile_load_failed',
      title: 'Profile could not be loaded',
      message: profileResult.error.message,
    })
  }

  if (profileResult.data === null) {
    return createPageError({
      code: 'profile_required',
      title: 'Profile required',
      message: 'Create your profile before opening a multiplayer match room.',
    })
  }

  let storage

  try {
    const serviceEnv = getSupabaseServiceRoleEnv()
    storage = createDbPersistedMatchSessionStorage(createDbClient(serviceEnv))
  } catch {
    return createPageError({
      code: 'storage_unavailable',
      title: 'Match room storage is unavailable',
      message:
        'The persisted multiplayer match storage backend is not configured.',
    })
  }

  const sessions = createPersistedMatchSessionAdapter({ storage })
  const loaded = await sessions.loadRoomSession(roomId)

  if (!loaded.ok) {
    if (loaded.error.code === 'room_not_found') {
      return {
        kind: 'not_found',
      }
    }

    return createPageError({
      code: 'room_load_failed',
      title: 'Match room could not be loaded',
      message: loaded.error.message,
    })
  }

  const profile = profileResult.data
  const participant = loaded.data.document.room.participants.find(
    (candidate) => candidate.userId === profile.id,
  )

  if (participant === undefined) {
    return createPageError({
      code: 'room_access_denied',
      title: 'Match room access denied',
      message: 'Your profile is not a participant in this match room.',
    })
  }

  const projection = projectMatchRoomForParticipant(
    loaded.data.document.room,
    participant.participantId,
    {
      events: extractAcceptedEngineEvents(loaded.data.document.history),
      serverNow: new Date().toISOString(),
      engineAdapters: matchEngineAdapters,
    },
  )

  if (!projection.ok) {
    return createPageError({
      code: 'projection_failed',
      title: 'Match projection unavailable',
      message: projection.message,
    })
  }

  const clientState = buildProjectedMatchRoomClientState({
    projection: projection.projection,
    roomRevision: loaded.data.document.room.revision,
    engineRevision: projection.projection.visibleState.revision,
    acceptedHistoryEntryIds: loaded.data.document.history.map(
      (entry) => entry.entryId,
    ),
  })

  if (!clientState.ok) {
    return createPageError({
      code: 'projection_failed',
      title: 'Match projection unavailable',
      message: clientState.message,
    })
  }

  return {
    kind: 'ready',
    room: clientState.state,
    actions: createProjectedMatchActionsProjection(clientState.state),
  }
}

function normalizeRoomId(roomId: string): MatchRoomId | null {
  const normalizedRoomId = roomId.trim()

  if (!normalizedRoomId) {
    return null
  }

  return normalizedRoomId as MatchRoomId
}

function extractAcceptedEngineEvents(
  history: readonly MatchRoomHistoryEntry[],
) {
  return history.flatMap((entry) =>
    entry.event.kind === 'engine_event' ? [entry.event.event] : [],
  )
}

function createPageError(
  input: Omit<
    Extract<ProjectedPersistedMatchRoomPageState, { kind: 'error' }>,
    'kind'
  >,
): ProjectedPersistedMatchRoomPageState {
  return {
    kind: 'error',
    ...input,
  }
}
