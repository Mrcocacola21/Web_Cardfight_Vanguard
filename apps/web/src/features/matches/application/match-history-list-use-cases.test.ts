import { describe, expect, it, vi } from 'vitest'

import { listMatchHistoryViewUseCase } from './match-history-list-use-cases'
import type { MatchHistoryApplicationServices } from './match-history-application-support'

describe('listMatchHistoryViewUseCase', () => {
  it('returns owner-scoped matches ordered by newest played date first', async () => {
    const { services, listAllMatchHistoryItemsByOwner } = createServices([
      createMatchItem({
        id: 'match-older',
        playedAt: '2026-04-17T10:00:00.000Z',
        createdAt: '2026-04-17T10:05:00.000Z',
      }),
      createMatchItem({
        id: 'match-newer',
        playedAt: '2026-04-18T10:00:00.000Z',
        createdAt: '2026-04-18T10:05:00.000Z',
      }),
    ])

    const result = await listMatchHistoryViewUseCase(services, {
      ownerProfileId: 'profile-owner',
      query: {
        result: 'all',
        deckId: null,
        opponent: '',
        formatId: 'all',
        playedFrom: null,
        playedTo: null,
      },
    })

    expect(listAllMatchHistoryItemsByOwner).toHaveBeenCalledWith(
      'profile-owner',
    )
    expect(result).toEqual({
      ok: true,
      data: {
        totalMatchCount: 2,
        matches: [
          expect.objectContaining({
            id: 'match-newer',
          }),
          expect.objectContaining({
            id: 'match-older',
          }),
        ],
        availableDecks: [
          {
            deckId: 'deck-1',
            label: 'Keter Balance',
          },
        ],
      },
    })
  })

  it('applies result, deck, opponent, format, and date filters together', async () => {
    const { services } = createServices([
      createMatchItem({
        id: 'match-keep',
        result: 'win',
        formatId: 'standard',
        playedAt: '2026-04-18T10:00:00.000Z',
        ownDeck: {
          deckId: 'deck-azure',
          title: 'Azure Vanguard',
          versionNumber: 2,
        },
        opponent: {
          profileId: 'profile-rival',
          displayName: 'Majesty Rival',
          avatarUrl: null,
          bio: null,
          profileVisible: true,
        },
      }),
      createMatchItem({
        id: 'match-other-result',
        result: 'loss',
      }),
      createMatchItem({
        id: 'match-other-deck',
        ownDeck: {
          deckId: 'deck-other',
          title: 'Other Deck',
          versionNumber: 1,
        },
      }),
      createMatchItem({
        id: 'match-other-opponent',
        opponent: {
          profileId: 'profile-other',
          displayName: 'Different Player',
          avatarUrl: null,
          bio: null,
          profileVisible: true,
        },
      }),
      createMatchItem({
        id: 'match-other-date',
        playedAt: '2026-03-18T10:00:00.000Z',
      }),
    ])

    const result = await listMatchHistoryViewUseCase(services, {
      ownerProfileId: 'profile-owner',
      query: {
        result: 'win',
        deckId: 'deck-azure',
        opponent: 'majesty',
        formatId: 'standard',
        playedFrom: '2026-04-01',
        playedTo: '2026-04-30',
      },
    })

    expect(result).toEqual({
      ok: true,
      data: {
        totalMatchCount: 5,
        matches: [
          expect.objectContaining({
            id: 'match-keep',
          }),
        ],
        availableDecks: [
          {
            deckId: 'deck-azure',
            label: 'Azure Vanguard',
          },
          {
            deckId: 'deck-1',
            label: 'Keter Balance',
          },
          {
            deckId: 'deck-other',
            label: 'Other Deck',
          },
        ],
      },
    })
  })

  it('keeps hidden or deleted linked data from breaking the list view projection', async () => {
    const { services } = createServices([
      createMatchItem({
        id: 'match-hidden-opponent',
        ownDeck: {
          deckId: null,
          title: null,
          versionNumber: null,
        },
        opponent: {
          profileId: null,
          displayName: null,
          avatarUrl: null,
          bio: null,
          profileVisible: false,
        },
      }),
    ])

    const result = await listMatchHistoryViewUseCase(services, {
      ownerProfileId: 'profile-owner',
      query: {
        result: 'all',
        deckId: null,
        opponent: '',
        formatId: 'all',
        playedFrom: null,
        playedTo: null,
      },
    })

    expect(result).toEqual({
      ok: true,
      data: {
        totalMatchCount: 1,
        matches: [
          expect.objectContaining({
            id: 'match-hidden-opponent',
            ownDeck: {
              deckId: null,
              title: null,
              versionNumber: null,
            },
            opponent: {
              profileId: null,
              displayName: null,
              avatarUrl: null,
              bio: null,
              profileVisible: false,
            },
          }),
        ],
        availableDecks: [],
      },
    })
  })
})

function createServices(
  matches: readonly ReturnType<typeof createMatchItem>[],
) {
  const listAllMatchHistoryItemsByOwner = vi.fn().mockResolvedValue({
    ok: true,
    data: matches,
  })

  return {
    services: {
      repository: {
        getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
          ok: true,
          data: 'profile-owner',
        }),
        getMatchRecordById: vi.fn().mockResolvedValue({
          ok: true,
          data: null,
        }),
        listMatchRecordsByOwner: vi.fn().mockResolvedValue({
          ok: true,
          data: [],
        }),
        listMatchHistoryItemsByOwner: vi.fn().mockResolvedValue({
          ok: true,
          data: matches,
        }),
        listAllMatchHistoryItemsByOwner,
        createMatchRecord: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            id: 'match-created',
          },
        }),
      } satisfies MatchHistoryApplicationServices['repository'],
    } satisfies MatchHistoryApplicationServices,
    listAllMatchHistoryItemsByOwner,
  }
}

function createMatchItem(
  overrides: Partial<{
    id: string
    formatId: string
    playedAt: string
    createdAt: string
    result: 'win' | 'loss' | 'draw' | 'unknown'
    notes: string | null
    ownDeck: {
      deckId: string | null
      title: string | null
      versionNumber: number | null
    }
    opponent: {
      profileId: string | null
      displayName: string | null
      avatarUrl: string | null
      bio: string | null
      profileVisible: boolean
    }
  }> = {},
) {
  return {
    id: overrides.id ?? 'match-1',
    formatId: overrides.formatId ?? 'standard',
    status: 'completed',
    playedAt: overrides.playedAt ?? '2026-04-18T10:00:00.000Z',
    createdAt: overrides.createdAt ?? '2026-04-18T10:05:00.000Z',
    result: overrides.result ?? 'win',
    notes: overrides.notes ?? null,
    ownDeck: overrides.ownDeck ?? {
      deckId: 'deck-1',
      title: 'Keter Balance',
      versionNumber: 3,
    },
    opponent: overrides.opponent ?? {
      profileId: 'profile-opponent',
      displayName: 'Azure Rival',
      avatarUrl: null,
      bio: null,
      profileVisible: true,
    },
  }
}
