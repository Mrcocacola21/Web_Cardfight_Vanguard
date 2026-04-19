import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MatchEntryActionsModule from '@/features/matches/server/match-entry-actions'

const mocks = vi.hoisted(() => ({
  createManualMatchEntryAction: vi.fn(),
  searchMatchOpponentProfilesAction: vi.fn(),
}))

vi.mock('@/features/matches/server/match-entry-actions', async () => {
  const actual = await vi.importActual<typeof MatchEntryActionsModule>(
    '@/features/matches/server/match-entry-actions',
  )

  return {
    ...actual,
    createManualMatchEntryAction: mocks.createManualMatchEntryAction,
    searchMatchOpponentProfilesAction: mocks.searchMatchOpponentProfilesAction,
  }
})

import { ManualMatchEntryView } from './manual-match-entry-view'

describe('ManualMatchEntryView', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createManualMatchEntryAction.mockResolvedValue({
      status: 'success',
      message: 'Match recorded.',
      fieldErrors: {},
      createdMatchId: 'match-1',
    })
    mocks.searchMatchOpponentProfilesAction.mockResolvedValue({
      kind: 'ready',
      query: 'Azure',
      results: [
        {
          id: 'profile-opponent',
          displayName: 'Azure Rival',
          avatarUrl: null,
          bio: 'Visible profile bio.',
          visibility: 'public',
          bioVisibility: 'public',
          bioVisible: true,
        },
      ],
    })
  })

  it('renders deck, opponent, result, date, and notes controls', () => {
    render(
      <ManualMatchEntryView
        viewerDisplayName="Azure Pilot"
        deckOptions={[
          {
            id: 'deck-1',
            title: 'Keter Ride Line',
            formatDisplayName: 'Standard',
            currentVersionId: 'deck-version-1',
            currentVersionNumber: 2,
            updatedAt: '2026-04-18T10:00:00.000Z',
          },
        ]}
        defaultPlayedOn="2026-04-18"
      />,
    )

    expect(screen.getByLabelText(/deck/i)).toBeInTheDocument()
    expect(
      screen.getByLabelText(/search opponent profiles/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/result/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/played date/i)).toHaveValue('2026-04-18')
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /save match/i }),
    ).toBeInTheDocument()
  })

  it('lets the user search and select an opponent profile', async () => {
    render(
      <ManualMatchEntryView
        viewerDisplayName="Azure Pilot"
        deckOptions={[
          {
            id: 'deck-1',
            title: 'Keter Ride Line',
            formatDisplayName: 'Standard',
            currentVersionId: 'deck-version-1',
            currentVersionNumber: 2,
            updatedAt: '2026-04-18T10:00:00.000Z',
          },
        ]}
        defaultPlayedOn="2026-04-18"
      />,
    )

    fireEvent.change(screen.getByLabelText(/search opponent profiles/i), {
      target: {
        value: 'Azure',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => {
      expect(screen.getByText('Azure Rival')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))

    expect(screen.getByDisplayValue('profile-opponent')).toBeInTheDocument()
    expect(screen.getAllByText('Azure Rival').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('shows success feedback after saving a match', async () => {
    render(
      <ManualMatchEntryView
        viewerDisplayName="Azure Pilot"
        deckOptions={[
          {
            id: 'deck-1',
            title: 'Keter Ride Line',
            formatDisplayName: 'Standard',
            currentVersionId: 'deck-version-1',
            currentVersionNumber: 2,
            updatedAt: '2026-04-18T10:00:00.000Z',
          },
        ]}
        defaultPlayedOn="2026-04-18"
      />,
    )

    fireEvent.change(screen.getByLabelText(/deck/i), {
      target: {
        value: 'deck-1',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /save match/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/match recorded/i)
    })
  })

  it('shows returned validation feedback from the create action', async () => {
    mocks.createManualMatchEntryAction.mockResolvedValueOnce({
      status: 'error',
      message: 'Match entry is incomplete or invalid.',
      fieldErrors: {
        opponentProfileId: 'Select an opponent profile.',
      },
      createdMatchId: null,
    })

    render(
      <ManualMatchEntryView
        viewerDisplayName="Azure Pilot"
        deckOptions={[
          {
            id: 'deck-1',
            title: 'Keter Ride Line',
            formatDisplayName: 'Standard',
            currentVersionId: 'deck-version-1',
            currentVersionNumber: 2,
            updatedAt: '2026-04-18T10:00:00.000Z',
          },
        ]}
        defaultPlayedOn="2026-04-18"
      />,
    )

    fireEvent.change(screen.getByLabelText(/deck/i), {
      target: {
        value: 'deck-1',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: /save match/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/select an opponent profile/i),
      ).toBeInTheDocument()
    })
  })
})
