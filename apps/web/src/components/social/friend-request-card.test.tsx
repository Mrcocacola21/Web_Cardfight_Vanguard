import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as FriendRequestActionsModule from '@/features/social/server/friend-request-actions'

const mocks = vi.hoisted(() => ({
  sendFriendRequestAction: vi.fn(),
}))

vi.mock('@/features/social/server/friend-request-actions', async () => {
  const actual = await vi.importActual<typeof FriendRequestActionsModule>(
    '@/features/social/server/friend-request-actions',
  )

  return {
    ...actual,
    sendFriendRequestAction: mocks.sendFriendRequestAction,
  }
})

import { FriendRequestCard } from './friend-request-card'

describe('FriendRequestCard', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendFriendRequestAction.mockResolvedValue({
      status: 'success',
      code: 'request-sent',
      message: 'Friend request sent.',
    })
  })

  it('renders a sign-in entry point for guests', () => {
    render(
      <FriendRequestCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId={null}
      />,
    )

    expect(
      screen.getByRole('link', { name: /sign in to add friend/i }),
    ).toHaveAttribute('href', '/login')
    expect(
      screen.queryByRole('button', { name: /add friend/i }),
    ).not.toBeInTheDocument()
  })

  it('renders the add-friend action for an authenticated non-owner viewer', () => {
    render(
      <FriendRequestCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId="profile-1"
      />,
    )

    expect(
      screen.getByRole('button', { name: /add friend/i }),
    ).toBeInTheDocument()
  })

  it('shows success feedback after sending a friend request and disables the button', async () => {
    render(
      <FriendRequestCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId="profile-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add friend/i }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /request sent/i }),
      ).toBeDisabled()
    })
  })

  it('shows duplicate feedback returned by the action', async () => {
    mocks.sendFriendRequestAction.mockResolvedValueOnce({
      status: 'error',
      code: 'already-pending',
      message: 'A friend request is already pending for this user.',
    })

    render(
      <FriendRequestCard
        recipientProfileId="profile-2"
        recipientDisplayName="Nova Player"
        viewerProfileId="profile-1"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add friend/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/already pending for this user/i),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole('button', { name: /request pending/i }),
    ).toBeDisabled()
  })

  it('shows self-request feedback returned by the action', async () => {
    mocks.sendFriendRequestAction.mockResolvedValueOnce({
      status: 'error',
      code: 'self-request',
      message: 'You cannot send a friend request to yourself.',
    })

    render(
      <FriendRequestCard
        recipientProfileId="profile-1"
        recipientDisplayName="Azure Pilot"
        viewerProfileId="profile-other"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /add friend/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/cannot send a friend request to yourself/i),
      ).toBeInTheDocument()
    })
  })
})
