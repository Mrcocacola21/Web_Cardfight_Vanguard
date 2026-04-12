import { createDeck, type Deck } from '@web-vg/decks'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import { describe, expect, it, vi } from 'vitest'

import type { DeckApplicationServices } from './deck-application-support'
import {
  mutateDeckCompositionUseCase,
  saveDeckDraftUseCase,
} from './deck-builder-use-cases'
import type {
  DeckWriteRepository,
  DeckWriteRepositoryResult,
  StoredDeck,
} from './deck-write-repository'

describe('deck builder use cases', () => {
  it('mutates an owned deck through domain operations and repository orchestration', async () => {
    const currentStoredDeck = createStoredDeck({
      deck: createBaseDeck({ cards: [] }),
      visibility: 'private',
    })
    const saveDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })
    const getDeckDetailById = vi.fn().mockResolvedValue({
      ok: true,
      data: createDeckDetail({
        totalCards: 1,
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 1 },
        ],
      }),
    })
    const services = createServices({
      repository: {
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: currentStoredDeck,
        }),
        saveDeck,
        getDeckDetailById,
      },
    })

    const result = await mutateDeckCompositionUseCase(services, {
      authUserId: 'auth-user-1',
      deckId: 'deck-1',
      cardEntityId: 'entity-bastion',
      mutation: 'add',
    })

    expect(result).toEqual({
      ok: true,
      data: createDeckDetail({
        totalCards: 1,
        cards: [
          { sectionKey: 'main', cardEntityId: 'entity-bastion', quantity: 1 },
        ],
      }),
    })
    expect(saveDeck).toHaveBeenCalledWith(
      currentStoredDeck,
      expect.objectContaining({
        id: 'deck-1',
        ownerId: 'profile-1',
        formatId: 'standard',
        name: 'Azure Bastion',
      }),
    )
    const savedDeck = saveDeck.mock.calls[0]?.[1] as Deck | undefined
    expect(savedDeck?.currentVersion.cards).toEqual([
      {
        section: 'main',
        cardEntityId: 'entity-bastion',
        quantity: 1,
      },
    ])
    expect(getDeckDetailById).toHaveBeenCalledWith('deck-1')
  })

  it('rejects draft saves that exceed the builder copy cap before persistence', async () => {
    const saveDeck = vi.fn()
    const services = createServices({
      repository: {
        getDeckById: vi.fn().mockResolvedValue({
          ok: true,
          data: createStoredDeck({
            deck: createBaseDeck({ cards: [] }),
            visibility: 'private',
          }),
        }),
        saveDeck,
      },
    })

    const result = await saveDeckDraftUseCase(services, {
      authUserId: 'auth-user-1',
      deckId: 'deck-1',
      formatId: 'standard',
      title: 'Azure Bastion',
      description: null,
      tags: ['tempo'],
      isFavorite: false,
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          canonicalKey: 'card.apex-ruler-bastion',
          name: 'Apex Ruler, Bastion',
          grade: 3,
          cardType: 'normal-unit',
          triggerType: null,
          quantity: 5,
        },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'max-quantity-exceeded',
        message:
          'Builder copy cap reached. A card cannot exceed 4 copies before full validation is available.',
      },
    })
    expect(saveDeck).not.toHaveBeenCalled()
  })
})

function createServices(overrides?: {
  readonly repository?: Partial<DeckWriteRepository>
}): DeckApplicationServices {
  return {
    repository: {
      getOwnerProfileIdByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: 'profile-1',
      } satisfies DeckWriteRepositoryResult<string | null>),
      getDeckById: vi.fn().mockResolvedValue({
        ok: true,
        data: createStoredDeck({ deck: createBaseDeck({ cards: [] }) }),
      } satisfies DeckWriteRepositoryResult<StoredDeck | null>),
      getDeckDetailById: vi.fn().mockResolvedValue({
        ok: true,
        data: createDeckDetail({ totalCards: 0, cards: [] }),
      } satisfies DeckWriteRepositoryResult<DeckDetailRecord | null>),
      createDeck: vi.fn(),
      saveDeck: vi.fn(),
      deleteDeck: vi.fn(),
      ...overrides?.repository,
    },
  }
}

function createStoredDeck(input?: {
  readonly deck?: Deck
  readonly visibility?: 'private' | 'unlisted' | 'public'
}): StoredDeck {
  return {
    deck: input?.deck ?? createBaseDeck({ cards: [] }),
    visibility: input?.visibility ?? 'private',
  }
}

function createBaseDeck(input?: {
  readonly cards?: readonly {
    readonly section: 'main' | 'ride' | 'g'
    readonly cardEntityId: string
    readonly quantity: number
  }[]
}): Deck {
  return createDeck({
    id: 'deck-1' as never,
    ownerId: 'profile-1' as never,
    formatId: 'standard' as never,
    name: 'Azure Bastion',
    description: null,
    tags: ['tempo'],
    isFavorite: false,
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-08T01:00:00.000Z',
    currentVersionId: 'version-1' as never,
    revision: 1,
    cards:
      input?.cards?.map((card) => ({
        section: card.section,
        cardEntityId: card.cardEntityId as never,
        quantity: card.quantity,
      })) ?? [],
  })
}

function createDeckDetail(input: {
  readonly totalCards: number
  readonly cards: ReadonlyArray<{
    readonly sectionKey: 'main' | 'ride' | 'g'
    readonly cardEntityId: string
    readonly quantity: number
  }>
}): DeckDetailRecord {
  return {
    id: 'deck-1',
    ownerProfileId: 'profile-1',
    title: 'Azure Bastion',
    description: null,
    tags: ['tempo'],
    isFavorite: false,
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
      versionNumber: 1,
      createdByProfileId: 'profile-1',
      versionNote: null,
      createdAt: '2026-04-08T01:00:00.000Z',
      totalCards: input.totalCards,
      sectionCounts: {
        main: input.cards
          .filter((card) => card.sectionKey === 'main')
          .reduce((total, card) => total + card.quantity, 0),
        ride: input.cards
          .filter((card) => card.sectionKey === 'ride')
          .reduce((total, card) => total + card.quantity, 0),
        g: input.cards
          .filter((card) => card.sectionKey === 'g')
          .reduce((total, card) => total + card.quantity, 0),
      },
      cards: input.cards.map((card) => ({
        sectionKey: card.sectionKey,
        cardEntityId: card.cardEntityId,
        canonicalKey: 'card.apex-ruler-bastion',
        name: 'Apex Ruler, Bastion',
        grade: 3,
        cardType: 'normal-unit',
        triggerType: null,
        quantity: card.quantity,
      })),
      sections: [
        {
          key: 'main',
          totalCards: input.cards
            .filter((card) => card.sectionKey === 'main')
            .reduce((total, card) => total + card.quantity, 0),
          cards: input.cards
            .filter((card) => card.sectionKey === 'main')
            .map((card) => ({
              sectionKey: card.sectionKey,
              cardEntityId: card.cardEntityId,
              canonicalKey: 'card.apex-ruler-bastion',
              name: 'Apex Ruler, Bastion',
              grade: 3,
              cardType: 'normal-unit',
              triggerType: null,
              quantity: card.quantity,
            })),
        },
        {
          key: 'ride',
          totalCards: input.cards
            .filter((card) => card.sectionKey === 'ride')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
        {
          key: 'g',
          totalCards: input.cards
            .filter((card) => card.sectionKey === 'g')
            .reduce((total, card) => total + card.quantity, 0),
          cards: [],
        },
      ],
    },
  }
}
