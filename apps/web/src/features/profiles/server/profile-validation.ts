import type { ProfileVisibility } from '@web-vg/db'

export interface ProfileDraft {
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly visibility: ProfileVisibility
}

export interface ProfileValidationErrors {
  readonly displayName?: string
  readonly avatarUrl?: string
  readonly bio?: string
  readonly visibility?: string
}

export type ProfileValidationResult =
  | {
      readonly ok: true
      readonly data: ProfileDraft
    }
  | {
      readonly ok: false
      readonly errors: ProfileValidationErrors
    }

export function validateProfileDraft(input: {
  readonly displayName: string
  readonly avatarUrl: string
  readonly bio: string
  readonly visibility: string
}): ProfileValidationResult {
  const displayName = input.displayName.trim()
  const avatarUrlValue = input.avatarUrl.trim()
  const bioValue = input.bio.trim()
  const visibilityValue = input.visibility.trim()
  const errors: {
    displayName?: string
    avatarUrl?: string
    bio?: string
    visibility?: string
  } = {}

  if (displayName.length === 0) {
    errors.displayName = 'Display name is required.'
  } else if (displayName.length > 80) {
    errors.displayName = 'Display name must stay within 80 characters.'
  }

  if (bioValue.length > 280) {
    errors.bio = 'Bio must stay within 280 characters.'
  }

  if (avatarUrlValue.length > 0) {
    try {
      new URL(avatarUrlValue)
    } catch {
      errors.avatarUrl = 'Avatar URL must be a valid absolute URL.'
    }
  }

  if (visibilityValue !== 'public' && visibilityValue !== 'private') {
    errors.visibility = 'Profile visibility must be public or private.'
  }

  if (
    errors.displayName ||
    errors.avatarUrl ||
    errors.bio ||
    errors.visibility
  ) {
    return {
      ok: false,
      errors,
    }
  }

  return {
    ok: true,
    data: {
      displayName,
      avatarUrl: avatarUrlValue.length > 0 ? avatarUrlValue : null,
      bio: bioValue.length > 0 ? bioValue : null,
      visibility:
        visibilityValue === 'public' || visibilityValue === 'private'
          ? visibilityValue
          : 'private',
    },
  }
}
