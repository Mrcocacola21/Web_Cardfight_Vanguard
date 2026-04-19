import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentProfileState: vi.fn(),
  listDecksByOwnerProfileId: vi.fn(),
}))

vi.mock('@/features/profiles/server/profile-read', () => ({
  getCurrentProfileState: mocks.getCurrentProfileState,
}))

vi.mock('@/features/decks/server/deck-read', () => ({
  listDecksByOwnerProfileId: mocks.listDecksByOwnerProfileId,
}))

import { getManualMatchEntryPageState } from './manual-match-entry-read'

describe('getManualMatchEntryPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentProfileState.mockResolvedValue({
      kind: 'ready',
      authUser: {
        id: 'auth-user-1',
        email: 'pilot@example.com',
      },
      profile: {
        id: 'profile-1',
        displayName: 'Azure Pilot',
      },
    })
    mocks.listDecksByOwnerProfileId.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'deck-1',
          title: 'Keter Ride Line',
          format: {
            displayName: 'Standard',
          },
          currentVersionId: 'deck-version-1',
          currentVersionNumber: 3,
          updatedAt: '2026-04-18T10:00:00.000Z',
        },
      ],
    })
  })

  it('returns ready state with owner deck options', async () => {
    const result = await getManualMatchEntryPageState()

    expect(result.kind).toBe('ready')

    if (result.kind !== 'ready') {
      throw new Error('Expected ready state.')
    }

    expect(result.viewerDisplayName).toBe('Azure Pilot')
    expect(result.deckOptions).toEqual([
      {
        id: 'deck-1',
        title: 'Keter Ride Line',
        formatDisplayName: 'Standard',
        currentVersionId: 'deck-version-1',
        currentVersionNumber: 3,
        updatedAt: '2026-04-18T10:00:00.000Z',
      },
    ])
  })

  it('returns decks-unavailable when the owner has no selectable decks', async () => {
    mocks.listDecksByOwnerProfileId.mockResolvedValueOnce({
      ok: true,
      data: [],
    })

    const result = await getManualMatchEntryPageState()

    expect(result).toEqual({
      kind: 'decks-unavailable',
    })
  })

  it('returns an auth error when the viewer is signed out', async () => {
    mocks.getCurrentProfileState.mockResolvedValueOnce({
      kind: 'signed-out',
    })

    const result = await getManualMatchEntryPageState()

    expect(result).toEqual({
      kind: 'error',
      message: 'Manual match entry requires an authenticated session.',
    })
    expect(mocks.listDecksByOwnerProfileId).not.toHaveBeenCalled()
  })
})
