import { describe, expect, it, vi } from 'vitest'

import type { FriendRequestApplicationServices } from './friend-request-application-support'
import {
  acceptFriendRequestUseCase,
  declineFriendRequestUseCase,
  sendFriendRequestUseCase,
} from './friend-request-use-cases'

describe('sendFriendRequestUseCase', () => {
  it('creates a pending friend request through the repository-backed flow', async () => {
    const services = createServicesDouble()
    services.getPublicProfileById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-2',
        displayName: 'Nova Player',
        avatarUrl: null,
        bio: null,
      },
    })
    services.getFriendshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: null,
    })
    services.getFriendRelationshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: null,
    })
    services.createFriendRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-1',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })

    const result = await sendFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      senderProfileId: 'profile-1',
      recipientProfileId: 'profile-2',
    })

    expect(services.createFriendRequest).toHaveBeenCalledWith({
      requesterProfileId: 'profile-1',
      addresseeProfileId: 'profile-2',
    })
    expect(result).toEqual({
      ok: true,
      data: {
        friendRequestId: 'friend-1',
        status: 'pending',
      },
    })
  })

  it('blocks unauthorized actors before any repository work runs', async () => {
    const services = createServicesDouble()

    const result = await sendFriendRequestUseCase(services.dependencies, {
      isAuthenticated: false,
      senderProfileId: null,
      recipientProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'unauthorized',
        message: 'You need to sign in before sending a friend request.',
      },
    })
    expect(services.getPublicProfileById).not.toHaveBeenCalled()
  })

  it('blocks self requests', async () => {
    const services = createServicesDouble()

    const result = await sendFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      senderProfileId: 'profile-1',
      recipientProfileId: 'profile-1',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'self-request',
        message: 'You cannot send a friend request to yourself.',
      },
    })
  })

  it('blocks duplicate pending requests', async () => {
    const services = createServicesDouble()
    services.getPublicProfileById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-2',
        displayName: 'Nova Player',
        avatarUrl: null,
        bio: null,
      },
    })
    services.getFriendshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: null,
    })
    services.getFriendRelationshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-1',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })

    const result = await sendFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      senderProfileId: 'profile-1',
      recipientProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'already-pending',
        message: 'A friend request is already pending for this profile pair.',
      },
    })
    expect(services.createFriendRequest).not.toHaveBeenCalled()
  })

  it('maps a race-time unique conflict back into a stable duplicate error', async () => {
    const services = createServicesDouble()
    services.getPublicProfileById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-2',
        displayName: 'Nova Player',
        avatarUrl: null,
        bio: null,
      },
    })
    services.getFriendshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: null,
    })
    services.getFriendRelationshipBetweenProfiles
      .mockResolvedValueOnce({
        ok: true,
        data: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'friend-1',
          requesterProfileId: 'profile-1',
          addresseeProfileId: 'profile-2',
          status: 'pending',
          requestedAt: '2026-04-18T10:00:00.000Z',
          respondedAt: null,
        },
      })
    services.createFriendRequest.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'conflict',
        message: 'Failed to create friend request.',
      },
    })

    const result = await sendFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      senderProfileId: 'profile-1',
      recipientProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'already-pending',
        message: 'A friend request is already pending for this profile pair.',
      },
    })
  })

  it('blocks send when an active friendship edge already exists', async () => {
    const services = createServicesDouble()
    services.getPublicProfileById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-2',
        displayName: 'Nova Player',
        avatarUrl: null,
        bio: null,
      },
    })
    services.getFriendshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friendship-1',
        firstProfileId: 'profile-1',
        secondProfileId: 'profile-2',
        friendRequestId: 'friend-1',
        createdAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const result = await sendFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      senderProfileId: 'profile-1',
      recipientProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'already-friends',
        message: 'You are already connected as friends.',
      },
    })
    expect(services.getFriendRelationshipBetweenProfiles).not.toHaveBeenCalled()
  })

  it('maps accepted request history without an active friendship edge into request-unavailable', async () => {
    const services = createServicesDouble()
    services.getPublicProfileById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'profile-2',
        displayName: 'Nova Player',
        avatarUrl: null,
        bio: null,
      },
    })
    services.getFriendshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: null,
    })
    services.getFriendRelationshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-accepted',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'accepted',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const result = await sendFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      senderProfileId: 'profile-1',
      recipientProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'request-unavailable',
        message:
          'This profile pair already has historical friend-request state. Reconnection flows are not implemented yet.',
      },
    })
  })
})

describe('acceptFriendRequestUseCase', () => {
  it('accepts a pending request and confirms the friendship edge', async () => {
    const services = createServicesDouble()
    services.getFriendRequestById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-2',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })
    services.acceptFriendRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-2',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'accepted',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: '2026-04-18T11:00:00.000Z',
      },
    })
    services.getFriendshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friendship-1',
        firstProfileId: 'profile-1',
        secondProfileId: 'profile-2',
        friendRequestId: 'friend-2',
        createdAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const result = await acceptFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      recipientProfileId: 'profile-2',
      requestId: 'friend-2',
    })

    expect(services.acceptFriendRequest).toHaveBeenCalledWith({
      requestId: 'friend-2',
      recipientProfileId: 'profile-2',
    })
    expect(services.getFriendshipBetweenProfiles).toHaveBeenCalledWith(
      'profile-1',
      'profile-2',
    )
    expect(result).toEqual({
      ok: true,
      data: {
        friendRequestId: 'friend-2',
        requesterProfileId: 'profile-1',
        friendshipId: 'friendship-1',
        status: 'accepted',
      },
    })
  })

  it('blocks non-recipients from accepting a request', async () => {
    const services = createServicesDouble()
    services.getFriendRequestById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-3',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })

    const result = await acceptFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      recipientProfileId: 'profile-3',
      requestId: 'friend-3',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'forbidden',
        message: 'Only the request recipient can manage this friend request.',
      },
    })
    expect(services.acceptFriendRequest).not.toHaveBeenCalled()
  })

  it('prevents the sender from accepting their own request', async () => {
    const services = createServicesDouble()
    services.getFriendRequestById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-4',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })

    const result = await acceptFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      recipientProfileId: 'profile-1',
      requestId: 'friend-4',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'forbidden',
        message: 'Only the request recipient can manage this friend request.',
      },
    })
  })

  it('returns already-handled for terminal requests', async () => {
    const services = createServicesDouble()
    services.getFriendRequestById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-5',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'accepted',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const result = await acceptFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      recipientProfileId: 'profile-2',
      requestId: 'friend-5',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'already-handled',
        message: 'This friend request has already been handled.',
      },
    })
  })

  it('maps a race-time repeat handling into already-handled without creating duplicate friendships', async () => {
    const services = createServicesDouble()
    services.getFriendRequestById
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'friend-6',
          requesterProfileId: 'profile-1',
          addresseeProfileId: 'profile-2',
          status: 'pending',
          requestedAt: '2026-04-18T10:00:00.000Z',
          respondedAt: null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'friend-6',
          requesterProfileId: 'profile-1',
          addresseeProfileId: 'profile-2',
          status: 'accepted',
          requestedAt: '2026-04-18T10:00:00.000Z',
          respondedAt: '2026-04-18T11:00:00.000Z',
        },
      })
    services.acceptFriendRequest.mockResolvedValueOnce({
      ok: true,
      data: null,
    })

    const result = await acceptFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      recipientProfileId: 'profile-2',
      requestId: 'friend-6',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'already-handled',
        message: 'This friend request has already been handled.',
      },
    })
    expect(services.getFriendshipBetweenProfiles).not.toHaveBeenCalled()
  })
})

describe('declineFriendRequestUseCase', () => {
  it('declines a pending request without creating a friendship edge', async () => {
    const services = createServicesDouble()
    services.getFriendRequestById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-7',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })
    services.declineFriendRequest.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-7',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'declined',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const result = await declineFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      recipientProfileId: 'profile-2',
      requestId: 'friend-7',
    })

    expect(services.getFriendshipBetweenProfiles).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      data: {
        friendRequestId: 'friend-7',
        requesterProfileId: 'profile-1',
        status: 'declined',
      },
    })
  })

  it('returns already-handled for terminal decline attempts', async () => {
    const services = createServicesDouble()
    services.getFriendRequestById.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friend-8',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'declined',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const result = await declineFriendRequestUseCase(services.dependencies, {
      isAuthenticated: true,
      recipientProfileId: 'profile-2',
      requestId: 'friend-8',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'already-handled',
        message: 'This friend request has already been handled.',
      },
    })
  })
})

function createServicesDouble() {
  const getPublicProfileById = vi.fn()
  const getFriendRelationshipBetweenProfiles = vi.fn()
  const getFriendshipBetweenProfiles = vi.fn()
  const getFriendRequestById = vi.fn()
  const createFriendRequest = vi.fn()
  const acceptFriendRequest = vi.fn()
  const declineFriendRequest = vi.fn()

  return {
    dependencies: {
      profilesRepository: {
        getPublicProfileById,
      },
      socialRepository: {
        getFriendRelationshipBetweenProfiles,
        getFriendRequestById,
        createFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        getFriendshipBetweenProfiles,
      },
    } satisfies FriendRequestApplicationServices,
    getPublicProfileById,
    getFriendRelationshipBetweenProfiles,
    getFriendshipBetweenProfiles,
    getFriendRequestById,
    createFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
  }
}
