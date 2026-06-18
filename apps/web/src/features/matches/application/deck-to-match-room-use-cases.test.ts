import { describe, expect, it, vi } from 'vitest'

import type { CatalogCardEntityRecord } from '@web-vg/db/repositories/catalog'
import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import {
  createInMemoryPersistedMatchSessionStorage,
  createPersistedMatchSessionAdapter,
  type MatchRoomId,
  type MatchRoomParticipantId,
} from '@web-vg/match-session'
import {
  REGUREGNUS_DROP_CALL_EFFECT,
  type ActionId,
  type PlayerId,
} from '@web-vg/rules-core'

import {
  createDeckToMatchRoomUseCase,
  type CreateDeckToMatchRoomServices,
} from './deck-to-match-room-use-cases'

const ROOM_ID = '11111111-1111-4111-8111-111111111111' as MatchRoomId

describe('createDeckToMatchRoomUseCase', () => {
  it('creates a persisted in-progress multiplayer room from an owned valid Standard deck', async () => {
    const sessions = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const services = createServices({ roomSessions: sessions })

    const result = await createDeckToMatchRoomUseCase(services, {
      authUserId: 'auth-owner',
      deckId: 'deck-standard-1',
      opponentProfileId: 'profile-opponent',
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        roomId: ROOM_ID,
        ownerProfileId: 'profile-owner',
        opponentProfileId: 'profile-opponent',
        deckId: 'deck-standard-1',
      },
    })

    const loaded = await sessions.loadRoomSession(ROOM_ID)

    expect(loaded.ok).toBe(true)

    if (!loaded.ok) {
      throw new Error(loaded.error.message)
    }

    expect(loaded.data.session.room.status).toBe('in_progress')
    expect(loaded.data.session.room.participants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'profile-owner',
          submittedDeckId: 'deck-standard-1',
          enginePlayerId: `${ROOM_ID}:player:1`,
        }),
        expect.objectContaining({
          userId: 'profile-opponent',
          submittedDeckId: `standard-sparring:${ROOM_ID}`,
          enginePlayerId: `${ROOM_ID}:player:2`,
        }),
      ]),
    )
    expect(loaded.data.session.room.engineState?.status).toBe('in_progress')
    expect(JSON.stringify(loaded.data.session.history)).toContain(
      '"type":"match.started"',
    )
  })

  it('preserves catalog effect_refs as runtime effect definition ids in product-created rooms', async () => {
    const sessions = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const services = createServices({
      roomSessions: sessions,
      catalogRepository: {
        getCardEntityById: vi.fn((cardEntityId: string) =>
          Promise.resolve({
            ok: true as const,
            data:
              cardEntityId === 'card-main-g1'
                ? createCatalogCard('card-main-g1', {
                    grade: 1,
                    power: 8000,
                    shield: 5000,
                    effectRefs: [REGUREGNUS_DROP_CALL_EFFECT.id],
                  })
                : createCatalogCard('card-ride-0', {
                    grade: 0,
                    power: 6000,
                    shield: 5000,
                  }),
          }),
        ),
      },
    })

    const result = await createDeckToMatchRoomUseCase(services, {
      authUserId: 'auth-owner',
      deckId: 'deck-standard-1',
      opponentProfileId: 'profile-opponent',
    })

    expect(result.ok).toBe(true)

    const loaded = await sessions.loadRoomSession(ROOM_ID)

    if (!loaded.ok) {
      throw new Error(loaded.error.message)
    }

    const effectedPiece = loaded.data.session.room.engineState?.pieces.find(
      (piece) => piece.cardDefinitionId === 'card-main-g1',
    )

    expect(effectedPiece?.effectDefinitionIds).toContain(
      REGUREGNUS_DROP_CALL_EFFECT.id,
    )
  })

  it('rejects foreign deck selection before catalog, validation, or room writes run', async () => {
    const sessions = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const getCardEntityById = vi.fn().mockResolvedValue({
      ok: true,
      data: null,
    })
    const services = createServices({
      roomSessions: sessions,
      decksRepository: {
        getDeckDetailById: vi.fn().mockResolvedValue({
          ok: true,
          data: createDeckDetail({ ownerProfileId: 'profile-other' }),
        }),
      },
      catalogRepository: {
        getCardEntityById,
      },
    })

    const result = await createDeckToMatchRoomUseCase(services, {
      authUserId: 'auth-owner',
      deckId: 'deck-standard-1',
      opponentProfileId: 'profile-opponent',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'deck-unavailable',
        message:
          'Choose one of your own saved decks before starting a match room.',
      },
    })
    expect(getCardEntityById).not.toHaveBeenCalled()
    expect(await sessions.loadRoomSession(ROOM_ID)).toMatchObject({
      ok: false,
      error: {
        code: 'room_not_found',
      },
    })
  })

  it('rejects invalid decks and does not persist a gameplay room', async () => {
    const sessions = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const validateDeck = vi.fn().mockResolvedValue({
      isValid: false,
      source: 'deck-builder-validation',
      errorCount: 2,
      issueCodes: ['deck-size', 'ride-deck'],
    })
    const services = createServices({
      roomSessions: sessions,
      validationService: {
        validateDeck,
      },
    })

    const result = await createDeckToMatchRoomUseCase(services, {
      authUserId: 'auth-owner',
      deckId: 'deck-standard-1',
      opponentProfileId: 'profile-opponent',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'deck-invalid',
        message:
          'Deck validation must pass before match room creation. 2 error(s) reported by deck-builder-validation.',
      },
    })
    expect(await sessions.loadRoomSession(ROOM_ID)).toMatchObject({
      ok: false,
      error: {
        code: 'room_not_found',
      },
    })
  })

  it('rejects decks with missing catalog card definitions before bootstrap', async () => {
    const sessions = createPersistedMatchSessionAdapter({
      storage: createInMemoryPersistedMatchSessionStorage(),
    })
    const validateDeck = vi.fn().mockResolvedValue({
      isValid: true,
      source: 'deck-builder-validation',
      errorCount: 0,
      issueCodes: [],
    })
    const services = createServices({
      roomSessions: sessions,
      catalogRepository: {
        getCardEntityById: vi.fn().mockResolvedValue({
          ok: true,
          data: null,
        }),
      },
      validationService: {
        validateDeck,
      },
    })

    const result = await createDeckToMatchRoomUseCase(services, {
      authUserId: 'auth-owner',
      deckId: 'deck-standard-1',
      opponentProfileId: 'profile-opponent',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'catalog-unavailable',
        message:
          'Deck card card-main-g1 is not available in the published catalog.',
      },
    })
    expect(validateDeck).not.toHaveBeenCalled()
    expect(await sessions.loadRoomSession(ROOM_ID)).toMatchObject({
      ok: false,
      error: {
        code: 'room_not_found',
      },
    })
  })
})

function createServices(
  overrides: Partial<CreateDeckToMatchRoomServices> = {},
): CreateDeckToMatchRoomServices {
  const catalogCards = new Map(
    [
      createCatalogCard('card-main-g1', {
        grade: 1,
        power: 8000,
        shield: 5000,
      }),
      createCatalogCard('card-ride-0', { grade: 0, power: 6000, shield: 5000 }),
    ].map((card) => [card.id, card] as const),
  )

  return {
    profilesRepository: {
      getProfileByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'profile-owner',
          username: 'owner',
          displayName: 'Owner',
          bio: null,
          avatarUrl: null,
          visibility: 'public',
          bioVisibility: 'public',
          createdAt: '2026-06-18T00:00:00.000Z',
          updatedAt: '2026-06-18T00:00:00.000Z',
        },
      }),
      getVisibleProfileById: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'profile-opponent',
          displayName: 'Opponent',
          avatarUrl: null,
          bio: null,
          visibility: 'public',
          bioVisibility: 'public',
          bioVisible: false,
        },
      }),
      ...overrides.profilesRepository,
    },
    decksRepository: {
      getDeckDetailById: vi.fn().mockResolvedValue({
        ok: true,
        data: createDeckDetail(),
      }),
      ...overrides.decksRepository,
    },
    catalogRepository: {
      getCardEntityById: vi.fn((cardEntityId: string) =>
        Promise.resolve({
          ok: true as const,
          data: catalogCards.get(cardEntityId) ?? null,
        }),
      ),
      ...overrides.catalogRepository,
    },
    validationService: {
      validateDeck: vi.fn().mockResolvedValue({
        isValid: true,
        source: 'deck-builder-validation',
        errorCount: 0,
        issueCodes: [],
      }),
      ...overrides.validationService,
    },
    roomSessions:
      overrides.roomSessions ??
      createPersistedMatchSessionAdapter({
        storage: createInMemoryPersistedMatchSessionStorage(),
      }),
    idFactory: overrides.idFactory ?? {
      createRoomId: () => ROOM_ID,
      createParticipantId: ({ roomId, seat }) =>
        `${roomId}:participant:${seat + 1}` as MatchRoomParticipantId,
      createPlayerId: ({ roomId, seat }) =>
        `${roomId}:player:${seat + 1}` as PlayerId,
      createActionId: ({ roomId, label, revision }) =>
        `${roomId}:action:${label}:${revision}` as ActionId,
    },
    now: overrides.now ?? (() => '2026-06-18T10:00:00.000Z'),
  }
}

function createDeckDetail(
  overrides: Partial<DeckDetailRecord> = {},
): DeckDetailRecord {
  return {
    id: 'deck-standard-1',
    ownerProfileId: 'profile-owner',
    title: 'Owned Standard Deck',
    description: null,
    tags: [],
    isFavorite: false,
    visibility: 'private',
    archivedAt: null,
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
    format: {
      id: 'standard',
      displayName: 'Standard',
      description: null,
    },
    currentVersionId: 'deck-standard-version-1',
    currentVersion: {
      id: 'deck-standard-version-1',
      deckId: 'deck-standard-1',
      versionNumber: 1,
      createdByProfileId: 'profile-owner',
      versionNote: null,
      createdAt: '2026-06-18T00:00:00.000Z',
      totalCards: 7,
      sectionCounts: {
        main: 6,
        ride: 1,
        g: 0,
      },
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'card-main-g1',
          canonicalKey: 'card.main.g1',
          name: 'Main Grade 1',
          grade: 1,
          cardType: 'normal-unit',
          triggerType: null,
          quantity: 6,
        },
        {
          sectionKey: 'ride',
          cardEntityId: 'card-ride-0',
          canonicalKey: 'card.ride.g0',
          name: 'Ride Grade 0',
          grade: 0,
          cardType: 'normal-unit',
          triggerType: null,
          quantity: 1,
        },
      ],
      sections: [],
    },
    ...overrides,
  }
}

function createCatalogCard(
  id: string,
  overrides: {
    readonly grade: number
    readonly power: number
    readonly shield: number
    readonly effectRefs?: readonly string[]
  },
): CatalogCardEntityRecord {
  return {
    id,
    canonicalKey: id.replaceAll('-', '.'),
    name: id,
    normalizedName: id,
    grade: overrides.grade,
    cardType: 'normal-unit',
    nation: 'keter-sanctuary',
    clan: null,
    race: null,
    triggerType: null,
    basePower: overrides.power,
    baseCritical: 1,
    baseShield: overrides.shield,
    keywords: [],
    effectRefs: overrides.effectRefs ?? [],
  }
}
