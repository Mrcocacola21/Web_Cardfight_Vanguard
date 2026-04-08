import {
  createProfilesRepository,
  type ProfileVisibility,
  type RepositoryResult,
} from '@web-vg/db'

import { createSupabaseServerClient } from '@/lib/supabase/server'

interface EnsureProfileForAuthUserInput {
  readonly authUserId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly visibility: ProfileVisibility
  readonly client?: Awaited<ReturnType<typeof createSupabaseServerClient>>
}

interface DeriveInitialProfileDraftInput {
  readonly preferredDisplayName?: string | null
  readonly email?: string | null
}

export interface InitialProfileDraft {
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly visibility: ProfileVisibility
}

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

function normalizeDisplayNameCandidate(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  if (!normalizedValue) {
    return null
  }

  return normalizedValue.slice(0, 80)
}

export function deriveInitialProfileDraft(
  input: DeriveInitialProfileDraftInput,
): InitialProfileDraft {
  const preferredDisplayName = normalizeDisplayNameCandidate(
    input.preferredDisplayName,
  )

  if (preferredDisplayName) {
    return {
      displayName: preferredDisplayName,
      avatarUrl: null,
      bio: null,
      visibility: 'private',
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
  }
}

export async function ensureProfileForAuthUser(
  input: EnsureProfileForAuthUserInput,
): Promise<RepositoryResult<{ readonly id: string }>> {
  const client = input.client ?? (await createSupabaseServerClient())
  const repository = createProfilesRepository(client)
  const result = await repository.ensureProfileByAuthUserId({
    authUserId: input.authUserId,
    displayName: input.displayName,
    avatarUrl: input.avatarUrl,
    bio: input.bio,
    visibility: input.visibility,
  })

  if (!result.ok) {
    return result
  }

  return {
    ok: true,
    data: {
      id: result.data.id,
    },
  }
}
