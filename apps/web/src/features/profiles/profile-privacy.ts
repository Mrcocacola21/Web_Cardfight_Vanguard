import type { ProfileVisibility } from '@web-vg/db/repositories/profiles'

export type ProfileViewerCategory =
  | 'owner'
  | 'friend'
  | 'authenticated-non-friend'
  | 'guest'

const visibilityOrder: Record<ProfileVisibility, number> = {
  public: 0,
  friends: 1,
  private: 2,
}

export function isProfileVisibilityValue(
  value: string,
): value is ProfileVisibility {
  return value === 'public' || value === 'friends' || value === 'private'
}

export function resolveProfileViewerCategory(input: {
  readonly viewerProfileId: string | null
  readonly ownerProfileId: string
  readonly isFriend: boolean
}): ProfileViewerCategory {
  if (input.viewerProfileId === input.ownerProfileId) {
    return 'owner'
  }

  if (input.isFriend) {
    return 'friend'
  }

  return input.viewerProfileId ? 'authenticated-non-friend' : 'guest'
}

export function canViewerAccessVisibility(
  visibility: ProfileVisibility,
  viewerCategory: ProfileViewerCategory,
) {
  if (viewerCategory === 'owner') {
    return true
  }

  if (viewerCategory === 'friend') {
    return visibility === 'public' || visibility === 'friends'
  }

  return visibility === 'public'
}

export function isVisibilityAtLeastAsRestrictive(
  visibility: ProfileVisibility,
  baseline: ProfileVisibility,
) {
  return visibilityOrder[visibility] >= visibilityOrder[baseline]
}
