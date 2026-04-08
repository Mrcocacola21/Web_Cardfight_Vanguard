import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'
import { createDecksRepository } from './decks.repository'

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
          expect(query.table).toBe('decks')
          expect(query.cardinality).toBe('many')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'owner_profile_id',
              value: 'profile-1',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'deck-1',
              owner_profile_id: 'profile-1',
              format_id: 'standard',
              title: 'Azure Standard Deck',
              description: 'Current persisted Standard list.',
              visibility: 'private',
              archived_at: null,
              created_at: '2026-04-08T00:00:00.000Z',
              updated_at: '2026-04-08T01:00:00.000Z',
              current_version_id: 'version-1',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('legality')
          expect(query.table).toBe('formats')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['standard'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'standard',
              display_name: 'Standard',
              description: 'D-era baseline profile',
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
              value: ['version-1'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'version-1',
              deck_id: 'deck-1',
              version_number: 2,
              created_by_profile_id: 'profile-1',
              version_note: null,
              created_at: '2026-04-08T01:00:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('user_data')
          expect(query.table).toBe('deck_cards')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'deck_version_id',
              value: ['version-1'],
            },
          ])
        },
        response: {
          data: [
            {
              deck_version_id: 'version-1',
              section_key: 'main',
              card_entity_id: 'card-1',
              quantity: 46,
            },
            {
              deck_version_id: 'version-1',
              section_key: 'ride',
              card_entity_id: 'card-2',
              quantity: 4,
            },
          ],
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
        response: {
          data: {
            id: 'deck-1',
            owner_profile_id: 'profile-1',
            format_id: 'standard',
            title: 'Azure Standard Deck',
            description: 'Current persisted Standard list.',
            visibility: 'private',
            archived_at: null,
            created_at: '2026-04-08T00:00:00.000Z',
            updated_at: '2026-04-08T01:00:00.000Z',
            current_version_id: 'version-1',
          },
          error: null,
        },
      },
      {
        response: {
          data: [
            {
              id: 'standard',
              display_name: 'Standard',
              description: 'D-era baseline profile',
            },
          ],
          error: null,
        },
      },
      {
        response: {
          data: [
            {
              id: 'version-1',
              deck_id: 'deck-1',
              version_number: 2,
              created_by_profile_id: 'profile-1',
              version_note: 'updated ride line',
              created_at: '2026-04-08T01:00:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        response: {
          data: [
            {
              deck_version_id: 'version-1',
              section_key: 'main',
              card_entity_id: 'card-1',
              quantity: 46,
            },
            {
              deck_version_id: 'version-1',
              section_key: 'ride',
              card_entity_id: 'card-2',
              quantity: 4,
            },
          ],
          error: null,
        },
      },
      {
        response: {
          data: [
            {
              id: 'card-1',
              canonical_key: 'card.azure-vanguard-dragon',
              name: 'Azure Vanguard Dragon',
              grade: 3,
              card_type: 'normal-unit',
              trigger_type: null,
            },
            {
              id: 'card-2',
              canonical_key: 'card.azure-vanguard-rookie',
              name: 'Azure Vanguard Rookie',
              grade: 0,
              card_type: 'normal-unit',
              trigger_type: null,
            },
          ],
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
})
