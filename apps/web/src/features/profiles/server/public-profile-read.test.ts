import type {
  ProfileRecord,
  PublicProfileRecord,
} from '@web-vg/db/repositories/profiles'
import { describe, expect, it } from 'vitest'

import { resolvePublicProfilePageState } from './public-profile-read'

const publicProfile: PublicProfileRecord = {
  id: 'profile-public',
  displayName: 'Azure Pilot',
  avatarUrl: 'https://images.example/avatar.png',
  bio: 'Public pilot bio.',
}

const privateOwnerProfile: ProfileRecord = {
  id: 'profile-private',
  username: null,
  displayName: 'Hidden Pilot',
  avatarUrl: null,
  bio: 'Private pilot bio.',
  visibility: 'private',
  createdAt: '2026-04-08T00:00:00.000Z',
  updatedAt: '2026-04-08T01:00:00.000Z',
}

describe('resolvePublicProfilePageState', () => {
  it('returns a public profile for a guest viewer with guest relationship state', async () => {
    const state = await resolvePublicProfilePageState('profile-public', {
      getViewerProfileId() {
        return Promise.resolve(null)
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getPublicProfileById() {
        return Promise.resolve({
          ok: true,
          data: publicProfile,
        })
      },
      getFriendRelationshipBetweenProfiles() {
        return Promise.reject(
          new Error('relationship fetch should not run for guest viewers'),
        )
      },
      getFriendshipBetweenProfiles() {
        return Promise.reject(
          new Error('friendship fetch should not run for guest viewers'),
        )
      },
    })

    expect(state).toEqual({
      kind: 'ready',
      profile: publicProfile,
      isOwnerViewer: false,
      viewerProfileId: null,
      relationshipState: {
        kind: 'guest',
      },
    })
  })

  it('returns not-found for a private profile when the viewer is not the owner', async () => {
    const state = await resolvePublicProfilePageState('profile-private', {
      getViewerProfileId() {
        return Promise.resolve('profile-other')
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getPublicProfileById() {
        return Promise.resolve({
          ok: true,
          data: null,
        })
      },
      getFriendRelationshipBetweenProfiles() {
        return Promise.reject(
          new Error('relationship fetch should not run for missing profiles'),
        )
      },
      getFriendshipBetweenProfiles() {
        return Promise.reject(
          new Error('friendship fetch should not run for missing profiles'),
        )
      },
    })

    expect(state).toEqual({
      kind: 'not-found',
    })
  })

  it('returns the owner profile even when visibility is private', async () => {
    const state = await resolvePublicProfilePageState('profile-private', {
      getViewerProfileId() {
        return Promise.resolve('profile-private')
      },
      getProfileById() {
        return Promise.resolve({
          ok: true,
          data: privateOwnerProfile,
        })
      },
      getPublicProfileById() {
        return Promise.reject(
          new Error('public fetch should not run for the owner path'),
        )
      },
      getFriendRelationshipBetweenProfiles() {
        return Promise.reject(
          new Error('relationship fetch should not run for owner view'),
        )
      },
      getFriendshipBetweenProfiles() {
        return Promise.reject(
          new Error('friendship fetch should not run for owner view'),
        )
      },
    })

    expect(state).toEqual({
      kind: 'ready',
      profile: {
        id: 'profile-private',
        displayName: 'Hidden Pilot',
        avatarUrl: null,
        bio: 'Private pilot bio.',
      },
      isOwnerViewer: true,
      viewerProfileId: 'profile-private',
      relationshipState: {
        kind: 'self',
      },
    })
  })

  it('returns active friendship state when a friendship edge exists', async () => {
    const state = await resolvePublicProfilePageState('profile-public', {
      getViewerProfileId() {
        return Promise.resolve('profile-viewer')
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getPublicProfileById() {
        return Promise.resolve({
          ok: true,
          data: publicProfile,
        })
      },
      getFriendRelationshipBetweenProfiles() {
        return Promise.reject(
          new Error('request history should not run when friendship exists'),
        )
      },
      getFriendshipBetweenProfiles() {
        return Promise.resolve({
          ok: true,
          data: {
            id: 'friendship-1',
            firstProfileId: 'profile-public',
            secondProfileId: 'profile-viewer',
            friendRequestId: 'friend-1',
            createdAt: '2026-04-18T11:00:00.000Z',
          },
        })
      },
    })

    expect(state).toEqual({
      kind: 'ready',
      profile: publicProfile,
      isOwnerViewer: false,
      viewerProfileId: 'profile-viewer',
      relationshipState: {
        kind: 'friend',
        friendshipId: 'friendship-1',
      },
    })
  })

  it('returns history-locked state when request history exists without an active friendship edge', async () => {
    const state = await resolvePublicProfilePageState('profile-public', {
      getViewerProfileId() {
        return Promise.resolve('profile-viewer')
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getPublicProfileById() {
        return Promise.resolve({
          ok: true,
          data: publicProfile,
        })
      },
      getFriendRelationshipBetweenProfiles() {
        return Promise.resolve({
          ok: true,
          data: {
            id: 'friend-accepted',
            requesterProfileId: 'profile-viewer',
            addresseeProfileId: 'profile-public',
            status: 'accepted',
            requestedAt: '2026-04-18T10:00:00.000Z',
            respondedAt: '2026-04-18T11:00:00.000Z',
          },
        })
      },
      getFriendshipBetweenProfiles() {
        return Promise.resolve({
          ok: true,
          data: null,
        })
      },
    })

    expect(state).toEqual({
      kind: 'ready',
      profile: publicProfile,
      isOwnerViewer: false,
      viewerProfileId: 'profile-viewer',
      relationshipState: {
        kind: 'history-locked',
        requestStatus: 'accepted',
      },
    })
  })
})
