import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'
import { createMatchesRepository } from './matches.repository'

describe('matches repository', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('loads one owner-scoped match record with participant rows', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('matches')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'match-1',
            },
          ])
        },
        response: {
          data: {
            id: 'match-1',
            recorded_by_profile_id: 'profile-owner',
            format_id: 'standard',
            visibility: 'private',
            status: 'completed',
            entry_source: 'manual',
            occurred_at: '2026-04-18T10:00:00.000Z',
            notes: 'Spring local.',
            created_at: '2026-04-18T10:05:00.000Z',
            updated_at: '2026-04-18T10:05:00.000Z',
          },
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('match_participants')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'match_id',
              value: ['match-1'],
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'seat_order',
              ascending: true,
            },
            {
              column: 'id',
              ascending: true,
            },
          ])
        },
        response: {
          data: [
            {
              id: 'participant-1',
              match_id: 'match-1',
              profile_id: 'profile-owner',
              deck_version_id: 'deck-version-1',
              result: 'win',
              seat_order: 1,
              notes: null,
            },
            {
              id: 'participant-2',
              match_id: 'match-1',
              profile_id: 'profile-opponent',
              deck_version_id: null,
              result: 'loss',
              seat_order: 2,
              notes: 'Friendlies after locals.',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createMatchesRepository(mock.client)
    const result = await repository.getMatchRecordById('match-1')

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'match-1',
        ownerProfileId: 'profile-owner',
        formatId: 'standard',
        visibility: 'private',
        status: 'completed',
        source: 'manual',
        playedAt: '2026-04-18T10:00:00.000Z',
        notes: 'Spring local.',
        createdAt: '2026-04-18T10:05:00.000Z',
        updatedAt: '2026-04-18T10:05:00.000Z',
        participants: [
          {
            id: 'participant-1',
            matchId: 'match-1',
            profileId: 'profile-owner',
            deckVersionId: 'deck-version-1',
            result: 'win',
            seatOrder: 1,
            notes: null,
          },
          {
            id: 'participant-2',
            matchId: 'match-1',
            profileId: 'profile-opponent',
            deckVersionId: null,
            result: 'loss',
            seatOrder: 2,
            notes: 'Friendlies after locals.',
          },
        ],
      },
    })
  })

  it('lists owner match records and groups participants by match id', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('matches')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'recorded_by_profile_id',
              value: 'profile-owner',
            },
          ])
          expect(query.orders).toEqual([
            {
              column: 'occurred_at',
              ascending: false,
            },
            {
              column: 'created_at',
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
              id: 'match-2',
              recorded_by_profile_id: 'profile-owner',
              format_id: 'standard',
              visibility: 'private',
              status: 'completed',
              entry_source: 'manual',
              occurred_at: '2026-04-18T12:00:00.000Z',
              notes: null,
              created_at: '2026-04-18T12:10:00.000Z',
              updated_at: '2026-04-18T12:10:00.000Z',
            },
            {
              id: 'match-3',
              recorded_by_profile_id: 'profile-owner',
              format_id: 'standard',
              visibility: 'friends',
              status: 'recorded',
              entry_source: 'manual',
              occurred_at: '2026-04-17T18:30:00.000Z',
              notes: 'Result still being cleaned up.',
              created_at: '2026-04-17T18:40:00.000Z',
              updated_at: '2026-04-17T18:45:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('match_participants')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'match_id',
              value: ['match-2', 'match-3'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'participant-3',
              match_id: 'match-2',
              profile_id: 'profile-owner',
              deck_version_id: 'deck-version-2',
              result: 'loss',
              seat_order: 1,
              notes: null,
            },
            {
              id: 'participant-4',
              match_id: 'match-2',
              profile_id: 'profile-opponent',
              deck_version_id: null,
              result: 'win',
              seat_order: 2,
              notes: null,
            },
            {
              id: 'participant-5',
              match_id: 'match-3',
              profile_id: 'profile-owner',
              deck_version_id: null,
              result: 'unknown',
              seat_order: 1,
              notes: null,
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createMatchesRepository(mock.client)
    const result = await repository.listMatchRecordsByOwner('profile-owner', 12)

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'match-2',
          ownerProfileId: 'profile-owner',
          formatId: 'standard',
          visibility: 'private',
          status: 'completed',
          source: 'manual',
          playedAt: '2026-04-18T12:00:00.000Z',
          notes: null,
          createdAt: '2026-04-18T12:10:00.000Z',
          updatedAt: '2026-04-18T12:10:00.000Z',
          participants: [
            {
              id: 'participant-3',
              matchId: 'match-2',
              profileId: 'profile-owner',
              deckVersionId: 'deck-version-2',
              result: 'loss',
              seatOrder: 1,
              notes: null,
            },
            {
              id: 'participant-4',
              matchId: 'match-2',
              profileId: 'profile-opponent',
              deckVersionId: null,
              result: 'win',
              seatOrder: 2,
              notes: null,
            },
          ],
        },
        {
          id: 'match-3',
          ownerProfileId: 'profile-owner',
          formatId: 'standard',
          visibility: 'friends',
          status: 'recorded',
          source: 'manual',
          playedAt: '2026-04-17T18:30:00.000Z',
          notes: 'Result still being cleaned up.',
          createdAt: '2026-04-17T18:40:00.000Z',
          updatedAt: '2026-04-17T18:45:00.000Z',
          participants: [
            {
              id: 'participant-5',
              matchId: 'match-3',
              profileId: 'profile-owner',
              deckVersionId: null,
              result: 'unknown',
              seatOrder: 1,
              notes: null,
            },
          ],
        },
      ],
    })
  })

  it('returns an empty list when the owner has no persisted matches', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: [],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createMatchesRepository(mock.client)
    const result = await repository.listMatchRecordsByOwner('profile-owner', 5)

    expect(result).toEqual({
      ok: true,
      data: [],
    })
  })

  it('lists match-history summary items with deck and opponent fallbacks', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('matches')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'recorded_by_profile_id',
              value: 'profile-owner',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'match-10',
              recorded_by_profile_id: 'profile-owner',
              format_id: 'standard',
              visibility: 'private',
              status: 'completed',
              entry_source: 'manual',
              occurred_at: '2026-04-18T12:00:00.000Z',
              notes: 'Round 1.',
              created_at: '2026-04-18T12:05:00.000Z',
              updated_at: '2026-04-18T12:05:00.000Z',
            },
            {
              id: 'match-11',
              recorded_by_profile_id: 'profile-owner',
              format_id: 'premium',
              visibility: 'private',
              status: 'completed',
              entry_source: 'manual',
              occurred_at: '2026-04-17T12:00:00.000Z',
              notes: null,
              created_at: '2026-04-17T12:05:00.000Z',
              updated_at: '2026-04-17T12:05:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('match_participants')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'match_id',
              value: ['match-10', 'match-11'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'participant-10',
              match_id: 'match-10',
              profile_id: 'profile-owner',
              deck_version_id: 'deck-version-10',
              result: 'win',
              seat_order: 1,
              notes: null,
            },
            {
              id: 'participant-11',
              match_id: 'match-10',
              profile_id: 'profile-opponent-visible',
              deck_version_id: null,
              result: 'loss',
              seat_order: 2,
              notes: null,
            },
            {
              id: 'participant-12',
              match_id: 'match-11',
              profile_id: 'profile-owner',
              deck_version_id: 'deck-version-missing',
              result: 'draw',
              seat_order: 1,
              notes: null,
            },
            {
              id: 'participant-13',
              match_id: 'match-11',
              profile_id: 'profile-opponent-hidden',
              deck_version_id: null,
              result: 'draw',
              seat_order: 2,
              notes: null,
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('deck_versions')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['deck-version-10', 'deck-version-missing'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'deck-version-10',
              deck_id: 'deck-10',
              version_number: 4,
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('decks')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['deck-10'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'deck-10',
              title: 'Keter Balance',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('visible_profiles')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['profile-opponent-visible', 'profile-opponent-hidden'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'profile-opponent-visible',
              display_name: 'Visible Rival',
              avatar_url: null,
              bio: 'Visible opponent.',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createMatchesRepository(mock.client)
    const result = await repository.listMatchHistoryItemsByOwner(
      'profile-owner',
      20,
    )

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'match-10',
          formatId: 'standard',
          status: 'completed',
          playedAt: '2026-04-18T12:00:00.000Z',
          createdAt: '2026-04-18T12:05:00.000Z',
          result: 'win',
          notes: 'Round 1.',
          ownDeck: {
            deckId: 'deck-10',
            title: 'Keter Balance',
            versionNumber: 4,
          },
          opponent: {
            profileId: 'profile-opponent-visible',
            displayName: 'Visible Rival',
            avatarUrl: null,
            bio: 'Visible opponent.',
            profileVisible: true,
          },
        },
        {
          id: 'match-11',
          formatId: 'premium',
          status: 'completed',
          playedAt: '2026-04-17T12:00:00.000Z',
          createdAt: '2026-04-17T12:05:00.000Z',
          result: 'draw',
          notes: null,
          ownDeck: {
            deckId: null,
            title: null,
            versionNumber: null,
          },
          opponent: {
            profileId: 'profile-opponent-hidden',
            displayName: null,
            avatarUrl: null,
            bio: null,
            profileVisible: false,
          },
        },
      ],
    })
  })

  it('creates an owner-owned match record with default manual source and participants', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('matches')
          expect(query.operation).toBe('insert')
          expect(query.cardinality).toBe('single')
          expect(query.values).toMatchObject({
            recorded_by_profile_id: 'profile-owner',
            format_id: 'standard',
            visibility: 'private',
            status: 'completed',
            entry_source: 'manual',
            notes: 'Weekly local round 3.',
          })
          expect(
            typeof (query.values as { occurred_at?: unknown }).occurred_at,
          ).toBe('string')
          expect(
            typeof (query.values as { updated_at?: unknown }).updated_at,
          ).toBe('string')
        },
        response: {
          data: {
            id: 'match-4',
            recorded_by_profile_id: 'profile-owner',
            format_id: 'standard',
            visibility: 'private',
            status: 'completed',
            entry_source: 'manual',
            occurred_at: '2026-04-18T15:00:00.000Z',
            notes: 'Weekly local round 3.',
            created_at: '2026-04-18T15:05:00.000Z',
            updated_at: '2026-04-18T15:05:00.000Z',
          },
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('match_participants')
          expect(query.operation).toBe('insert')
          expect(query.cardinality).toBe('many')
          expect(query.values).toEqual([
            {
              match_id: 'match-4',
              profile_id: 'profile-owner',
              deck_version_id: 'deck-version-4',
              result: 'win',
              seat_order: 1,
              notes: null,
            },
            {
              match_id: 'match-4',
              profile_id: 'profile-opponent',
              deck_version_id: null,
              result: 'loss',
              seat_order: 2,
              notes: 'Opponent from local store.',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'participant-6',
              match_id: 'match-4',
              profile_id: 'profile-owner',
              deck_version_id: 'deck-version-4',
              result: 'win',
              seat_order: 1,
              notes: null,
            },
            {
              id: 'participant-7',
              match_id: 'match-4',
              profile_id: 'profile-opponent',
              deck_version_id: null,
              result: 'loss',
              seat_order: 2,
              notes: 'Opponent from local store.',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createMatchesRepository(mock.client)
    const result = await repository.createMatchRecord({
      ownerProfileId: 'profile-owner',
      formatId: 'standard',
      playedAt: '2026-04-18T15:00:00.000Z',
      notes: 'Weekly local round 3.',
      participants: [
        {
          profileId: 'profile-owner',
          deckVersionId: 'deck-version-4',
          result: 'win',
          seatOrder: 1,
        },
        {
          profileId: 'profile-opponent',
          result: 'loss',
          seatOrder: 2,
          notes: 'Opponent from local store.',
        },
      ],
    })

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'match-4',
        ownerProfileId: 'profile-owner',
        formatId: 'standard',
        visibility: 'private',
        status: 'completed',
        source: 'manual',
        playedAt: '2026-04-18T15:00:00.000Z',
        notes: 'Weekly local round 3.',
        createdAt: '2026-04-18T15:05:00.000Z',
        updatedAt: '2026-04-18T15:05:00.000Z',
        participants: [
          {
            id: 'participant-6',
            matchId: 'match-4',
            profileId: 'profile-owner',
            deckVersionId: 'deck-version-4',
            result: 'win',
            seatOrder: 1,
            notes: null,
          },
          {
            id: 'participant-7',
            matchId: 'match-4',
            profileId: 'profile-opponent',
            deckVersionId: null,
            result: 'loss',
            seatOrder: 2,
            notes: 'Opponent from local store.',
          },
        ],
      },
    })
  })

  it('cleans up the match row when participant persistence fails', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: {
            id: 'match-5',
            recorded_by_profile_id: 'profile-owner',
            format_id: 'standard',
            visibility: 'private',
            status: 'completed',
            entry_source: 'manual',
            occurred_at: '2026-04-18T16:00:00.000Z',
            notes: null,
            created_at: '2026-04-18T16:05:00.000Z',
            updated_at: '2026-04-18T16:05:00.000Z',
          },
          error: null,
        },
      },
      {
        response: {
          data: null,
          error: {
            code: '23503',
            message: 'insert or update on table "match_participants"',
            details:
              'Key (deck_version_id) is not present in table "deck_versions".',
          },
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('social')
          expect(query.table).toBe('matches')
          expect(query.operation).toBe('delete')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'match-5',
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

    const repository = createMatchesRepository(mock.client)
    const result = await repository.createMatchRecord({
      ownerProfileId: 'profile-owner',
      formatId: 'standard',
      participants: [
        {
          profileId: 'profile-owner',
          deckVersionId: 'missing-deck-version',
          result: 'unknown',
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to create match participants.',
        details:
          'Key (deck_version_id) is not present in table "deck_versions".',
      },
    })
  })
})
