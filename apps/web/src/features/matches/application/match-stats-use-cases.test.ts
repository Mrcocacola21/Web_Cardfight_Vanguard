import { describe, expect, it, vi } from 'vitest'

import { getMatchStatsViewUseCase } from './match-stats-use-cases'
import type { MatchHistoryApplicationServices } from './match-history-application-support'

describe('getMatchStatsViewUseCase', () => {
  it('counts tracked owner matches and calculates winrate from completed win/loss/draw results', async () => {
    const { services, listAllMatchHistoryItemsByOwner } = createServices([
      createMatchItem({
        id: 'match-win',
        result: 'win',
        status: 'completed',
        ownDeck: {
          deckId: 'deck-1',
          title: 'Keter Balance',
          versionNumber: 3,
        },
      }),
      createMatchItem({
        id: 'match-loss',
        result: 'loss',
        status: 'completed',
        ownDeck: {
          deckId: 'deck-1',
          title: 'Keter Balance',
          versionNumber: 4,
        },
      }),
      createMatchItem({
        id: 'match-draw',
        result: 'draw',
        status: 'completed',
        ownDeck: {
          deckId: 'deck-2',
          title: 'Dragon Empire Rush',
          versionNumber: 1,
        },
      }),
      createMatchItem({
        id: 'match-recorded',
        result: 'win',
        status: 'recorded',
      }),
      createMatchItem({
        id: 'match-unknown',
        result: 'unknown',
        status: 'completed',
      }),
    ])

    const result = await getMatchStatsViewUseCase(services, {
      ownerProfileId: 'profile-owner',
    })

    expect(listAllMatchHistoryItemsByOwner).toHaveBeenCalledWith(
      'profile-owner',
    )
    expect(result).toEqual({
      ok: true,
      data: {
        totalMatches: 3,
        wins: 1,
        losses: 1,
        draws: 1,
        winRate: 1 / 3,
        topDecks: [
          {
            deckId: 'deck-1',
            label: 'Keter Balance',
            matchCount: 2,
          },
          {
            deckId: 'deck-2',
            label: 'Dragon Empire Rush',
            matchCount: 1,
          },
        ],
      },
    })
  })

  it('groups stale or missing deck links into an unavailable deck bucket', async () => {
    const { services } = createServices([
      createMatchItem({
        id: 'match-missing-deck-1',
        ownDeck: {
          deckId: null,
          title: null,
          versionNumber: null,
        },
      }),
      createMatchItem({
        id: 'match-missing-deck-2',
        ownDeck: {
          deckId: null,
          title: null,
          versionNumber: 3,
        },
      }),
    ])

    const result = await getMatchStatsViewUseCase(services, {
      ownerProfileId: 'profile-owner',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        totalMatches: 2,
        wins: 2,
        losses: 0,
        draws: 0,
        winRate: 1,
        topDecks: [
          {
            deckId: null,
            label: 'Unavailable deck',
            matchCount: 2,
          },
        ],
      },
    })
  })

  it('returns an empty stats model when no tracked completed matches exist yet', async () => {
    const { services } = createServices([
      createMatchItem({
        id: 'match-recorded',
        result: 'unknown',
        status: 'recorded',
      }),
    ])

    const result = await getMatchStatsViewUseCase(services, {
      ownerProfileId: 'profile-owner',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: null,
        topDecks: [],
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
          data: [],
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
    status: 'recorded' | 'completed' | 'voided'
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
    status: overrides.status ?? 'completed',
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
