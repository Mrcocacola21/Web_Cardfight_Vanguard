import type { ProfileVisibility } from '@web-vg/db/repositories/profiles'

import {
  mapProfileRepositoryFailure,
  type ProfileApplicationResult,
  type ProfileApplicationServices,
} from './profile-application-support'

export interface SaveCurrentProfileCommand {
  readonly authUserId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly visibility: ProfileVisibility
  readonly bioVisibility: ProfileVisibility
}

export type SaveCurrentProfileResult = ProfileApplicationResult<{
  readonly profileId: string
}>

export async function saveCurrentProfileUseCase(
  services: ProfileApplicationServices,
  command: SaveCurrentProfileCommand,
): Promise<SaveCurrentProfileResult> {
  const result = await services.repository.upsertProfileByAuthUserId({
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
