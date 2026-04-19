import type { ProfileVisibility } from '@web-vg/db/repositories/profiles'

import {
  mapProfileRepositoryFailure,
  type ProfileApplicationResult,
  type ProfileApplicationServices,
} from './profile-application-support'

export interface InitialProfileDraft {
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly visibility: ProfileVisibility
  readonly bioVisibility: ProfileVisibility
}

export interface EnsureProfileForAuthUserCommand {
  readonly authUserId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly visibility: ProfileVisibility
  readonly bioVisibility: ProfileVisibility
}

export type EnsureProfileForAuthUserResult = ProfileApplicationResult<{
  readonly profileId: string
}>

export function readMetadataDisplayName(userMetadata: unknown): string | null {
  if (
    typeof userMetadata !== 'object' ||
    userMetadata === null ||
    !('display_name' in userMetadata)
  ) {
    return null
  }

  const displayName = userMetadata.display_name

  return typeof displayName === 'string' ? displayName : null
}

export function deriveInitialProfileDraft(input: {
  readonly preferredDisplayName?: string | null
  readonly email?: string | null
}): InitialProfileDraft {
  const preferredDisplayName = normalizeDisplayNameCandidate(
    input.preferredDisplayName,
  )

  if (preferredDisplayName) {
    return {
      displayName: preferredDisplayName,
      avatarUrl: null,
      bio: null,
      visibility: 'private',
      bioVisibility: 'private',
    }
  }

  const emailLocalPart = input.email?.split('@')[0]?.trim()
  const derivedDisplayName =
    normalizeDisplayNameCandidate(emailLocalPart) ?? 'Vanguard Player'

  return {
    displayName: derivedDisplayName,
    avatarUrl: null,
    bio: null,
    visibility: 'private',
    bioVisibility: 'private',
  }
}

export async function ensureProfileForAuthUserUseCase(
  services: ProfileApplicationServices,
  command: EnsureProfileForAuthUserCommand,
): Promise<EnsureProfileForAuthUserResult> {
  const result = await services.repository.ensureProfileByAuthUserId({
    authUserId: command.authUserId,
    displayName: command.displayName,
    avatarUrl: command.avatarUrl,
    bio: command.bio,
    visibility: command.visibility,
    bioVisibility: command.bioVisibility,
  })

  if (!result.ok) {
    return mapProfileRepositoryFailure(result.error.message)
  }

  return {
    ok: true,
    data: {
      profileId: result.data.id,
    },
  }
}

function normalizeDisplayNameCandidate(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  if (!normalizedValue) {
    return null
  }

  return normalizedValue.slice(0, 80)
}
