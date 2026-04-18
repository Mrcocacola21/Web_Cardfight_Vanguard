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
const publicProfileSelect = 'id, display_name, avatar_url, bio'
const publicProfileSearchMinTokenLength = 2
const publicProfileSearchMaxTokenCount = 4
const publicProfileSearchMaxLimit = 50

export interface ProfilesRepository {
  getProfileById(id: string): Promise<RepositoryResult<ProfileRecord | null>>
  getPublicProfileById(
    id: string,
  ): Promise<RepositoryResult<PublicProfileRecord | null>>
  searchPublicProfiles(
    searchText: string,
    limit: number,
  ): Promise<RepositoryResult<readonly PublicProfileRecord[]>>
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

  function normalizePublicProfileSearchTokens(searchText: string) {
    return searchText
      .trim()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= publicProfileSearchMinTokenLength)
      .slice(0, publicProfileSearchMaxTokenCount)
  }

  function normalizePublicProfileSearchLimit(limit: number) {
    if (!Number.isFinite(limit)) {
      return 1
    }

    return Math.max(1, Math.min(Math.trunc(limit), publicProfileSearchMaxLimit))
  }

  function escapeIlikePattern(value: string) {
    return value
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')
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
        .from('public_profiles')
        .select(publicProfileSelect)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load public profile.'))
      }

      return ok(data ? mapPublicProfileRow(data) : null)
    },

    async searchPublicProfiles(searchText, limit) {
      const tokens = normalizePublicProfileSearchTokens(searchText)

      if (tokens.length === 0) {
        return ok([])
      }

      const normalizedLimit = normalizePublicProfileSearchLimit(limit)
      let query = client
        .schema('user_data')
        .from('public_profiles')
        .select(publicProfileSelect)

      for (const token of tokens) {
        query = query.ilike('display_name', `%${escapeIlikePattern(token)}%`)
      }

      const { data, error } = await query
        .order('display_name', {
          ascending: true,
        })
        .range(0, normalizedLimit - 1)

      if (error) {
        return err(mapQueryError(error, 'Failed to search public profiles.'))
      }

      return ok((data ?? []).map(mapPublicProfileRow))
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
