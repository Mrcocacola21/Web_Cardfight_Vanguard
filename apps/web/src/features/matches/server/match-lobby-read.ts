import {
  createDecksRepository,
  createMatchLobbyRepository,
  createProfilesRepository,
} from '@web-vg/db'
import type { DeckListItemRecord } from '@web-vg/db/repositories/decks'
import type { MatchLobbyInviteRecord } from '@web-vg/db/repositories/matches'
import { STANDARD_FORMAT_ID } from '@web-vg/rules-core'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface MatchLobbyParticipantView {
  readonly profileId: string
  readonly displayName: string
  readonly role: 'requester' | 'invitee'
  readonly isViewer: boolean
  readonly deckId: string | null
  readonly deckTitle: string | null
  readonly deckSelected: boolean
  readonly ready: boolean
}

export interface MatchLobbyInviteView {
  readonly invite: MatchLobbyInviteRecord
  readonly requesterName: string
  readonly inviteeName: string
  readonly viewerRole: 'requester' | 'invitee'
  readonly href: string
}

export type MatchLobbyIndexPageState =
  | {
      readonly kind: 'ready'
      readonly viewerProfileId: string
      readonly viewerDisplayName: string
      readonly invites: readonly MatchLobbyInviteView[]
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export type MatchLobbyDetailPageState =
  | {
      readonly kind: 'ready'
      readonly viewerProfileId: string
      readonly viewerDisplayName: string
      readonly viewerRole: 'requester' | 'invitee'
      readonly invite: MatchLobbyInviteRecord
      readonly participants: readonly MatchLobbyParticipantView[]
      readonly availableDecks: readonly DeckListItemRecord[]
      readonly canSelectDeck: boolean
      readonly canReady: boolean
      readonly canStart: boolean
    }
  | {
      readonly kind: 'profile-unavailable'
    }
  | {
      readonly kind: 'not-found'
      readonly message: string
    }
  | {
      readonly kind: 'access-denied'
      readonly message: string
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getMatchLobbyIndexPageState(): Promise<MatchLobbyIndexPageState> {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      kind: 'error',
      message: 'Sign in before using match lobbies.',
    }
  }

  if (authState.kind === 'error') {
    return {
      kind: 'error',
      message: authState.message,
    }
  }

  const profilesRepository = createProfilesRepository(client)
  const profileResult = await profilesRepository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!profileResult.ok) {
    return {
      kind: 'error',
      message: profileResult.error.message,
    }
  }

  if (!profileResult.data) {
    return {
      kind: 'profile-unavailable',
    }
  }
  const profile = profileResult.data

  const invitesResult = await createMatchLobbyRepository(
    client,
  ).listInvitesForProfile(profile.id, 25)

  if (!invitesResult.ok) {
    return {
      kind: 'error',
      message: invitesResult.error.message,
    }
  }

  const invites = await Promise.all(
    invitesResult.data.map((invite) =>
      buildInviteView({
        invite,
        viewerProfileId: profile.id,
        viewerDisplayName: profile.displayName,
        profilesRepository,
      }),
    ),
  )

  return {
    kind: 'ready',
    viewerProfileId: profile.id,
    viewerDisplayName: profile.displayName,
    invites,
  }
}

export async function getMatchLobbyDetailPageState(input: {
  readonly inviteId: string
}): Promise<MatchLobbyDetailPageState> {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'signed-out') {
    return {
      kind: 'error',
      message: 'Sign in before opening this match lobby.',
    }
  }

  if (authState.kind === 'error') {
    return {
      kind: 'error',
      message: authState.message,
    }
  }

  const profilesRepository = createProfilesRepository(client)
  const profileResult = await profilesRepository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!profileResult.ok) {
    return {
      kind: 'error',
      message: profileResult.error.message,
    }
  }

  if (!profileResult.data) {
    return {
      kind: 'profile-unavailable',
    }
  }

  const lobbyRepository = createMatchLobbyRepository(client)
  const inviteResult = await lobbyRepository.getInviteById(input.inviteId)

  if (!inviteResult.ok) {
    return {
      kind: 'error',
      message: inviteResult.error.message,
    }
  }

  if (!inviteResult.data) {
    return {
      kind: 'not-found',
      message: 'This match lobby invite is unavailable.',
    }
  }

  const invite = inviteResult.data
  const viewerRole =
    invite.requesterProfileId === profileResult.data.id
      ? 'requester'
      : invite.inviteeProfileId === profileResult.data.id
        ? 'invitee'
        : null

  if (viewerRole === null) {
    return {
      kind: 'access-denied',
      message: 'Only invited participants can open this lobby.',
    }
  }

  const decksResult = await createDecksRepository(client).listDecksByOwner(
    profileResult.data.id,
  )

  if (!decksResult.ok) {
    return {
      kind: 'error',
      message: decksResult.error.message,
    }
  }

  const availableDecks = decksResult.data.filter((deck) => {
    return deck.format.id === STANDARD_FORMAT_ID && deck.currentVersionId
  })
  const participants = await buildParticipants({
    invite,
    viewerProfileId: profileResult.data.id,
    viewerDisplayName: profileResult.data.displayName,
    viewerDecks: availableDecks,
    profilesRepository,
  })
  const viewerParticipant = participants.find((participant) => {
    return participant.isViewer
  })

  return {
    kind: 'ready',
    viewerProfileId: profileResult.data.id,
    viewerDisplayName: profileResult.data.displayName,
    viewerRole,
    invite,
    participants,
    availableDecks,
    canSelectDeck: invite.status === 'accepted',
    canReady:
      invite.status === 'accepted' && Boolean(viewerParticipant?.deckId),
    canStart:
      invite.status === 'accepted' &&
      invite.requesterDeckId !== null &&
      invite.inviteeDeckId !== null &&
      invite.requesterReady &&
      invite.inviteeReady,
  }
}

async function buildInviteView(input: {
  readonly invite: MatchLobbyInviteRecord
  readonly viewerProfileId: string
  readonly viewerDisplayName: string
  readonly profilesRepository: ReturnType<typeof createProfilesRepository>
}): Promise<MatchLobbyInviteView> {
  const requesterName =
    input.invite.requesterProfileId === input.viewerProfileId
      ? input.viewerDisplayName
      : await resolveVisibleProfileName(
          input.profilesRepository,
          input.invite.requesterProfileId,
        )
  const inviteeName =
    input.invite.inviteeProfileId === input.viewerProfileId
      ? input.viewerDisplayName
      : await resolveVisibleProfileName(
          input.profilesRepository,
          input.invite.inviteeProfileId,
        )

  return {
    invite: input.invite,
    requesterName,
    inviteeName,
    viewerRole:
      input.invite.requesterProfileId === input.viewerProfileId
        ? 'requester'
        : 'invitee',
    href: `/matches/lobby/${encodeURIComponent(input.invite.id)}`,
  }
}

async function buildParticipants(input: {
  readonly invite: MatchLobbyInviteRecord
  readonly viewerProfileId: string
  readonly viewerDisplayName: string
  readonly viewerDecks: readonly DeckListItemRecord[]
  readonly profilesRepository: ReturnType<typeof createProfilesRepository>
}): Promise<readonly MatchLobbyParticipantView[]> {
  const requesterName =
    input.invite.requesterProfileId === input.viewerProfileId
      ? input.viewerDisplayName
      : await resolveVisibleProfileName(
          input.profilesRepository,
          input.invite.requesterProfileId,
        )
  const inviteeName =
    input.invite.inviteeProfileId === input.viewerProfileId
      ? input.viewerDisplayName
      : await resolveVisibleProfileName(
          input.profilesRepository,
          input.invite.inviteeProfileId,
        )

  return [
    {
      profileId: input.invite.requesterProfileId,
      displayName: requesterName,
      role: 'requester',
      isViewer: input.invite.requesterProfileId === input.viewerProfileId,
      deckId: input.invite.requesterDeckId,
      deckTitle: resolveViewerDeckTitle(
        input.invite.requesterDeckId,
        input.viewerDecks,
      ),
      deckSelected: input.invite.requesterDeckId !== null,
      ready: input.invite.requesterReady,
    },
    {
      profileId: input.invite.inviteeProfileId,
      displayName: inviteeName,
      role: 'invitee',
      isViewer: input.invite.inviteeProfileId === input.viewerProfileId,
      deckId: input.invite.inviteeDeckId,
      deckTitle: resolveViewerDeckTitle(
        input.invite.inviteeDeckId,
        input.viewerDecks,
      ),
      deckSelected: input.invite.inviteeDeckId !== null,
      ready: input.invite.inviteeReady,
    },
  ]
}

async function resolveVisibleProfileName(
  profilesRepository: ReturnType<typeof createProfilesRepository>,
  profileId: string,
) {
  const profileResult =
    await profilesRepository.getVisibleProfileById(profileId)

  if (!profileResult.ok || !profileResult.data) {
    return 'Invited player'
  }

  return profileResult.data.displayName
}

function resolveViewerDeckTitle(
  deckId: string | null,
  viewerDecks: readonly DeckListItemRecord[],
) {
  if (!deckId) {
    return null
  }

  return (
    viewerDecks.find((deck) => deck.id === deckId)?.title ?? 'Deck selected'
  )
}
