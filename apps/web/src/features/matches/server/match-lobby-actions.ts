'use server'

import {
  createCatalogRepository,
  createDbClient,
  createDbPersistedMatchSessionStorage,
  createDecksRepository,
  createMatchLobbyRepository,
  createProfilesRepository,
} from '@web-vg/db'
import { createPersistedMatchSessionAdapter } from '@web-vg/match-session'
import { STANDARD_FORMAT_ID } from '@web-vg/rules-core'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import {
  chooseMatchLobbyDeckUseCase,
  respondToMatchLobbyInviteUseCase,
  sendMatchLobbyInviteUseCase,
  setMatchLobbyReadyUseCase,
  startMatchLobbyUseCase,
} from '@/features/matches/application/match-lobby-use-cases'
import { getSupabaseServiceRoleEnv } from '@/lib/supabase/config'
import { createSupabaseServerClient } from '@/lib/supabase/server'

import {
  cryptoRoomIdFactory,
  validateDeckDetailForMatchRoom,
} from './deck-to-match-room-actions'
import {
  initialMatchLobbyFormState,
  type MatchLobbyFormState,
} from './match-lobby-form-state'

export async function sendMatchLobbyInviteAction(
  _previousState: MatchLobbyFormState,
  formData: FormData,
): Promise<MatchLobbyFormState> {
  const inviteeProfileId = readFormString(formData, 'inviteeProfileId')

  if (!inviteeProfileId) {
    return {
      status: 'error',
      message: 'Select a visible opponent before sending an invite.',
      fieldErrors: {
        inviteeProfileId: 'Choose an opponent.',
      },
    }
  }

  const authContext = await resolveLobbyActionContext()

  if (!authContext.ok) {
    return authContext.state
  }

  const result = await sendMatchLobbyInviteUseCase(
    {
      profilesRepository: createProfilesRepository(authContext.client),
      lobbyRepository: createMatchLobbyRepository(authContext.client),
      now: () => new Date().toISOString(),
    },
    {
      authUserId: authContext.authUserId,
      inviteeProfileId,
      formatId: STANDARD_FORMAT_ID,
    },
  )

  if (!result.ok) {
    return mapLobbyErrorToFormState(result.error.message)
  }

  revalidatePath('/matches/lobby')
  redirect(`/matches/lobby/${encodeURIComponent(result.data.invite.id)}`)
}

export async function respondToMatchLobbyInviteAction(
  _previousState: MatchLobbyFormState,
  formData: FormData,
): Promise<MatchLobbyFormState> {
  const inviteId = readFormString(formData, 'inviteId')
  const response = readFormString(formData, 'response')

  if (!inviteId || (response !== 'accepted' && response !== 'declined')) {
    return {
      status: 'error',
      message: 'Choose Accept or Decline for this invite.',
      fieldErrors: {},
    }
  }

  const authContext = await resolveLobbyActionContext()

  if (!authContext.ok) {
    return authContext.state
  }

  const result = await respondToMatchLobbyInviteUseCase(
    {
      profilesRepository: createProfilesRepository(authContext.client),
      lobbyRepository: createMatchLobbyRepository(authContext.client),
      now: () => new Date().toISOString(),
    },
    {
      authUserId: authContext.authUserId,
      inviteId,
      response,
    },
  )

  if (!result.ok) {
    return mapLobbyErrorToFormState(result.error.message)
  }

  revalidateLobby(inviteId)

  return {
    ...initialMatchLobbyFormState,
    status: 'success',
    message:
      response === 'accepted'
        ? 'Invite accepted. Choose a deck and ready up.'
        : 'Invite declined.',
  }
}

export async function chooseMatchLobbyDeckAction(
  _previousState: MatchLobbyFormState,
  formData: FormData,
): Promise<MatchLobbyFormState> {
  const inviteId = readFormString(formData, 'inviteId')
  const deckId = readFormString(formData, 'deckId')

  if (!inviteId || !deckId) {
    return {
      status: 'error',
      message: 'Choose a saved Standard deck first.',
      fieldErrors: {
        deckId: 'Choose one of your decks.',
      },
    }
  }

  const authContext = await resolveLobbyActionContext()

  if (!authContext.ok) {
    return authContext.state
  }

  const result = await chooseMatchLobbyDeckUseCase(
    {
      profilesRepository: createProfilesRepository(authContext.client),
      decksRepository: createDecksRepository(authContext.client),
      lobbyRepository: createMatchLobbyRepository(authContext.client),
      now: () => new Date().toISOString(),
    },
    {
      authUserId: authContext.authUserId,
      inviteId,
      deckId,
    },
  )

  if (!result.ok) {
    return mapLobbyErrorToFormState(result.error.message, {
      deckId: result.error.message,
    })
  }

  revalidateLobby(inviteId)

  return {
    ...initialMatchLobbyFormState,
    status: 'success',
    message: 'Deck selected. Ready state was reset for safety.',
  }
}

export async function setMatchLobbyReadyAction(
  _previousState: MatchLobbyFormState,
  formData: FormData,
): Promise<MatchLobbyFormState> {
  const inviteId = readFormString(formData, 'inviteId')
  const ready = readFormString(formData, 'ready') === 'true'

  if (!inviteId) {
    return mapLobbyErrorToFormState('Lobby invite is missing.')
  }

  const authContext = await resolveLobbyActionContext()

  if (!authContext.ok) {
    return authContext.state
  }

  const result = await setMatchLobbyReadyUseCase(
    {
      profilesRepository: createProfilesRepository(authContext.client),
      decksRepository: createDecksRepository(authContext.client),
      lobbyRepository: createMatchLobbyRepository(authContext.client),
      now: () => new Date().toISOString(),
    },
    {
      authUserId: authContext.authUserId,
      inviteId,
      ready,
    },
  )

  if (!result.ok) {
    return mapLobbyErrorToFormState(result.error.message)
  }

  revalidateLobby(inviteId)

  return {
    ...initialMatchLobbyFormState,
    status: 'success',
    message: ready ? 'Ready locked in.' : 'Ready cleared.',
  }
}

export async function startMatchLobbyAction(
  _previousState: MatchLobbyFormState,
  formData: FormData,
): Promise<MatchLobbyFormState> {
  const inviteId = readFormString(formData, 'inviteId')

  if (!inviteId) {
    return mapLobbyErrorToFormState('Lobby invite is missing.')
  }

  const authContext = await resolveLobbyActionContext()

  if (!authContext.ok) {
    return authContext.state
  }

  let serviceClient
  let roomSessions

  try {
    serviceClient = createDbClient(getSupabaseServiceRoleEnv())
    roomSessions = createPersistedMatchSessionAdapter({
      storage: createDbPersistedMatchSessionStorage(serviceClient),
    })
  } catch {
    return mapLobbyErrorToFormState(
      'The persisted multiplayer match storage backend is not configured.',
    )
  }

  const client = authContext.client
  const result = await startMatchLobbyUseCase(
    {
      profilesRepository: createProfilesRepository(client),
      decksRepository: createDecksRepository(client),
      catalogRepository: createCatalogRepository(client),
      lobbyRepository: createMatchLobbyRepository(serviceClient),
      validationService: {
        validateDeck: validateDeckDetailForMatchRoom,
      },
      roomSessions,
      idFactory: cryptoRoomIdFactory,
      now: () => new Date().toISOString(),
    },
    {
      authUserId: authContext.authUserId,
      inviteId,
    },
  )

  if (!result.ok) {
    return mapLobbyErrorToFormState(result.error.message)
  }

  revalidateLobby(inviteId)
  redirect(`/matches/play/${encodeURIComponent(result.data.roomId)}`)
}

async function resolveLobbyActionContext(): Promise<
  | {
      readonly ok: true
      readonly client: Awaited<ReturnType<typeof createSupabaseServerClient>>
      readonly authUserId: string
    }
  | {
      readonly ok: false
      readonly state: MatchLobbyFormState
    }
> {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      ok: false,
      state: mapLobbyErrorToFormState('Sign in before using match lobbies.'),
    }
  }

  if (authState.kind === 'error') {
    return {
      ok: false,
      state: mapLobbyErrorToFormState(authState.message),
    }
  }

  return {
    ok: true,
    client,
    authUserId: authState.user.id,
  }
}

function revalidateLobby(inviteId: string) {
  revalidatePath('/matches/lobby')
  revalidatePath(`/matches/lobby/${encodeURIComponent(inviteId)}`)
}

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key)

  return typeof value === 'string' ? value.trim() : ''
}

function mapLobbyErrorToFormState(
  message: string,
  fieldErrors: Readonly<Record<string, string>> = {},
): MatchLobbyFormState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}
