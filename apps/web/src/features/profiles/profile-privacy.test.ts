import { describe, expect, it } from 'vitest'

import {
  canViewerAccessVisibility,
  isProfileVisibilityValue,
  isVisibilityAtLeastAsRestrictive,
  resolveProfileViewerCategory,
} from './profile-privacy'

describe('profile privacy helpers', () => {
  it('recognizes supported visibility values', () => {
    expect(isProfileVisibilityValue('public')).toBe(true)
    expect(isProfileVisibilityValue('friends')).toBe(true)
    expect(isProfileVisibilityValue('private')).toBe(true)
    expect(isProfileVisibilityValue('guild')).toBe(false)
  })

  it('resolves viewer categories from owner, friendship, and auth context', () => {
    expect(
      resolveProfileViewerCategory({
        viewerProfileId: 'profile-1',
        ownerProfileId: 'profile-1',
        isFriend: false,
      }),
    ).toBe('owner')

    expect(
      resolveProfileViewerCategory({
        viewerProfileId: 'profile-2',
        ownerProfileId: 'profile-1',
        isFriend: true,
      }),
    ).toBe('friend')

    expect(
      resolveProfileViewerCategory({
        viewerProfileId: 'profile-3',
        ownerProfileId: 'profile-1',
        isFriend: false,
      }),
    ).toBe('authenticated-non-friend')

    expect(
      resolveProfileViewerCategory({
        viewerProfileId: null,
        ownerProfileId: 'profile-1',
        isFriend: false,
      }),
    ).toBe('guest')
  })

  it('enforces access by visibility level and viewer category', () => {
    expect(canViewerAccessVisibility('private', 'owner')).toBe(true)
    expect(canViewerAccessVisibility('friends', 'friend')).toBe(true)
    expect(
      canViewerAccessVisibility('friends', 'authenticated-non-friend'),
    ).toBe(false)
    expect(canViewerAccessVisibility('public', 'guest')).toBe(true)
    expect(canViewerAccessVisibility('private', 'guest')).toBe(false)
  })

  it('treats stricter visibility levels as valid scoped overrides', () => {
    expect(isVisibilityAtLeastAsRestrictive('public', 'public')).toBe(true)
    expect(isVisibilityAtLeastAsRestrictive('friends', 'public')).toBe(true)
    expect(isVisibilityAtLeastAsRestrictive('private', 'friends')).toBe(true)
    expect(isVisibilityAtLeastAsRestrictive('public', 'friends')).toBe(false)
  })
})
