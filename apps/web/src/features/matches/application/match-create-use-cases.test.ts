import { describe, expect, it, vi } from 'vitest'

import { createMatchRecordUseCase } from './match-create-use-cases'
import type { MatchCreateApplicationServices } from './match-create-application-support'

describe('createMatchRecordUseCase', () => {
  it('creates a manual owner-owned match record from a deck and visible opponent', async () => {
    const services = createServices({
      decksRepository: {
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            id: 'deck-1',
            ownerProfileId: 'profile-owner',
            formatId: 'standard',
            title: 'Keter Ride Line',
            description: null,
            tags: [],
            isFavorite: false,
            visibility: 'private',
            archivedAt: null,
            createdAt: '2026-04-18T10:00:00.000Z',
            updatedAt: '2026-04-18T10:00:00.000Z',
            currentVersion: {
              id: 'deck-version-1',
              deckId: 'deck-1',
              versionNumber: 3,
              createdByProfileId: 'profile-owner',
              versionNote: null,
              createdAt: '2026-04-18T10:00:00.000Z',
              cards: [],
            },
          },
        }),
      },
      profilesRepository: {
        getVisibleProfileById: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            id: 'profile-opponent',
            displayName: 'Azure Rival',
            avatarUrl: null,
            bio: null,
            visibility: 'public',
            bioVisibility: 'public',
            bioVisible: false,
          },
        }),
      },
      matchHistoryRepository: {
        getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
          ok: true,
          data: 'profile-owner',
        }),
        createMatchRecord: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            id: 'match-1',
          },
        }),
      },
    })

    const result = await createMatchRecordUseCase(services, {
      authUserId: 'auth-user-1',
      deckId: 'deck-1',
      opponentProfileId: 'profile-opponent',
      result: 'win',
      playedAt: '2026-04-18T00:00:00.000Z',
      notes: 'Local round 2.',
    })

    expect(
      services.matchHistoryRepository.createMatchRecord,
    ).toHaveBeenCalledWith({
      ownerProfileId: 'profile-owner',
      formatId: 'standard',
      playedAt: '2026-04-18T00:00:00.000Z',
      visibility: 'private',
      status: 'completed',
      source: 'manual',
      notes: 'Local round 2.',
      participants: [
        {
          profileId: 'profile-owner',
          deckVersionId: 'deck-version-1',
          result: 'win',
          seatOrder: 1,
        },
        {
          profileId: 'profile-opponent',
          result: 'loss',
          seatOrder: 2,
        },
      ],
    })
    expect(result).toEqual({
      ok: true,
      data: {
        matchId: 'match-1',
        ownerProfileId: 'profile-owner',
        opponentProfileId: 'profile-opponent',
      },
    })
  })

  it('blocks foreign deck selection even if the deck exists', async () => {
    const services = createServices({
      decksRepository: {
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            id: 'deck-2',
            ownerProfileId: 'profile-other',
            formatId: 'standard',
            title: 'Other deck',
            description: null,
            tags: [],
            isFavorite: false,
            visibility: 'private',
            archivedAt: null,
            createdAt: '2026-04-18T10:00:00.000Z',
            updatedAt: '2026-04-18T10:00:00.000Z',
            currentVersion: {
              id: 'deck-version-2',
              deckId: 'deck-2',
              versionNumber: 1,
              createdByProfileId: 'profile-other',
              versionNote: null,
              createdAt: '2026-04-18T10:00:00.000Z',
              cards: [],
            },
          },
        }),
      },
    })

    const result = await createMatchRecordUseCase(services, {
      authUserId: 'auth-user-1',
      deckId: 'deck-2',
      opponentProfileId: 'profile-opponent',
      result: 'loss',
      playedAt: '2026-04-18T00:00:00.000Z',
      notes: null,
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'deck-unavailable',
        message: 'Choose one of your own saved decks before recording a match.',
      },
    })
    expect(
      services.matchHistoryRepository.createMatchRecord,
    ).not.toHaveBeenCalled()
  })

  it('blocks opponents that are not visible through the current profile surface', async () => {
    const services = createServices({
      profilesRepository: {
        getVisibleProfileById: vi.fn().mockResolvedValue({
          ok: true,
          data: null,
        }),
      },
    })

    const result = await createMatchRecordUseCase(services, {
      authUserId: 'auth-user-1',
      deckId: 'deck-1',
      opponentProfileId: 'profile-hidden',
      result: 'draw',
      playedAt: '2026-04-18T00:00:00.000Z',
      notes: null,
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'opponent-unavailable',
        message: 'Select a visible opponent profile before recording a match.',
      },
    })
  })

  it('blocks self-opponent selections', async () => {
    const services = createServices()

    const result = await createMatchRecordUseCase(services, {
      authUserId: 'auth-user-1',
      deckId: 'deck-1',
      opponentProfileId: 'profile-owner',
      result: 'win',
      playedAt: '2026-04-18T00:00:00.000Z',
      notes: null,
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'self-opponent',
        message: 'You cannot record yourself as the opponent.',
      },
    })
  })
})

function createServices(
  overrides: Partial<MatchCreateApplicationServices> = {},
): MatchCreateApplicationServices {
  return {
    matchHistoryRepository: {
      getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: 'profile-owner',
      }),
      createMatchRecord: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'match-default',
        },
      }),
      ...overrides.matchHistoryRepository,
    },
    decksRepository: {
      getDeckById: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'deck-1',
          ownerProfileId: 'profile-owner',
          formatId: 'standard',
          title: 'Keter Ride Line',
          description: null,
          tags: [],
          isFavorite: false,
          visibility: 'private',
          archivedAt: null,
          createdAt: '2026-04-18T10:00:00.000Z',
          updatedAt: '2026-04-18T10:00:00.000Z',
          currentVersion: {
            id: 'deck-version-1',
            deckId: 'deck-1',
            versionNumber: 1,
            createdByProfileId: 'profile-owner',
            versionNote: null,
            createdAt: '2026-04-18T10:00:00.000Z',
            cards: [],
          },
        },
      }),
      ...overrides.decksRepository,
    },
    profilesRepository: {
      getVisibleProfileById: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'profile-opponent',
          displayName: 'Azure Rival',
          avatarUrl: null,
          bio: null,
          visibility: 'public',
          bioVisibility: 'public',
          bioVisible: false,
        },
      }),
      ...overrides.profilesRepository,
    },
  }
}
