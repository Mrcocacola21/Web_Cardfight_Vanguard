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
  it('returns a public profile for a non-owner viewer', async () => {
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
    })

    expect(state).toEqual({
      kind: 'ready',
      profile: publicProfile,
      isOwnerViewer: false,
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
    })
  })
})
