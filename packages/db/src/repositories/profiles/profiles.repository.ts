import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import { mapProfileRow, mapPublicProfileRow } from './profiles.mappers'
import type {
  EnsureProfileByAuthUserIdInput,
  ProfileRecord,
  PublicProfileRecord,
  UpsertProfileByAuthUserIdInput,
} from './profiles.types'

const profileSelect =
  'id, username, display_name, bio, avatar_url, visibility, created_at, updated_at'

export interface ProfilesRepository {
  getProfileById(id: string): Promise<RepositoryResult<ProfileRecord | null>>
  getPublicProfileById(
    id: string,
  ): Promise<RepositoryResult<PublicProfileRecord | null>>
  getProfileByAuthUserId(
    authUserId: string,
  ): Promise<RepositoryResult<ProfileRecord | null>>
  ensureProfileByAuthUserId(
    input: EnsureProfileByAuthUserIdInput,
  ): Promise<RepositoryResult<ProfileRecord>>
  upsertProfileByAuthUserId(
    input: UpsertProfileByAuthUserIdInput,
  ): Promise<RepositoryResult<ProfileRecord>>
}

export function createProfilesRepository(client: DbClient): ProfilesRepository {
  async function selectProfileByAuthUserId(authUserId: string) {
    return client
      .schema('user_data')
      .from('profiles')
      .select(profileSelect)
      .eq('auth_user_id', authUserId)
      .maybeSingle()
  }

  return {
    async getProfileById(id) {
      const { data, error } = await client
        .schema('user_data')
        .from('profiles')
        .select(profileSelect)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load profile.'))
      }

      return ok(data ? mapProfileRow(data) : null)
    },

    async getPublicProfileById(id) {
      const { data, error } = await client
        .schema('user_data')
        .from('profiles')
        .select(profileSelect)
        .eq('id', id)
        .eq('visibility', 'public')
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load public profile.'))
      }

      return ok(data ? mapPublicProfileRow(data) : null)
    },

    async getProfileByAuthUserId(authUserId) {
      const { data, error } = await selectProfileByAuthUserId(authUserId)

      if (error) {
        return err(mapQueryError(error, 'Failed to load current profile.'))
      }

      return ok(data ? mapProfileRow(data) : null)
    },

    async ensureProfileByAuthUserId(input) {
      const existingResult = await selectProfileByAuthUserId(input.authUserId)

      if (existingResult.error) {
        return err(
          mapQueryError(existingResult.error, 'Failed to ensure profile.'),
        )
      }

      if (existingResult.data) {
        return ok(mapProfileRow(existingResult.data))
      }

      const timestamp = new Date().toISOString()
      const { data, error } = await client
        .schema('user_data')
        .from('profiles')
        .insert({
          auth_user_id: input.authUserId,
          display_name: input.displayName,
          avatar_url: input.avatarUrl,
          bio: input.bio,
          visibility: input.visibility,
          updated_at: timestamp,
        })
        .select(profileSelect)
        .single()

      if (error?.code === '23505') {
        const conflictLookupResult = await selectProfileByAuthUserId(
          input.authUserId,
        )

        if (conflictLookupResult.error) {
          return err(
            mapQueryError(
              conflictLookupResult.error,
              'Failed to ensure profile.',
            ),
          )
        }

        if (conflictLookupResult.data) {
          return ok(mapProfileRow(conflictLookupResult.data))
        }
      }

      if (error) {
        return err(mapQueryError(error, 'Failed to ensure profile.'))
      }

      return ok(mapProfileRow(data))
    },

    async upsertProfileByAuthUserId(input) {
      const timestamp = new Date().toISOString()

      const { data, error } = await client
        .schema('user_data')
        .from('profiles')
        .upsert(
          {
            auth_user_id: input.authUserId,
            display_name: input.displayName,
            avatar_url: input.avatarUrl,
            bio: input.bio,
            visibility: input.visibility,
            updated_at: timestamp,
          },
          {
            onConflict: 'auth_user_id',
          },
        )
        .select(profileSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to save profile.'))
      }

      return ok(mapProfileRow(data))
    },
  }
}
