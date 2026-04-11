import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'
import { createProfilesRepository } from './profiles.repository'

describe('profiles repository', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('returns null for a missing auth-bound profile', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('profiles')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'auth_user_id',
              value: 'auth-user-1',
            },
          ])
        },
        response: {
          data: null,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createProfilesRepository(mock.client)
    const result = await repository.getProfileByAuthUserId('auth-user-1')

    expect(result).toEqual({
      ok: true,
      data: null,
    })
  })

  it('returns a public profile read model by id', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('public_profiles')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'profile-public-1',
            },
          ])
        },
        response: {
          data: {
            id: 'profile-public-1',
            display_name: 'Azure Pilot',
            bio: 'Public pilot bio.',
            avatar_url: 'https://images.example/avatar.png',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createProfilesRepository(mock.client)
    const result = await repository.getPublicProfileById('profile-public-1')

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'profile-public-1',
        displayName: 'Azure Pilot',
        avatarUrl: 'https://images.example/avatar.png',
        bio: 'Public pilot bio.',
      },
    })
  })

  it('returns null when a public profile is missing', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('public_profiles')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'profile-missing',
            },
          ])
        },
        response: {
          data: null,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createProfilesRepository(mock.client)
    const result = await repository.getPublicProfileById('profile-missing')

    expect(result).toEqual({
      ok: true,
      data: null,
    })
  })

  it('upserts profile fields and returns the mapped profile record', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('profiles')
          expect(query.operation).toBe('upsert')
          expect(query.onConflict).toBe('auth_user_id')
          expect(query.cardinality).toBe('single')

          expect(query.values).toMatchObject({
            auth_user_id: 'auth-user-1',
            display_name: 'Azure Pilot',
            avatar_url: 'https://images.example/avatar.png',
            bio: 'Testing profile persistence.',
            visibility: 'private',
          })
        },
        response: {
          data: {
            id: 'profile-1',
            username: null,
            display_name: 'Azure Pilot',
            bio: 'Testing profile persistence.',
            avatar_url: null,
            visibility: 'private',
            created_at: '2026-04-08T00:00:00.000Z',
            updated_at: '2026-04-08T01:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createProfilesRepository(mock.client)
    const result = await repository.upsertProfileByAuthUserId({
      authUserId: 'auth-user-1',
      displayName: 'Azure Pilot',
      avatarUrl: 'https://images.example/avatar.png',
      bio: 'Testing profile persistence.',
      visibility: 'private',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'profile-1',
        username: null,
        displayName: 'Azure Pilot',
        bio: 'Testing profile persistence.',
        avatarUrl: null,
        visibility: 'private',
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T01:00:00.000Z',
      },
    })
  })

  it('creates a missing profile through ensureProfileByAuthUserId', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.operation).toBe('select')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'auth_user_id',
              value: 'auth-user-2',
            },
          ])
        },
        response: {
          data: null,
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.operation).toBe('insert')
          expect(query.cardinality).toBe('single')
          expect(query.values).toMatchObject({
            auth_user_id: 'auth-user-2',
            display_name: 'Nova Player',
            avatar_url: null,
            bio: null,
            visibility: 'private',
          })
        },
        response: {
          data: {
            id: 'profile-2',
            username: null,
            display_name: 'Nova Player',
            bio: null,
            avatar_url: null,
            visibility: 'private',
            created_at: '2026-04-08T00:00:00.000Z',
            updated_at: '2026-04-08T01:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createProfilesRepository(mock.client)
    const result = await repository.ensureProfileByAuthUserId({
      authUserId: 'auth-user-2',
      displayName: 'Nova Player',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'profile-2',
        username: null,
        displayName: 'Nova Player',
        bio: null,
        avatarUrl: null,
        visibility: 'private',
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T01:00:00.000Z',
      },
    })
  })

  it('treats duplicate-safe ensure as returning the existing profile', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: null,
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.operation).toBe('insert')
        },
        response: {
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint',
            details: 'Key (auth_user_id)=(auth-user-3) already exists.',
          },
        },
      },
      {
        assert(query) {
          expect(query.operation).toBe('select')
          expect(query.cardinality).toBe('maybeSingle')
        },
        response: {
          data: {
            id: 'profile-3',
            username: null,
            display_name: 'Recovered Player',
            bio: null,
            avatar_url: null,
            visibility: 'private',
            created_at: '2026-04-08T00:00:00.000Z',
            updated_at: '2026-04-08T01:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createProfilesRepository(mock.client)
    const result = await repository.ensureProfileByAuthUserId({
      authUserId: 'auth-user-3',
      displayName: 'Recovered Player',
      avatarUrl: null,
      bio: null,
      visibility: 'private',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'profile-3',
        username: null,
        displayName: 'Recovered Player',
        bio: null,
        avatarUrl: null,
        visibility: 'private',
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T01:00:00.000Z',
      },
    })
  })
})
