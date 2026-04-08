import { describe, expect, it } from 'vitest'

import { mapProfileRow } from './profiles.mappers'

describe('profile mappers', () => {
  it('maps app-facing profile fields without auth internals', () => {
    const mapped = mapProfileRow({
      id: 'profile-1',
      username: 'dev_user',
      display_name: 'Dev User',
      bio: 'Testing profile read model',
      avatar_url: null,
      visibility: 'public',
      created_at: '2026-04-08T00:00:00.000Z',
      updated_at: '2026-04-08T01:00:00.000Z',
    })

    expect(mapped).toEqual({
      id: 'profile-1',
      username: 'dev_user',
      displayName: 'Dev User',
      bio: 'Testing profile read model',
      avatarUrl: null,
      visibility: 'public',
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T01:00:00.000Z',
    })

    expect('authUserId' in mapped).toBe(false)
  })

  it('normalizes legacy non-public visibility values to private', () => {
    const mapped = mapProfileRow({
      id: 'profile-2',
      username: null,
      display_name: 'Legacy User',
      bio: null,
      avatar_url: null,
      visibility: 'friends',
      created_at: '2026-04-08T00:00:00.000Z',
      updated_at: '2026-04-08T01:00:00.000Z',
    })

    expect(mapped.visibility).toBe('private')
  })
})
