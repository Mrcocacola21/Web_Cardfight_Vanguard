import type { Tables } from '../../generated/database.types'

import type {
  ProfileRecord,
  ProfileVisibility,
  PublicProfileRecord,
  VisibleProfileRecord,
} from './profiles.types'

type ProfileRow = Pick<
  Tables<{ schema: 'user_data' }, 'profiles'>,
  | 'id'
  | 'username'
  | 'display_name'
  | 'bio'
  | 'avatar_url'
  | 'visibility'
  | 'bio_visibility'
  | 'created_at'
  | 'updated_at'
>

type PublicProfileRow = Pick<
  Tables<{ schema: 'user_data' }, 'public_profiles'>,
  'id' | 'display_name' | 'avatar_url' | 'bio'
>

type VisibleProfileRow = Pick<
  Tables<{ schema: 'user_data' }, 'visible_profiles'>,
  | 'id'
  | 'display_name'
  | 'avatar_url'
  | 'bio'
  | 'visibility'
  | 'bio_visibility'
  | 'bio_visible'
>

export function mapProfileRow(row: ProfileRow): ProfileRecord {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    visibility: normalizeProfileVisibility(row.visibility),
    bioVisibility: normalizeProfileVisibility(row.bio_visibility),
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

export function mapVisibleProfileRow(
  row: VisibleProfileRow,
): VisibleProfileRecord {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    visibility: normalizeProfileVisibility(row.visibility),
    bioVisibility: normalizeProfileVisibility(row.bio_visibility),
    bioVisible: row.bio_visible,
  }
}

function normalizeProfileVisibility(value: string): ProfileVisibility {
  switch (value) {
    case 'public':
    case 'friends':
      return value
    default:
      return 'private'
  }
}
