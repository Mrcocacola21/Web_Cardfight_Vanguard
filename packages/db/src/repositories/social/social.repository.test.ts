import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'
import { createSocialRepository } from './social.repository'

describe('social repository', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('loads an existing direct friend relationship by profile pair', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('friend_relationships')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'requester_profile_id',
              value: 'profile-1',
            },
            {
              type: 'eq',
              column: 'addressee_profile_id',
              value: 'profile-2',
            },
          ])
        },
        response: {
          data: {
            id: 'friend-1',
            requester_profile_id: 'profile-1',
            addressee_profile_id: 'profile-2',
            status: 'pending',
            requested_at: '2026-04-18T10:00:00.000Z',
            responded_at: null,
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.getFriendRelationshipBetweenProfiles(
      'profile-1',
      'profile-2',
    )

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friend-1',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })
  })

  it('checks the reverse pair when the direct direction is missing', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: null,
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'requester_profile_id',
              value: 'profile-2',
            },
            {
              type: 'eq',
              column: 'addressee_profile_id',
              value: 'profile-1',
            },
          ])
        },
        response: {
          data: {
            id: 'friend-2',
            requester_profile_id: 'profile-2',
            addressee_profile_id: 'profile-1',
            status: 'accepted',
            requested_at: '2026-04-18T10:00:00.000Z',
            responded_at: '2026-04-18T11:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.getFriendRelationshipBetweenProfiles(
      'profile-1',
      'profile-2',
    )

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friend-2',
        requesterProfileId: 'profile-2',
        addresseeProfileId: 'profile-1',
        status: 'accepted',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: '2026-04-18T11:00:00.000Z',
      },
    })
  })

  it('loads a friend request by id', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('friend_relationships')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'friend-3',
            },
          ])
        },
        response: {
          data: {
            id: 'friend-3',
            requester_profile_id: 'profile-1',
            addressee_profile_id: 'profile-2',
            status: 'pending',
            requested_at: '2026-04-18T10:00:00.000Z',
            responded_at: null,
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.getFriendRequestById('friend-3')

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friend-3',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })
  })

  it('creates a pending friend request', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('friend_relationships')
          expect(query.operation).toBe('insert')
          expect(query.cardinality).toBe('single')
          expect(query.values).toEqual({
            requester_profile_id: 'profile-1',
            addressee_profile_id: 'profile-2',
            status: 'pending',
          })
        },
        response: {
          data: {
            id: 'friend-4',
            requester_profile_id: 'profile-1',
            addressee_profile_id: 'profile-2',
            status: 'pending',
            requested_at: '2026-04-18T10:00:00.000Z',
            responded_at: null,
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.createFriendRequest({
      requesterProfileId: 'profile-1',
      addresseeProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friend-4',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'pending',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: null,
      },
    })
  })

  it('maps duplicate insert conflicts into repository conflict errors', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: null,
          error: {
            code: '23505',
            message: 'duplicate key value violates unique constraint',
            details: 'Key pair already exists.',
          },
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.createFriendRequest({
      requesterProfileId: 'profile-1',
      addresseeProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'conflict',
        message: 'Failed to create friend request.',
        details: 'Key pair already exists.',
      },
    })
  })

  it('accepts a pending friend request for the recipient', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('friend_relationships')
          expect(query.operation).toBe('update')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.values).toMatchObject({
            status: 'accepted',
          })
          expect(
            typeof (query.values as { responded_at?: unknown }).responded_at,
          ).toBe('string')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'friend-5',
            },
            {
              type: 'eq',
              column: 'addressee_profile_id',
              value: 'profile-2',
            },
            {
              type: 'eq',
              column: 'status',
              value: 'pending',
            },
          ])
        },
        response: {
          data: {
            id: 'friend-5',
            requester_profile_id: 'profile-1',
            addressee_profile_id: 'profile-2',
            status: 'accepted',
            requested_at: '2026-04-18T10:00:00.000Z',
            responded_at: '2026-04-18T11:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.acceptFriendRequest({
      requestId: 'friend-5',
      recipientProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friend-5',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'accepted',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: '2026-04-18T11:00:00.000Z',
      },
    })
  })

  it('declines a pending friend request for the recipient', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.operation).toBe('update')
          expect(query.values).toMatchObject({
            status: 'declined',
          })
          expect(
            typeof (query.values as { responded_at?: unknown }).responded_at,
          ).toBe('string')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'friend-6',
            },
            {
              type: 'eq',
              column: 'addressee_profile_id',
              value: 'profile-2',
            },
            {
              type: 'eq',
              column: 'status',
              value: 'pending',
            },
          ])
        },
        response: {
          data: {
            id: 'friend-6',
            requester_profile_id: 'profile-1',
            addressee_profile_id: 'profile-2',
            status: 'declined',
            requested_at: '2026-04-18T10:00:00.000Z',
            responded_at: '2026-04-18T11:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.declineFriendRequest({
      requestId: 'friend-6',
      recipientProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friend-6',
        requesterProfileId: 'profile-1',
        addresseeProfileId: 'profile-2',
        status: 'declined',
        requestedAt: '2026-04-18T10:00:00.000Z',
        respondedAt: '2026-04-18T11:00:00.000Z',
      },
    })
  })

  it('loads a normalized friendship edge by profile pair', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('friendships')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'first_profile_id',
              value: 'profile-1',
            },
            {
              type: 'eq',
              column: 'second_profile_id',
              value: 'profile-2',
            },
          ])
        },
        response: {
          data: {
            id: 'friendship-1',
            first_profile_id: 'profile-1',
            second_profile_id: 'profile-2',
            friend_request_id: 'friend-5',
            created_at: '2026-04-18T11:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.getFriendshipBetweenProfiles(
      'profile-2',
      'profile-1',
    )

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friendship-1',
        firstProfileId: 'profile-1',
        secondProfileId: 'profile-2',
        friendRequestId: 'friend-5',
        createdAt: '2026-04-18T11:00:00.000Z',
      },
    })
  })

  it('removes an active friendship edge by normalized pair and id', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('friendships')
          expect(query.operation).toBe('delete')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'friendship-2',
            },
            {
              type: 'eq',
              column: 'first_profile_id',
              value: 'profile-1',
            },
            {
              type: 'eq',
              column: 'second_profile_id',
              value: 'profile-2',
            },
          ])
        },
        response: {
          data: {
            id: 'friendship-2',
            first_profile_id: 'profile-1',
            second_profile_id: 'profile-2',
            friend_request_id: 'friend-8',
            created_at: '2026-04-18T11:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.removeFriendship({
      friendshipId: 'friendship-2',
      firstProfileId: 'profile-1',
      secondProfileId: 'profile-2',
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'friendship-2',
        firstProfileId: 'profile-1',
        secondProfileId: 'profile-2',
        friendRequestId: 'friend-8',
        createdAt: '2026-04-18T11:00:00.000Z',
      },
    })
  })

  it('lists active friendships for the current owner profile', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('active_friendships_overview')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'friends_since',
              ascending: false,
            },
          ])
          expect(query.range).toEqual({
            from: 0,
            to: 7,
          })
        },
        response: {
          data: [
            {
              friendship_id: 'friendship-3',
              friends_since: '2026-04-18T13:00:00.000Z',
              friend_profile_id: 'profile-2',
              friend_display_name: 'Nova Player',
              friend_avatar_url: null,
              friend_bio: 'Public deck enjoyer.',
              friend_profile_visible: true,
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.listActiveFriendships('profile-1', 8)

    expect(result).toEqual({
      ok: true,
      data: [
        {
          friendshipId: 'friendship-3',
          friendsSince: '2026-04-18T13:00:00.000Z',
          friendProfileId: 'profile-2',
          friendDisplayName: 'Nova Player',
          friendAvatarUrl: null,
          friendBio: 'Public deck enjoyer.',
          friendProfileVisible: true,
        },
      ],
    })
  })

  it('supports offset pagination for active friendships', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.range).toEqual({
            from: 50,
            to: 74,
          })
        },
        response: {
          data: [],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.listActiveFriendships('profile-1', 25, 50)

    expect(result).toEqual({
      ok: true,
      data: [],
    })
  })

  it('lists incoming pending friend requests for the current recipient profile', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('incoming_pending_friend_requests')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'recipient_profile_id',
              value: 'profile-2',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'requested_at',
              ascending: false,
            },
          ])
          expect(query.range).toEqual({
            from: 0,
            to: 11,
          })
        },
        response: {
          data: [
            {
              request_id: 'friend-7',
              requested_at: '2026-04-18T12:00:00.000Z',
              requester_profile_id: 'profile-1',
              recipient_profile_id: 'profile-2',
              requester_display_name: 'Azure Pilot',
              requester_avatar_url: 'https://images.example/avatar.png',
              requester_bio: 'Ready to test Brandt Gate.',
              requester_profile_visible: true,
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.listIncomingPendingFriendRequests(
      'profile-2',
      12,
    )

    expect(result).toEqual({
      ok: true,
      data: [
        {
          requestId: 'friend-7',
          requestedAt: '2026-04-18T12:00:00.000Z',
          requesterProfileId: 'profile-1',
          recipientProfileId: 'profile-2',
          requesterDisplayName: 'Azure Pilot',
          requesterAvatarUrl: 'https://images.example/avatar.png',
          requesterBio: 'Ready to test Brandt Gate.',
          requesterProfileVisible: true,
        },
      ],
    })
  })

  it('lists outgoing pending friend requests for the current requester profile', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('outgoing_pending_friend_requests')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'requester_profile_id',
              value: 'profile-1',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'requested_at',
              ascending: false,
            },
          ])
          expect(query.range).toEqual({
            from: 0,
            to: 5,
          })
        },
        response: {
          data: [
            {
              request_id: 'friend-8',
              requested_at: '2026-04-18T14:00:00.000Z',
              requester_profile_id: 'profile-1',
              recipient_profile_id: 'profile-3',
              recipient_display_name: 'Stealth Rival',
              recipient_avatar_url: null,
              recipient_bio: null,
              recipient_profile_visible: false,
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createSocialRepository(mock.client)
    const result = await repository.listOutgoingPendingFriendRequests(
      'profile-1',
      6,
    )

    expect(result).toEqual({
      ok: true,
      data: [
        {
          requestId: 'friend-8',
          requestedAt: '2026-04-18T14:00:00.000Z',
          requesterProfileId: 'profile-1',
          recipientProfileId: 'profile-3',
          recipientDisplayName: 'Stealth Rival',
          recipientAvatarUrl: null,
          recipientBio: null,
          recipientProfileVisible: false,
        },
      ],
    })
  })
})
