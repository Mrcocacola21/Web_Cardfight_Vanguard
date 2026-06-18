import type {
  DeckDetailRecord,
  DeckListItemRecord,
} from '@web-vg/db/repositories/decks'
import type {
  MatchLobbyInviteRecord,
  MatchLobbyRepository,
} from '@web-vg/db/repositories/matches'
import type { ProfilesRepository } from '@web-vg/db/repositories/profiles'
import { STANDARD_FORMAT_ID } from '@web-vg/rules-core'

import {
  createTwoDeckMatchRoomUseCase,
  type CreateTwoDeckMatchRoomServices,
  type DeckToMatchRoomCatalogRepository,
  type DeckToMatchRoomDeckRepository,
  type DeckToMatchRoomIdFactory,
  type DeckToMatchRoomValidationService,
} from './deck-to-match-room-use-cases'

type RepositoryResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
      }
    }

export type MatchLobbyErrorCode =
  | 'profile-required'
  | 'invite-unavailable'
  | 'invite-access-denied'
  | 'opponent-unavailable'
  | 'self-opponent'
  | 'invite-not-pending'
  | 'lobby-not-accepted'
  | 'deck-unavailable'
  | 'deck-required'
  | 'not-ready'
  | 'already-started'
  | 'repository-failed'
  | 'room-start-failed'

export interface MatchLobbyError {
  readonly code: MatchLobbyErrorCode
  readonly message: string
}

export type MatchLobbyResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: MatchLobbyError
    }

export interface MatchLobbyAuthServices {
  readonly profilesRepository: Pick<
    ProfilesRepository,
    'getProfileByAuthUserId' | 'getVisibleProfileById'
  >
  readonly lobbyRepository: MatchLobbyRepository
  readonly now: () => string
}

export interface MatchLobbyDeckServices extends MatchLobbyAuthServices {
  readonly decksRepository: Pick<
    DeckToMatchRoomDeckRepository,
    'getDeckDetailById'
  > & {
    readonly listDecksByOwner?: (
      ownerProfileId: string,
    ) => Promise<RepositoryResult<readonly DeckListItemRecord[]>>
  }
}

export interface MatchLobbyStartServices
  extends
    MatchLobbyDeckServices,
    Omit<
      CreateTwoDeckMatchRoomServices,
      'profilesRepository' | 'decksRepository' | 'now'
    > {
  readonly profilesRepository: CreateTwoDeckMatchRoomServices['profilesRepository'] &
    MatchLobbyAuthServices['profilesRepository']
  readonly decksRepository: DeckToMatchRoomDeckRepository
  readonly catalogRepository: DeckToMatchRoomCatalogRepository
  readonly validationService: DeckToMatchRoomValidationService
  readonly idFactory: DeckToMatchRoomIdFactory
}

export async function sendMatchLobbyInviteUseCase(
  services: MatchLobbyAuthServices,
  command: {
    readonly authUserId: string
    readonly inviteeProfileId: string
    readonly formatId: typeof STANDARD_FORMAT_ID
  },
): Promise<MatchLobbyResult<{ readonly invite: MatchLobbyInviteRecord }>> {
  const currentProfile = await requireCurrentProfile(
    services,
    command.authUserId,
  )

  if (!currentProfile.ok) {
    return currentProfile
  }

  if (currentProfile.data.id === command.inviteeProfileId) {
    return lobbyError(
      'self-opponent',
      'Choose another player before sending a match invite.',
    )
  }

  const inviteeResult = await services.profilesRepository.getVisibleProfileById(
    command.inviteeProfileId,
  )

  if (!inviteeResult.ok) {
    return repositoryFailed(inviteeResult.error.message)
  }

  if (!inviteeResult.data) {
    return lobbyError(
      'opponent-unavailable',
      'Select a visible opponent profile before sending a match invite.',
    )
  }

  const created = await services.lobbyRepository.createInvite({
    requesterProfileId: currentProfile.data.id,
    inviteeProfileId: inviteeResult.data.id,
    formatId: command.formatId,
  })

  if (!created.ok) {
    return repositoryFailed(created.error.message)
  }

  return {
    ok: true,
    data: {
      invite: created.data,
    },
  }
}

export async function respondToMatchLobbyInviteUseCase(
  services: MatchLobbyAuthServices,
  command: {
    readonly authUserId: string
    readonly inviteId: string
    readonly response: 'accepted' | 'declined'
  },
): Promise<MatchLobbyResult<{ readonly invite: MatchLobbyInviteRecord }>> {
  const context = await requireLobbyParticipant(services, {
    authUserId: command.authUserId,
    inviteId: command.inviteId,
  })

  if (!context.ok) {
    return context
  }

  if (context.data.profile.id !== context.data.invite.inviteeProfileId) {
    return lobbyError(
      'invite-access-denied',
      'Only the invited player can accept or decline this invite.',
    )
  }

  if (context.data.invite.status !== 'pending') {
    return lobbyError(
      'invite-not-pending',
      'This invite has already been handled.',
    )
  }

  const updated = await services.lobbyRepository.updateInviteStatus({
    inviteId: command.inviteId,
    status: command.response,
    respondedAt: services.now(),
    updatedAt: services.now(),
  })

  if (!updated.ok) {
    return repositoryFailed(updated.error.message)
  }

  return {
    ok: true,
    data: {
      invite: updated.data,
    },
  }
}

export async function chooseMatchLobbyDeckUseCase(
  services: MatchLobbyDeckServices,
  command: {
    readonly authUserId: string
    readonly inviteId: string
    readonly deckId: string
  },
): Promise<MatchLobbyResult<{ readonly invite: MatchLobbyInviteRecord }>> {
  const context = await requireAcceptedLobbyParticipant(services, {
    authUserId: command.authUserId,
    inviteId: command.inviteId,
  })

  if (!context.ok) {
    return context
  }

  const deckCheck = await requireOwnedStandardDeck(services, {
    deckId: command.deckId,
    ownerProfileId: context.data.profile.id,
  })

  if (!deckCheck.ok) {
    return deckCheck
  }

  const updated = await services.lobbyRepository.setDeckSelection({
    inviteId: command.inviteId,
    profileId: context.data.profile.id,
    deckId: deckCheck.data.deck.id,
    updatedAt: services.now(),
  })

  if (!updated.ok) {
    return repositoryFailed(updated.error.message)
  }

  return {
    ok: true,
    data: {
      invite: updated.data,
    },
  }
}

export async function setMatchLobbyReadyUseCase(
  services: MatchLobbyDeckServices,
  command: {
    readonly authUserId: string
    readonly inviteId: string
    readonly ready: boolean
  },
): Promise<MatchLobbyResult<{ readonly invite: MatchLobbyInviteRecord }>> {
  const context = await requireAcceptedLobbyParticipant(services, {
    authUserId: command.authUserId,
    inviteId: command.inviteId,
  })

  if (!context.ok) {
    return context
  }

  const selectedDeckId =
    context.data.profile.id === context.data.invite.requesterProfileId
      ? context.data.invite.requesterDeckId
      : context.data.invite.inviteeDeckId

  if (!selectedDeckId) {
    return lobbyError(
      'deck-required',
      'Choose a valid saved deck before marking ready.',
    )
  }

  if (command.ready) {
    const deckCheck = await requireOwnedStandardDeck(services, {
      deckId: selectedDeckId,
      ownerProfileId: context.data.profile.id,
    })

    if (!deckCheck.ok) {
      return deckCheck
    }
  }

  const updated = await services.lobbyRepository.setReady({
    inviteId: command.inviteId,
    profileId: context.data.profile.id,
    ready: command.ready,
    updatedAt: services.now(),
  })

  if (!updated.ok) {
    return repositoryFailed(updated.error.message)
  }

  return {
    ok: true,
    data: {
      invite: updated.data,
    },
  }
}

export async function startMatchLobbyUseCase(
  services: MatchLobbyStartServices,
  command: {
    readonly authUserId: string
    readonly inviteId: string
  },
): Promise<
  MatchLobbyResult<{
    readonly roomId: string
    readonly invite: MatchLobbyInviteRecord
  }>
> {
  const context = await requireAcceptedLobbyParticipant(services, {
    authUserId: command.authUserId,
    inviteId: command.inviteId,
  })

  if (!context.ok) {
    return context
  }

  const invite = context.data.invite

  if (invite.startedRoomId) {
    return {
      ok: true,
      data: {
        roomId: invite.startedRoomId,
        invite,
      },
    }
  }

  if (!invite.requesterDeckId || !invite.inviteeDeckId) {
    return lobbyError(
      'deck-required',
      'Both players must choose saved Standard decks before match start.',
    )
  }

  if (!invite.requesterReady || !invite.inviteeReady) {
    return lobbyError(
      'not-ready',
      'Both players must be ready before match start.',
    )
  }

  const room = await createTwoDeckMatchRoomUseCase(
    {
      profilesRepository: services.profilesRepository,
      decksRepository: services.decksRepository,
      catalogRepository: services.catalogRepository,
      validationService: services.validationService,
      roomSessions: services.roomSessions,
      idFactory: services.idFactory,
      now: services.now,
    },
    {
      authUserId: command.authUserId,
      requesterProfileId: invite.requesterProfileId,
      requesterDeckId: invite.requesterDeckId,
      inviteeProfileId: invite.inviteeProfileId,
      inviteeDeckId: invite.inviteeDeckId,
    },
  )

  if (!room.ok) {
    return lobbyError('room-start-failed', room.error.message)
  }

  const updated = await services.lobbyRepository.markStarted({
    inviteId: command.inviteId,
    roomId: room.data.roomId,
    updatedAt: services.now(),
  })

  if (!updated.ok) {
    return repositoryFailed(updated.error.message)
  }

  return {
    ok: true,
    data: {
      roomId: room.data.roomId,
      invite: updated.data,
    },
  }
}

async function requireCurrentProfile(
  services: Pick<MatchLobbyAuthServices, 'profilesRepository'>,
  authUserId: string,
): Promise<
  MatchLobbyResult<{
    readonly id: string
    readonly displayName: string
  }>
> {
  const profileResult =
    await services.profilesRepository.getProfileByAuthUserId(authUserId)

  if (!profileResult.ok) {
    return repositoryFailed(profileResult.error.message)
  }

  if (!profileResult.data) {
    return lobbyError(
      'profile-required',
      'Create your profile before using match lobbies.',
    )
  }

  return {
    ok: true,
    data: profileResult.data,
  }
}

async function requireLobbyParticipant(
  services: MatchLobbyAuthServices,
  command: {
    readonly authUserId: string
    readonly inviteId: string
  },
): Promise<
  MatchLobbyResult<{
    readonly profile: { readonly id: string; readonly displayName: string }
    readonly invite: MatchLobbyInviteRecord
  }>
> {
  const profileResult = await requireCurrentProfile(
    services,
    command.authUserId,
  )

  if (!profileResult.ok) {
    return profileResult
  }

  const inviteResult = await services.lobbyRepository.getInviteById(
    command.inviteId,
  )

  if (!inviteResult.ok) {
    return repositoryFailed(inviteResult.error.message)
  }

  if (!inviteResult.data) {
    return lobbyError('invite-unavailable', 'This match invite is unavailable.')
  }

  if (
    inviteResult.data.requesterProfileId !== profileResult.data.id &&
    inviteResult.data.inviteeProfileId !== profileResult.data.id
  ) {
    return lobbyError(
      'invite-access-denied',
      'Only lobby participants can open this match lobby.',
    )
  }

  return {
    ok: true,
    data: {
      profile: profileResult.data,
      invite: inviteResult.data,
    },
  }
}

async function requireAcceptedLobbyParticipant(
  services: MatchLobbyAuthServices,
  command: {
    readonly authUserId: string
    readonly inviteId: string
  },
) {
  const context = await requireLobbyParticipant(services, command)

  if (!context.ok) {
    return context
  }

  if (context.data.invite.status === 'started') {
    return context
  }

  if (context.data.invite.status !== 'accepted') {
    return lobbyError(
      'lobby-not-accepted',
      'The invite must be accepted before deck selection or ready checks.',
    )
  }

  return context
}

async function requireOwnedStandardDeck(
  services: MatchLobbyDeckServices,
  input: {
    readonly deckId: string
    readonly ownerProfileId: string
  },
): Promise<MatchLobbyResult<{ readonly deck: DeckDetailRecord }>> {
  const deckResult = await services.decksRepository.getDeckDetailById(
    input.deckId,
  )

  if (!deckResult.ok) {
    return repositoryFailed(deckResult.error.message)
  }

  const deck = deckResult.data

  if (!deck || deck.ownerProfileId !== input.ownerProfileId) {
    return lobbyError('deck-unavailable', 'Choose one of your own saved decks.')
  }

  if (!deck.currentVersion) {
    return lobbyError(
      'deck-unavailable',
      'The selected deck needs a current saved version before it can be used.',
    )
  }

  if (deck.format.id !== STANDARD_FORMAT_ID) {
    return lobbyError(
      'deck-unavailable',
      'Only Standard decks can be used for this match lobby.',
    )
  }

  return {
    ok: true,
    data: {
      deck,
    },
  }
}

function lobbyError(
  code: MatchLobbyErrorCode,
  message: string,
): MatchLobbyResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}

function repositoryFailed(message: string): MatchLobbyResult<never> {
  return lobbyError('repository-failed', message)
}
