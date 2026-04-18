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
  respondToFriendRequestAction: vi.fn(),
}))

vi.mock('@/features/social/server/friend-request-actions', async () => {
  const actual = await vi.importActual<typeof FriendRequestActionsModule>(
    '@/features/social/server/friend-request-actions',
  )

  return {
    ...actual,
    respondToFriendRequestAction: mocks.respondToFriendRequestAction,
  }
})

import { IncomingFriendRequestsCard } from './incoming-friend-requests-card'

describe('IncomingFriendRequestsCard', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.respondToFriendRequestAction.mockResolvedValue({
      status: 'success',
      code: 'accepted',
      message: 'Friend request accepted.',
    })
  })

  it('renders an empty state when there are no pending requests', () => {
    render(<IncomingFriendRequestsCard requests={[]} />)

    expect(screen.getByText(/no pending requests/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /accept/i }),
    ).not.toBeInTheDocument()
  })

  it('renders incoming requests with accept and decline actions', () => {
    render(<IncomingFriendRequestsCard requests={[buildRequest()]} />)

    expect(screen.getByText('Azure Pilot')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
  })

  it('shows success feedback after accepting a request', async () => {
    render(<IncomingFriendRequestsCard requests={[buildRequest()]} />)

    fireEvent.click(screen.getByRole('button', { name: /accept/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /friend request accepted\./i,
      )
    })

    expect(screen.getByRole('button', { name: /accept/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /decline/i })).toBeDisabled()
  })

  it('shows success feedback after declining a request', async () => {
    mocks.respondToFriendRequestAction.mockResolvedValueOnce({
      status: 'success',
      code: 'declined',
      message: 'Friend request declined.',
    })

    render(<IncomingFriendRequestsCard requests={[buildRequest()]} />)

    fireEvent.click(screen.getByRole('button', { name: /decline/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /friend request declined\./i,
      )
    })
  })

  it('shows handled/error feedback returned by the action', async () => {
    mocks.respondToFriendRequestAction.mockResolvedValueOnce({
      status: 'error',
      code: 'already-handled',
      message: 'This friend request has already been handled.',
    })

    render(<IncomingFriendRequestsCard requests={[buildRequest()]} />)

    fireEvent.click(screen.getByRole('button', { name: /accept/i }))

    await waitFor(() => {
      expect(screen.getByText(/already been handled/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /accept/i })).toBeDisabled()
  })
})

function buildRequest() {
  return {
    requestId: 'friend-1',
    requestedAt: '2026-04-18T12:00:00.000Z',
    requesterProfileId: 'profile-1',
    recipientProfileId: 'profile-2',
    requesterDisplayName: 'Azure Pilot',
    requesterAvatarUrl: null,
  }
}
