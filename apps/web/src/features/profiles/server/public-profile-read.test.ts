import type {
  ProfileRecord,
  VisibleProfileRecord,
} from '@web-vg/db/repositories/profiles'
import { describe, expect, it } from 'vitest'

import { resolvePublicProfilePageState } from './public-profile-read'

const guestVisiblePublicProfile: VisibleProfileRecord = {
  id: 'profile-public',
  displayName: 'Azure Pilot',
  avatarUrl: 'https://images.example/avatar.png',
  bio: 'Public pilot bio.',
  visibility: 'public',
  bioVisibility: 'public',
  bioVisible: true,
}

const privateOwnerProfile: ProfileRecord = {
  id: 'profile-private',
  username: null,
  displayName: 'Hidden Pilot',
  avatarUrl: null,
  bio: 'Private pilot bio.',
  visibility: 'private',
  bioVisibility: 'private',
  createdAt: '2026-04-08T00:00:00.000Z',
  updatedAt: '2026-04-08T01:00:00.000Z',
}

describe('resolvePublicProfilePageState', () => {
  it('returns a public profile for a guest viewer with guest category and guest relationship state', async () => {
    const state = await resolvePublicProfilePageState('profile-public', {
      getViewerProfileId() {
        return Promise.resolve(null)
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getVisibleProfileById() {
        return Promise.resolve({
          ok: true,
          data: guestVisiblePublicProfile,
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
      profile: guestVisiblePublicProfile,
      isOwnerViewer: false,
      viewerProfileId: null,
      viewerCategory: 'guest',
      relationshipState: {
        kind: 'guest',
      },
    })
  })

  it('returns not-found for a friends-only profile when the viewer is not an active friend', async () => {
    const state = await resolvePublicProfilePageState('profile-friends', {
      getViewerProfileId() {
        return Promise.resolve('profile-stranger')
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getVisibleProfileById() {
        return Promise.resolve({
          ok: true,
          data: null,
        })
      },
      getFriendRelationshipBetweenProfiles() {
        return Promise.reject(
          new Error('relationship fetch should not run for invisible profiles'),
        )
      },
      getFriendshipBetweenProfiles() {
        return Promise.reject(
          new Error('friendship fetch should not run for invisible profiles'),
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
      getVisibleProfileById() {
        return Promise.reject(
          new Error('visible profile fetch should not run for the owner path'),
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
        visibility: 'private',
        bioVisibility: 'private',
        bioVisible: true,
      },
      isOwnerViewer: true,
      viewerProfileId: 'profile-private',
      viewerCategory: 'owner',
      relationshipState: {
        kind: 'self',
      },
    })
  })

  it('returns active friendship state and friend category when an active friendship edge exists', async () => {
    const state = await resolvePublicProfilePageState('profile-friends', {
      getViewerProfileId() {
        return Promise.resolve('profile-viewer')
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getVisibleProfileById() {
        return Promise.resolve({
          ok: true,
          data: {
            id: 'profile-friends',
            displayName: 'Nova Player',
            avatarUrl: null,
            bio: 'Friends-only bio.',
            visibility: 'friends',
            bioVisibility: 'friends',
            bioVisible: true,
          },
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
            firstProfileId: 'profile-friends',
            secondProfileId: 'profile-viewer',
            friendRequestId: 'friend-1',
            createdAt: '2026-04-18T11:00:00.000Z',
          },
        })
      },
    })

    expect(state).toEqual({
      kind: 'ready',
      profile: {
        id: 'profile-friends',
        displayName: 'Nova Player',
        avatarUrl: null,
        bio: 'Friends-only bio.',
        visibility: 'friends',
        bioVisibility: 'friends',
        bioVisible: true,
      },
      isOwnerViewer: false,
      viewerProfileId: 'profile-viewer',
      viewerCategory: 'friend',
      relationshipState: {
        kind: 'friend',
        friendshipId: 'friendship-1',
      },
    })
  })

  it('hides friends-only bio from an authenticated non-friend while keeping the public profile route visible', async () => {
    const state = await resolvePublicProfilePageState('profile-public', {
      getViewerProfileId() {
        return Promise.resolve('profile-viewer')
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getVisibleProfileById() {
        return Promise.resolve({
          ok: true,
          data: {
            id: 'profile-public',
            displayName: 'Azure Pilot',
            avatarUrl: 'https://images.example/avatar.png',
            bio: null,
            visibility: 'public',
            bioVisibility: 'friends',
            bioVisible: false,
          },
        })
      },
      getFriendRelationshipBetweenProfiles() {
        return Promise.resolve({
          ok: true,
          data: null,
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
      profile: {
        id: 'profile-public',
        displayName: 'Azure Pilot',
        avatarUrl: 'https://images.example/avatar.png',
        bio: null,
        visibility: 'public',
        bioVisibility: 'friends',
        bioVisible: false,
      },
      isOwnerViewer: false,
      viewerProfileId: 'profile-viewer',
      viewerCategory: 'authenticated-non-friend',
      relationshipState: {
        kind: 'none',
      },
    })
  })

  it('does not let a pending request unlock friends-only bio visibility', async () => {
    const state = await resolvePublicProfilePageState('profile-public', {
      getViewerProfileId() {
        return Promise.resolve('profile-viewer')
      },
      getProfileById() {
        return Promise.reject(new Error('owner profile fetch should not run'))
      },
      getVisibleProfileById() {
        return Promise.resolve({
          ok: true,
          data: {
            id: 'profile-public',
            displayName: 'Azure Pilot',
            avatarUrl: null,
            bio: null,
            visibility: 'public',
            bioVisibility: 'friends',
            bioVisible: false,
          },
        })
      },
      getFriendRelationshipBetweenProfiles() {
        return Promise.resolve({
          ok: true,
          data: {
            id: 'friend-pending',
            requesterProfileId: 'profile-public',
            addresseeProfileId: 'profile-viewer',
            status: 'pending',
            requestedAt: '2026-04-18T10:00:00.000Z',
            respondedAt: null,
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
      profile: {
        id: 'profile-public',
        displayName: 'Azure Pilot',
        avatarUrl: null,
        bio: null,
        visibility: 'public',
        bioVisibility: 'friends',
        bioVisible: false,
      },
      isOwnerViewer: false,
      viewerProfileId: 'profile-viewer',
      viewerCategory: 'authenticated-non-friend',
      relationshipState: {
        kind: 'pending',
        requestId: 'friend-pending',
        direction: 'incoming',
      },
    })
  })
})
