import { describe, expect, it, vi } from 'vitest'

import {
  resolveMatchHistoryOwnerProfile,
  resolveOwnedMatchRecord,
} from './match-history-application-support'
import type { MatchHistoryApplicationServices } from './match-history-application-support'

describe('match history application support', () => {
  it('resolves the current owner profile id from the auth identity', async () => {
    const services = createServices({
      getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: 'profile-owner',
      }),
    })

    const result = await resolveMatchHistoryOwnerProfile(
      services,
      'auth-user-1',
    )

    expect(result).toEqual({
      ok: true,
      data: 'profile-owner',
    })
  })

  it('requires a persisted profile before match-history actions can proceed', async () => {
    const services = createServices({
      getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: null,
      }),
    })

    const result = await resolveMatchHistoryOwnerProfile(
      services,
      'auth-user-2',
    )

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'profile-required',
        message:
          'A persisted profile row is required before match-history actions can run.',
      },
    })
  })

  it('resolves an owned match record for the same owner profile', async () => {
    const services = createServices({
      getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: 'profile-owner',
      }),
      getMatchRecordById: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'match-1',
          ownerProfileId: 'profile-owner',
          formatId: 'standard',
          visibility: 'private',
          status: 'completed',
          source: 'manual',
          playedAt: '2026-04-18T10:00:00.000Z',
          notes: null,
          createdAt: '2026-04-18T10:10:00.000Z',
          updatedAt: '2026-04-18T10:10:00.000Z',
          participants: [],
        },
      }),
    })

    const result = await resolveOwnedMatchRecord(services, {
      authUserId: 'auth-user-1',
      matchId: 'match-1',
      forbiddenMessage: 'The current profile cannot manage this match record.',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        ownerProfileId: 'profile-owner',
        matchRecord: {
          id: 'match-1',
          ownerProfileId: 'profile-owner',
          formatId: 'standard',
          visibility: 'private',
          status: 'completed',
          source: 'manual',
          playedAt: '2026-04-18T10:00:00.000Z',
          notes: null,
          createdAt: '2026-04-18T10:10:00.000Z',
          updatedAt: '2026-04-18T10:10:00.000Z',
          participants: [],
        },
      },
    })
  })

  it('blocks access when the stored match belongs to another owner profile', async () => {
    const services = createServices({
      getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: 'profile-owner',
      }),
      getMatchRecordById: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'match-2',
          ownerProfileId: 'profile-other',
          formatId: 'standard',
          visibility: 'private',
          status: 'completed',
          source: 'manual',
          playedAt: '2026-04-18T10:00:00.000Z',
          notes: null,
          createdAt: '2026-04-18T10:10:00.000Z',
          updatedAt: '2026-04-18T10:10:00.000Z',
          participants: [],
        },
      }),
    })

    const result = await resolveOwnedMatchRecord(services, {
      authUserId: 'auth-user-1',
      matchId: 'match-2',
      forbiddenMessage: 'The current profile cannot manage this match record.',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'forbidden',
        message: 'The current profile cannot manage this match record.',
      },
    })
  })
})

function createServices(
  overrides: Partial<MatchHistoryApplicationServices['repository']> = {},
): MatchHistoryApplicationServices {
  return {
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
      listAllMatchHistoryItemsByOwner: vi.fn().mockResolvedValue({
        ok: true,
        data: [],
      }),
      createMatchRecord: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'match-default',
        },
      }),
      ...overrides,
    },
  }
}
