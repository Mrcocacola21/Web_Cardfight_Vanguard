import { createDeck } from '@web-vg/decks'
import { describe, expect, it } from 'vitest'

import {
  mapCreateDeckRecordInputToPersistence,
  mapDeckRecordToStoredDeck,
  mapStoredDeckToSaveDeckInput,
} from './deck-write-repository.mapper'

describe('deck write repository mapper', () => {
  it('maps a deck record into a domain deck plus persistence metadata', () => {
    const storedDeck = mapDeckRecordToStoredDeck({
      id: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: ['tempo'],
      isFavorite: false,
      visibility: 'private',
      archivedAt: null,
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T01:00:00.000Z',
      currentVersion: {
        id: 'version-1',
        deckId: 'deck-1',
        versionNumber: 1,
        createdByProfileId: 'profile-1',
        versionNote: null,
        createdAt: '2026-04-08T01:00:00.000Z',
        cards: [
          {
            sectionKey: 'main',
            cardEntityId: 'entity-bastion',
            quantity: 2,
          },
        ],
      },
    })

    expect(storedDeck.visibility).toBe('private')
    expect(storedDeck.deck.ownerId).toBe('profile-1')
    expect(storedDeck.deck.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: 'entity-bastion',
        quantity: 2,
      },
    ])
  })

  it('maps domain-oriented create/save inputs back into persistence payloads', () => {
    const createInput = mapCreateDeckRecordInputToPersistence({
      ownerProfileId: 'profile-1',
      formatId: 'premium',
      name: 'Azure Bastion',
      description: 'Premium shell.',
      tags: ['tempo'],
      isFavorite: true,
      visibility: 'unlisted',
      cards: [
        {
          section: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 2,
        },
      ],
    })

    expect(createInput).toEqual({
      ownerProfileId: 'profile-1',
      formatId: 'premium',
      title: 'Azure Bastion',
      description: 'Premium shell.',
      tags: ['tempo'],
      isFavorite: true,
      visibility: 'unlisted',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 2,
        },
      ],
    })

    const nextDeck = createDeck({
      id: 'deck-1' as never,
      ownerId: 'profile-1' as never,
      formatId: 'premium' as never,
      name: 'Azure Bastion',
      description: 'Premium shell.',
      tags: ['tempo'],
      isFavorite: true,
      createdAt: '2026-04-08T00:00:00.000Z',
      updatedAt: '2026-04-08T01:00:00.000Z',
      currentVersionId: 'version-1' as never,
      revision: 1,
      cards: [
        {
          section: 'main',
          cardEntityId: 'entity-bastion' as never,
          quantity: 2,
        },
      ],
    })

    const saveInput = mapStoredDeckToSaveDeckInput(
      {
        deck: nextDeck,
        visibility: 'unlisted',
      },
      nextDeck,
    )

    expect(saveInput).toEqual({
      deckId: 'deck-1',
      ownerProfileId: 'profile-1',
      formatId: 'premium',
      title: 'Azure Bastion',
      description: 'Premium shell.',
      tags: ['tempo'],
      isFavorite: true,
      visibility: 'unlisted',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 2,
        },
      ],
    })
  })
})
