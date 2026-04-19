import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'
import { createDecksRepository } from './decks.repository'

function buildDeckListSummaryRow(overrides = {}) {
  return {
    deck_id: 'deck-1',
    owner_profile_id: 'profile-1',
    title: 'Azure Standard Deck',
    description: 'Current persisted Standard list.',
    tags: ['tempo'],
    is_favorite: true,
    visibility: 'private',
    archived_at: null,
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T01:00:00.000Z',
    format_id: 'standard',
    format_display_name: 'Standard',
    format_description: 'D-era baseline profile',
    current_version_id: 'version-1',
    current_version_number: 2,
    main_count: 46,
    ride_count: 4,
    g_count: 0,
    ...overrides,
  }
}

function buildDeckDetailAggregateRow(overrides = {}) {
  return {
    deck_id: 'deck-1',
    owner_profile_id: 'profile-1',
    title: 'Azure Standard Deck',
    description: 'Current persisted Standard list.',
    tags: ['tempo'],
    is_favorite: true,
    visibility: 'private',
    archived_at: null,
    created_at: '2026-04-08T00:00:00.000Z',
    updated_at: '2026-04-08T01:00:00.000Z',
    format_id: 'standard',
    format_display_name: 'Standard',
    format_description: 'D-era baseline profile',
    current_version_id: 'version-1',
    current_version_number: 2,
    current_version_created_by_profile_id: 'profile-1',
    current_version_note: 'updated ride line',
    current_version_created_at: '2026-04-08T01:00:00.000Z',
    current_version_cards: [
      {
        sectionKey: 'main',
        cardEntityId: 'card-1',
        canonicalKey: 'card.azure-vanguard-dragon',
        name: 'Azure Vanguard Dragon',
        grade: 3,
        cardType: 'normal-unit',
        triggerType: null,
        quantity: 46,
      },
      {
        sectionKey: 'ride',
        cardEntityId: 'card-2',
        canonicalKey: 'card.azure-vanguard-rookie',
        name: 'Azure Vanguard Rookie',
        grade: 0,
        cardType: 'normal-unit',
        triggerType: null,
        quantity: 4,
      },
    ],
    has_missing_card_entity: false,
    ...overrides,
  }
}

describe('decks repository', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('lists owner decks with explicit format attachment and section counts', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('list_deck_summaries')
          expect(query.operation).toBe('rpc')
          expect(query.cardinality).toBe('many')
          expect(query.values).toEqual({
            read_owner_profile_id: 'profile-1',
          })
        },
        response: {
          data: [buildDeckListSummaryRow()],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.listDecksByOwner('profile-1')

    expect(result).toEqual({
      ok: true,
      data: [
        {
          id: 'deck-1',
          ownerProfileId: 'profile-1',
          title: 'Azure Standard Deck',
          description: 'Current persisted Standard list.',
          tags: ['tempo'],
          isFavorite: true,
          visibility: 'private',
          archivedAt: null,
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T01:00:00.000Z',
          format: {
            id: 'standard',
            displayName: 'Standard',
            description: 'D-era baseline profile',
          },
          currentVersionId: 'version-1',
          currentVersionNumber: 2,
          totalCards: 50,
          sectionCounts: {
            main: 46,
            ride: 4,
            g: 0,
          },
        },
      ],
    })
  })

  it('loads deck detail with canonical card-based sections', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('get_deck_detail_aggregate')
          expect(query.operation).toBe('rpc')
          expect(query.cardinality).toBe('maybeSingle')
          expect(query.values).toEqual({
            read_deck_id: 'deck-1',
          })
        },
        response: {
          data: buildDeckDetailAggregateRow(),
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.getDeckDetailById('deck-1')

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'deck-1',
        ownerProfileId: 'profile-1',
        title: 'Azure Standard Deck',
        description: 'Current persisted Standard list.',
        tags: ['tempo'],
        isFavorite: true,
        visibility: 'private',
        archivedAt: null,
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T01:00:00.000Z',
        format: {
          id: 'standard',
          displayName: 'Standard',
          description: 'D-era baseline profile',
        },
        currentVersionId: 'version-1',
        currentVersion: {
          id: 'version-1',
          deckId: 'deck-1',
          versionNumber: 2,
          createdByProfileId: 'profile-1',
          versionNote: 'updated ride line',
          createdAt: '2026-04-08T01:00:00.000Z',
          totalCards: 50,
          sectionCounts: {
            main: 46,
            ride: 4,
            g: 0,
          },
          cards: [
            {
              sectionKey: 'main',
              cardEntityId: 'card-1',
              canonicalKey: 'card.azure-vanguard-dragon',
              name: 'Azure Vanguard Dragon',
              grade: 3,
              cardType: 'normal-unit',
              triggerType: null,
              quantity: 46,
            },
            {
              sectionKey: 'ride',
              cardEntityId: 'card-2',
              canonicalKey: 'card.azure-vanguard-rookie',
              name: 'Azure Vanguard Rookie',
              grade: 0,
              cardType: 'normal-unit',
              triggerType: null,
              quantity: 4,
            },
          ],
          sections: [
            {
              key: 'main',
              totalCards: 46,
              cards: [
                {
                  sectionKey: 'main',
                  cardEntityId: 'card-1',
                  canonicalKey: 'card.azure-vanguard-dragon',
                  name: 'Azure Vanguard Dragon',
                  grade: 3,
                  cardType: 'normal-unit',
                  triggerType: null,
                  quantity: 46,
                },
              ],
            },
            {
              key: 'ride',
              totalCards: 4,
              cards: [
                {
                  sectionKey: 'ride',
                  cardEntityId: 'card-2',
                  canonicalKey: 'card.azure-vanguard-rookie',
                  name: 'Azure Vanguard Rookie',
                  grade: 0,
                  cardType: 'normal-unit',
                  triggerType: null,
                  quantity: 4,
                },
              ],
            },
            {
              key: 'g',
              totalCards: 0,
              cards: [],
            },
          ],
        },
      },
    })
  })

  it('fails list reads when the dense payload references a missing format', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: [
            buildDeckListSummaryRow({
              format_display_name: null,
              format_description: null,
            }),
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.listDecksByOwner('profile-1')

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to resolve the attached deck format.',
        details: 'Deck deck-1 references missing format standard.',
      },
    })
  })

  it('keeps stale current version pointers as null detail versions', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: buildDeckDetailAggregateRow({
            current_version_number: null,
            current_version_created_by_profile_id: null,
            current_version_created_at: null,
            current_version_note: null,
            current_version_cards: [],
          }),
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.getDeckDetailById('deck-1')

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'deck-1',
        ownerProfileId: 'profile-1',
        title: 'Azure Standard Deck',
        description: 'Current persisted Standard list.',
        tags: ['tempo'],
        isFavorite: true,
        visibility: 'private',
        archivedAt: null,
        createdAt: '2026-04-08T00:00:00.000Z',
        updatedAt: '2026-04-08T01:00:00.000Z',
        format: {
          id: 'standard',
          displayName: 'Standard',
          description: 'D-era baseline profile',
        },
        currentVersionId: 'version-1',
        currentVersion: null,
      },
    })
  })

  it('fails detail reads when the dense payload references a missing format', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: buildDeckDetailAggregateRow({
            format_display_name: null,
            format_description: null,
          }),
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.getDeckDetailById('deck-1')

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to resolve the attached deck format.',
        details: 'Deck deck-1 references missing format standard.',
      },
    })
  })

  it('fails detail reads when the dense payload reports missing card entities', async () => {
    const mock = createSequentialMockDbClient([
      {
        response: {
          data: buildDeckDetailAggregateRow({
            has_missing_card_entity: true,
          }),
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.getDeckDetailById('deck-1')

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to resolve a canonical card for the deck.',
        details: 'Deck version version-1 references a missing card entity.',
      },
    })
  })

  it('saves a new deck as the first persisted versioned aggregate', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('save_deck_aggregate')
          expect(query.operation).toBe('rpc')
          expect(query.cardinality).toBe('single')
          expect(query.values).toEqual({
            save_deck_id: null,
            save_owner_profile_id: 'profile-1',
            save_format_id: 'standard',
            save_title: 'New Bastion Deck',
            save_description: 'Fresh draft',
            save_tags: ['tempo', 'ranked'],
            save_is_favorite: true,
            save_visibility: null,
            save_archived_at: null,
            save_version_note: 'initial draft',
            save_cards: [
              {
                section_key: 'main',
                card_entity_id: 'card-1',
                quantity: 4,
              },
              {
                section_key: 'ride',
                card_entity_id: 'card-2',
                quantity: 1,
              },
            ],
          })
        },
        response: {
          data: {
            deck_id: 'deck-2',
            owner_profile_id: 'profile-1',
            format_id: 'standard',
            title: 'New Bastion Deck',
            description: 'Fresh draft',
            tags: ['tempo', 'ranked'],
            is_favorite: true,
            visibility: 'private',
            archived_at: null,
            created_at: '2026-04-10T10:00:00.000Z',
            updated_at: '2026-04-10T10:05:01.000Z',
            current_version_id: 'version-1',
            current_version_number: 1,
            current_version_created_at: '2026-04-10T10:05:00.000Z',
            current_version_note: 'initial draft',
            current_version_created_by_profile_id: 'profile-1',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.saveDeck({
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'New Bastion Deck',
      description: 'Fresh draft',
      tags: ['tempo', 'ranked'],
      isFavorite: true,
      versionNote: 'initial draft',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'card-1',
          quantity: 4,
        },
        {
          sectionKey: 'ride',
          cardEntityId: 'card-2',
          quantity: 1,
        },
      ],
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error('Expected saveDeck to succeed for a new deck.')
    }

    expect(result.data).toEqual({
      id: 'deck-2',
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'New Bastion Deck',
      description: 'Fresh draft',
      tags: ['tempo', 'ranked'],
      isFavorite: true,
      visibility: 'private',
      archivedAt: null,
      createdAt: '2026-04-10T10:00:00.000Z',
      updatedAt: '2026-04-10T10:05:01.000Z',
      currentVersion: {
        id: 'version-1',
        deckId: 'deck-2',
        versionNumber: 1,
        createdByProfileId: 'profile-1',
        versionNote: 'initial draft',
        createdAt: '2026-04-10T10:05:00.000Z',
        cards: [
          {
            sectionKey: 'main',
            cardEntityId: 'card-1',
            quantity: 4,
          },
          {
            sectionKey: 'ride',
            cardEntityId: 'card-2',
            quantity: 1,
          },
        ],
      },
    })
  })

  it('saves an existing deck by appending a new current version', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('save_deck_aggregate')
          expect(query.operation).toBe('rpc')
          expect(query.cardinality).toBe('single')
          expect(query.values).toEqual({
            save_deck_id: 'deck-1',
            save_owner_profile_id: 'profile-1',
            save_format_id: 'premium',
            save_title: 'Bastion Refined',
            save_description: 'Updated description',
            save_tags: ['refined', 'premium'],
            save_is_favorite: true,
            save_visibility: null,
            save_archived_at: null,
            save_version_note: 'refined ride line',
            save_cards: [
              {
                section_key: 'main',
                card_entity_id: 'card-3',
                quantity: 46,
              },
              {
                section_key: 'ride',
                card_entity_id: 'card-4',
                quantity: 4,
              },
            ],
          })
        },
        response: {
          data: {
            deck_id: 'deck-1',
            owner_profile_id: 'profile-1',
            format_id: 'premium',
            title: 'Bastion Refined',
            description: 'Updated description',
            tags: ['refined', 'premium'],
            is_favorite: true,
            visibility: 'private',
            archived_at: null,
            created_at: '2026-04-08T00:00:00.000Z',
            updated_at: '2026-04-10T12:00:01.000Z',
            current_version_id: 'version-3',
            current_version_number: 3,
            current_version_created_at: '2026-04-10T12:00:00.000Z',
            current_version_note: 'refined ride line',
            current_version_created_by_profile_id: 'profile-1',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.saveDeck({
      deckId: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'premium',
      title: 'Bastion Refined',
      description: 'Updated description',
      tags: ['refined', 'premium'],
      isFavorite: true,
      versionNote: 'refined ride line',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'card-3',
          quantity: 46,
        },
        {
          sectionKey: 'ride',
          cardEntityId: 'card-4',
          quantity: 4,
        },
      ],
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error('Expected saveDeck to succeed for an existing deck.')
    }

    expect(result.data).toEqual({
      id: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'premium',
      title: 'Bastion Refined',
      description: 'Updated description',
      tags: ['refined', 'premium'],
      isFavorite: true,
      visibility: 'private',
      archivedAt: null,
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-10T12:00:01.000Z',
      currentVersion: {
        id: 'version-3',
        deckId: 'deck-1',
        versionNumber: 3,
        createdByProfileId: 'profile-1',
        versionNote: 'refined ride line',
        createdAt: '2026-04-10T12:00:00.000Z',
        cards: [
          {
            sectionKey: 'main',
            cardEntityId: 'card-3',
            quantity: 46,
          },
          {
            sectionKey: 'ride',
            cardEntityId: 'card-4',
            quantity: 4,
          },
        ],
      },
    })
  })

  it('maps atomic save not-found failures without issuing cleanup deletes', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('save_deck_aggregate')
          expect(query.operation).toBe('rpc')
          expect(query.cardinality).toBe('single')
          expect(query.values).toMatchObject({
            save_deck_id: 'deck-missing',
            save_owner_profile_id: 'profile-1',
          })
        },
        response: {
          data: null,
          error: {
            code: 'P0002',
            message: 'Deck not found.',
            details: 'Deck deck-missing could not be loaded for atomic save.',
          },
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createDecksRepository(mock.client)
    const result = await repository.saveDeck({
      deckId: 'deck-missing',
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'Missing Deck',
      description: null,
      tags: [],
      isFavorite: false,
      versionNote: null,
      cards: [],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'conflict',
        message:
          'Failed to save deck because the persisted deck no longer exists.',
        details: 'Deck deck-missing could not be loaded for atomic save.',
      },
    })
  })

  it('deletes a persisted deck through the repository boundary', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('decks')
          expect(query.operation).toBe('delete')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'deck-1',
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

    const repository = createDecksRepository(mock.client)
    const result = await repository.deleteDeck('deck-1')

    expect(result).toEqual({
      ok: true,
      data: undefined,
    })
  })
})
