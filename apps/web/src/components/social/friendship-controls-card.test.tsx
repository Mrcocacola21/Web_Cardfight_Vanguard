import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FriendshipActionsModule from '@/features/social/server/friendship-actions'

const mocks = vi.hoisted(() => ({
  removeFriendAction: vi.fn(),
}))

vi.mock('@/features/social/server/friendship-actions', async () => {
  const actual = await vi.importActual<typeof FriendshipActionsModule>(
    '@/features/social/server/friendship-actions',
  )

  return {
    ...actual,
    removeFriendAction: mocks.removeFriendAction,
  }
})

import { FriendshipControlsCard } from './friendship-controls-card'

describe('FriendshipControlsCard', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.removeFriendAction.mockResolvedValue({
      status: 'success',
      code: 'removed',
      message: 'Friend removed.',
    })
  })

  it('renders a remove-friend action for an active friendship', () => {
    render(
      <FriendshipControlsCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId="profile-1"
        relationshipState={{
          kind: 'friend',
          friendshipId: 'friendship-1',
        }}
      />,
    )

    expect(
      screen.getByRole('button', { name: /remove friend/i }),
    ).toBeInTheDocument()
  })

  it('shows an explicit confirmation step before removal', () => {
    render(
      <FriendshipControlsCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId="profile-1"
        relationshipState={{
          kind: 'friend',
          friendshipId: 'friendship-1',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /remove friend/i }))

    expect(
      screen.getByRole('button', { name: /confirm removal/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /keep friend/i }),
    ).toBeInTheDocument()
  })

  it('shows success feedback after confirming friendship removal', async () => {
    render(
      <FriendshipControlsCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId="profile-1"
        relationshipState={{
          kind: 'friend',
          friendshipId: 'friendship-1',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /remove friend/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm removal/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/friend removed\./i)
    })
  })

  it('shows strict not-found feedback when the friendship is already gone', async () => {
    mocks.removeFriendAction.mockResolvedValueOnce({
      status: 'error',
      code: 'friendship-not-found',
      message: 'This friendship is no longer active.',
    })

    render(
      <FriendshipControlsCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId="profile-1"
        relationshipState={{
          kind: 'friend',
          friendshipId: 'friendship-1',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /remove friend/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm removal/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/friendship is no longer active/i),
      ).toBeInTheDocument()
    })
  })

  it('renders a locked-history message when the active friendship is already removed', () => {
    render(
      <FriendshipControlsCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId="profile-1"
        relationshipState={{
          kind: 'history-locked',
          requestStatus: 'accepted',
        }}
      />,
    )

    expect(
      screen.getByText(
        /active friendship with Nova Player has already been removed/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /remove friend/i }),
    ).not.toBeInTheDocument()
  })
})
