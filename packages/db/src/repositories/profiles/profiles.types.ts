export type ProfileVisibility = 'public' | 'private'

export interface ProfileRecord {
  readonly id: string
  readonly username: string | null
  readonly displayName: string
  readonly bio: string | null
  readonly avatarUrl: string | null
  readonly visibility: ProfileVisibility
  readonly createdAt: string
  readonly updatedAt: string
}

export interface PublicProfileRecord {
  readonly id: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
}

export interface UpsertProfileByAuthUserIdInput {
  readonly authUserId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly visibility: ProfileVisibility
}

export interface EnsureProfileByAuthUserIdInput {
  readonly authUserId: string
  readonly displayName: string
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly visibility: ProfileVisibility
}
