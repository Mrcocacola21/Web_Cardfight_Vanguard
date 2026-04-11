import type { Tables } from '../../generated/database.types'

import type {
  ProfileRecord,
  ProfileVisibility,
  PublicProfileRecord,
} from './profiles.types'

type ProfileRow = Pick<
  Tables<{ schema: 'user_data' }, 'profiles'>,
  | 'id'
  | 'username'
  | 'display_name'
  | 'bio'
  | 'avatar_url'
  | 'visibility'
  | 'created_at'
  | 'updated_at'
>

type PublicProfileRow = Pick<
  Tables<{ schema: 'user_data' }, 'public_profiles'>,
  'id' | 'display_name' | 'avatar_url' | 'bio'
>

export function mapProfileRow(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    visibility: normalizeProfileVisibility(row.visibility),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapPublicProfileRow(
  row: PublicProfileRow,
): PublicProfileRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
  }
}

function normalizeProfileVisibility(value: string): ProfileVisibility {
  return value === 'public' ? 'public' : 'private'
}
