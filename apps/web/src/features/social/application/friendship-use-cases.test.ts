import { describe, expect, it, vi } from 'vitest'

import type { FriendshipApplicationServices } from './friendship-application-support'
import { removeFriendUseCase } from './friendship-use-cases'

describe('removeFriendUseCase', () => {
  it('removes an existing friendship for one participant', async () => {
    const services = createServicesDouble()
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
    services.removeFriendship.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friendship-1',
        firstProfileId: 'profile-1',
        secondProfileId: 'profile-2',
        friendRequestId: 'friend-1',
        createdAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const result = await removeFriendUseCase(services.dependencies, {
      isAuthenticated: true,
      actorProfileId: 'profile-1',
      targetProfileId: 'profile-2',
    })

    expect(services.getFriendshipBetweenProfiles).toHaveBeenCalledWith(
      'profile-1',
      'profile-2',
    )
    expect(services.removeFriendship).toHaveBeenCalledWith({
      friendshipId: 'friendship-1',
      firstProfileId: 'profile-1',
      secondProfileId: 'profile-2',
    })
    expect(result).toEqual({
      ok: true,
      data: {
        removedFriendshipId: 'friendship-1',
        targetProfileId: 'profile-2',
      },
    })
  })

  it('keeps the model symmetric so the other participant can remove the same friendship', async () => {
    const services = createServicesDouble()
    services.getFriendshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friendship-2',
        firstProfileId: 'profile-1',
        secondProfileId: 'profile-2',
        friendRequestId: 'friend-2',
        createdAt: '2026-04-18T11:00:00.000Z',
      },
    })
    services.removeFriendship.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'friendship-2',
        firstProfileId: 'profile-1',
        secondProfileId: 'profile-2',
        friendRequestId: 'friend-2',
        createdAt: '2026-04-18T11:00:00.000Z',
      },
    })

    const result = await removeFriendUseCase(services.dependencies, {
      isAuthenticated: true,
      actorProfileId: 'profile-2',
      targetProfileId: 'profile-1',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        removedFriendshipId: 'friendship-2',
        targetProfileId: 'profile-1',
      },
    })
  })

  it('blocks unauthenticated removal attempts', async () => {
    const services = createServicesDouble()

    const result = await removeFriendUseCase(services.dependencies, {
      isAuthenticated: false,
      actorProfileId: null,
      targetProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'unauthorized',
        message: 'You need to sign in before removing a friend.',
      },
    })
    expect(services.getFriendshipBetweenProfiles).not.toHaveBeenCalled()
  })

  it('returns strict not-found semantics for third-party or already removed friendships', async () => {
    const services = createServicesDouble()
    services.getFriendshipBetweenProfiles.mockResolvedValueOnce({
      ok: true,
      data: null,
    })

    const result = await removeFriendUseCase(services.dependencies, {
      isAuthenticated: true,
      actorProfileId: 'profile-3',
      targetProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'friendship-not-found',
        message: 'This friendship is no longer active.',
      },
    })
    expect(services.removeFriendship).not.toHaveBeenCalled()
  })

  it('maps a repeated removal race into the same strict not-found result', async () => {
    const services = createServicesDouble()
    services.getFriendshipBetweenProfiles
      .mockResolvedValueOnce({
        ok: true,
        data: {
          id: 'friendship-3',
          firstProfileId: 'profile-1',
          secondProfileId: 'profile-2',
          friendRequestId: 'friend-3',
          createdAt: '2026-04-18T11:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: null,
      })
    services.removeFriendship.mockResolvedValueOnce({
      ok: true,
      data: null,
    })

    const result = await removeFriendUseCase(services.dependencies, {
      isAuthenticated: true,
      actorProfileId: 'profile-1',
      targetProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'friendship-not-found',
        message: 'This friendship is no longer active.',
      },
    })
  })
})

function createServicesDouble() {
  const getFriendshipBetweenProfiles = vi.fn()
  const removeFriendship = vi.fn()

  return {
    dependencies: {
      socialRepository: {
        getFriendshipBetweenProfiles,
        removeFriendship,
      },
    } satisfies FriendshipApplicationServices,
    getFriendshipBetweenProfiles,
    removeFriendship,
  }
}
