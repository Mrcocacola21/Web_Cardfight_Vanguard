import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import type {
  MatchLobbyInviteRecord,
  MatchLobbyRepository,
} from '@web-vg/db/repositories/matches'
import type {
  ProfileRecord,
  VisibleProfileRecord,
} from '@web-vg/db/repositories/profiles'
import { STANDARD_FORMAT_ID } from '@web-vg/rules-core'
import { describe, expect, it } from 'vitest'

import type {
  MatchLobbyDeckServices,
  MatchLobbyStartServices,
} from './match-lobby-use-cases'
import {
  chooseMatchLobbyDeckUseCase,
  setMatchLobbyReadyUseCase,
  startMatchLobbyUseCase,
} from './match-lobby-use-cases'

type SetDeckSelectionInput = Parameters<
  MatchLobbyRepository['setDeckSelection']
>[0]
type SetReadyInput = Parameters<MatchLobbyRepository['setReady']>[0]
type MarkStartedInput = Parameters<MatchLobbyRepository['markStarted']>[0]

interface FakeMatchLobbyRepository extends MatchLobbyRepository {
  readonly calls: {
    readonly setDeckSelection: SetDeckSelectionInput[]
    readonly setReady: SetReadyInput[]
    readonly markStarted: MarkStartedInput[]
  }
}

interface FakeDeckServices extends MatchLobbyDeckServices {
  readonly lobbyRepository: FakeMatchLobbyRepository
}

interface FakeStartServices extends MatchLobbyStartServices {
  readonly lobbyRepository: FakeMatchLobbyRepository
}

describe('match lobby use cases', () => {
  it('blocks deck selection until the invite is accepted', async () => {
    const services = createDeckServices({
      invite: createInvite({ status: 'pending' }),
    })

    const result = await chooseMatchLobbyDeckUseCase(services, {
      authUserId: 'auth-requester',
      inviteId: 'invite-1',
      deckId: 'deck-requester',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'lobby-not-accepted',
        message:
          'The invite must be accepted before deck selection or ready checks.',
      },
    })
    expect(services.lobbyRepository.calls.setDeckSelection).toHaveLength(0)
  })

  it('persists an accepted participant deck selection and clears ready state', async () => {
    const invite = createInvite({
      status: 'accepted',
      requesterReady: true,
    })
    const services = createDeckServices({ invite })

    const result = await chooseMatchLobbyDeckUseCase(services, {
      authUserId: 'auth-requester',
      inviteId: invite.id,
      deckId: 'deck-requester',
    })

    expect(result.ok).toBe(true)
    expect(services.lobbyRepository.calls.setDeckSelection).toEqual([
      {
        inviteId: invite.id,
        profileId: invite.requesterProfileId,
        deckId: 'deck-requester',
        updatedAt: '2026-06-18T12:00:00.000Z',
      },
    ])
  })

  it('requires a selected deck before marking ready', async () => {
    const services = createDeckServices({
      invite: createInvite({ status: 'accepted', requesterDeckId: null }),
    })

    const result = await setMatchLobbyReadyUseCase(services, {
      authUserId: 'auth-requester',
      inviteId: 'invite-1',
      ready: true,
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'deck-required',
        message: 'Choose a valid saved deck before marking ready.',
      },
    })
    expect(services.lobbyRepository.calls.setReady).toHaveLength(0)
  })

  it('blocks match start until both decks and both ready flags are complete', async () => {
    const services = createStartServices({
      invite: createInvite({
        status: 'accepted',
        requesterDeckId: 'deck-requester',
        inviteeDeckId: 'deck-invitee',
        requesterReady: true,
        inviteeReady: false,
      }),
    })

    const result = await startMatchLobbyUseCase(services, {
      authUserId: 'auth-requester',
      inviteId: 'invite-1',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'not-ready',
        message: 'Both players must be ready before match start.',
      },
    })
    expect(services.lobbyRepository.calls.markStarted).toHaveLength(0)
  })
})

function createDeckServices(input: {
  readonly invite: MatchLobbyInviteRecord
}): FakeDeckServices {
  const lobbyRepository = createLobbyRepository(input.invite)

  return {
    profilesRepository: {
      getProfileByAuthUserId: () =>
        Promise.resolve(
          ok(createProfile(input.invite.requesterProfileId, 'Requester')),
        ),
      getVisibleProfileById: (id: string) =>
        Promise.resolve(ok(createVisibleProfile(id, 'Opponent'))),
    },
    decksRepository: {
      getDeckDetailById: (deckId: string) =>
        Promise.resolve(
          ok(createDeck(deckId, input.invite.requesterProfileId)),
        ),
    },
    lobbyRepository,
    now: () => '2026-06-18T12:00:00.000Z',
  }
}

function createStartServices(input: {
  readonly invite: MatchLobbyInviteRecord
}): FakeStartServices {
  return {
    ...createDeckServices(input),
    profilesRepository: {
      getProfileByAuthUserId: () =>
        Promise.resolve(
          ok(createProfile(input.invite.requesterProfileId, 'Requester')),
        ),
      getProfileById: (id: string) =>
        Promise.resolve(
          ok(
            createProfile(
              id,
              id === input.invite.requesterProfileId ? 'Requester' : 'Invitee',
            ),
          ),
        ),
      getVisibleProfileById: (id: string) =>
        Promise.resolve(ok(createVisibleProfile(id, 'Opponent'))),
    },
    catalogRepository: {
      getCardEntityById: () => {
        throw new Error('catalogRepository should not be called in this test')
      },
    },
    validationService: {
      validateDeck: () => {
        throw new Error('validationService should not be called in this test')
      },
    },
    roomSessions: {
      createPersistedRoom: () => {
        throw new Error('roomSessions should not be called in this test')
      },
    },
    idFactory: {
      createRoomId: () => {
        throw new Error('idFactory should not be called in this test')
      },
      createParticipantId: () => {
        throw new Error('idFactory should not be called in this test')
      },
      createPlayerId: () => {
        throw new Error('idFactory should not be called in this test')
      },
      createActionId: () => {
        throw new Error('idFactory should not be called in this test')
      },
    },
  } as unknown as FakeStartServices
}

function createLobbyRepository(
  invite: MatchLobbyInviteRecord,
): FakeMatchLobbyRepository {
  const calls: FakeMatchLobbyRepository['calls'] = {
    setDeckSelection: [],
    setReady: [],
    markStarted: [],
  }

  return {
    calls,
    createInvite: () => {
      throw new Error('createInvite should not be called in this test')
    },
    getInviteById: () => Promise.resolve(ok(invite)),
    listInvitesForProfile: () => {
      throw new Error('listInvitesForProfile should not be called in this test')
    },
    updateInviteStatus: () => {
      throw new Error('updateInviteStatus should not be called in this test')
    },
    setDeckSelection: (selection) => {
      calls.setDeckSelection.push(selection)

      return Promise.resolve(
        ok({
          ...invite,
          requesterDeckId: selection.deckId,
          requesterReady: false,
        }),
      )
    },
    setReady: (readyState) => {
      calls.setReady.push(readyState)

      return Promise.resolve(
        ok({
          ...invite,
          requesterReady: readyState.ready,
        }),
      )
    },
    markStarted: (started) => {
      calls.markStarted.push(started)

      return Promise.resolve(
        ok({
          ...invite,
          status: 'started',
          startedRoomId: started.roomId,
          updatedAt: started.updatedAt,
        }),
      )
    },
  }
}

function createInvite(
  overrides: Partial<MatchLobbyInviteRecord> = {},
): MatchLobbyInviteRecord {
  return {
    id: 'invite-1',
    requesterProfileId: 'profile-requester',
    inviteeProfileId: 'profile-invitee',
    formatId: STANDARD_FORMAT_ID,
    status: 'pending',
    requesterDeckId: null,
    inviteeDeckId: null,
    requesterReady: false,
    inviteeReady: false,
    startedRoomId: null,
    createdAt: '2026-06-18T12:00:00.000Z',
    respondedAt: null,
    updatedAt: '2026-06-18T12:00:00.000Z',
    ...overrides,
  }
}

function createDeck(deckId: string, ownerProfileId: string): DeckDetailRecord {
  return {
    id: deckId,
    ownerProfileId,
    title: 'Requester Standard',
    description: null,
    tags: [],
    isFavorite: false,
    visibility: 'private',
    archivedAt: null,
    createdAt: '2026-06-18T12:00:00.000Z',
    updatedAt: '2026-06-18T12:00:00.000Z',
    format: {
      id: STANDARD_FORMAT_ID,
      displayName: 'Standard',
      description: null,
    },
    currentVersionId: `${deckId}:version`,
    currentVersion: {
      id: `${deckId}:version`,
      deckId,
      versionNumber: 1,
      createdByProfileId: ownerProfileId,
      versionNote: null,
      createdAt: '2026-06-18T12:00:00.000Z',
      totalCards: 50,
      sectionCounts: {
        main: 46,
        ride: 4,
        g: 0,
      },
      cards: [],
      sections: [],
    },
  }
}

function createProfile(id: string, displayName: string): ProfileRecord {
  return {
    id,
    username: null,
    displayName,
    bio: null,
    avatarUrl: null,
    visibility: 'public',
    bioVisibility: 'public',
    createdAt: '2026-06-18T12:00:00.000Z',
    updatedAt: '2026-06-18T12:00:00.000Z',
  }
}

function createVisibleProfile(
  id: string,
  displayName: string,
): VisibleProfileRecord {
  return {
    id,
    displayName,
    avatarUrl: null,
    bio: null,
    visibility: 'public',
    bioVisibility: 'public',
    bioVisible: true,
  }
}

function ok<TData>(data: TData) {
  return {
    ok: true,
    data,
  } as const
}
