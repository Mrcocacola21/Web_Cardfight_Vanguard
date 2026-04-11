import type { RepositoryResult } from '@web-vg/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initialDeckCreateFormState } from '@/features/decks/server/deck-create-form-state'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createProfilesRepository: vi.fn(),
  createDecksRepository: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@web-vg/db', () => ({
  createProfilesRepository: mocks.createProfilesRepository,
  createDecksRepository: mocks.createDecksRepository,
}))

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  createDeckAction,
  deleteDeckAction,
  duplicateDeckAction,
} from './deck-actions'

describe('deck-actions', () => {
  const client = { auth: {} }
  const profile = {
    id: 'profile-1',
    username: 'azure_pilot',
    displayName: 'Azure Pilot',
    bio: null,
    avatarUrl: null,
    visibility: 'private',
    createdAt: '2026-04-08T00:00:00.000Z',
    updatedAt: '2026-04-08T00:00:00.000Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue(client)
    mocks.getCurrentAuthState.mockResolvedValue({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'azure@example.com',
      },
    })
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: vi.fn().mockResolvedValue({
        ok: true,
        data: profile,
      } satisfies RepositoryResult<typeof profile | null>),
    })
  })

  it('creates an empty Standard deck and redirects into its detail page', async () => {
    const createDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-new',
      },
    })

    mocks.createDecksRepository.mockReturnValue({
      createDeck,
    })

    const formData = new FormData()
    formData.set('formatId', 'standard')

    await createDeckAction(initialDeckCreateFormState, formData)

    expect(createDeck).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'Untitled Deck',
      description: null,
      tags: [],
      isFavorite: false,
      cards: [],
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks')
    expect(mocks.redirect).toHaveBeenCalledWith('/decks/deck-new')
  })

  it('creates an empty deck in the selected format', async () => {
    const createDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-premium',
      },
    })

    mocks.createDecksRepository.mockReturnValue({
      createDeck,
    })

    const formData = new FormData()
    formData.set('formatId', 'premium')

    await createDeckAction(initialDeckCreateFormState, formData)

    expect(createDeck).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      formatId: 'premium',
      title: 'Untitled Deck',
      description: null,
      tags: [],
      isFavorite: false,
      cards: [],
    })
    expect(mocks.redirect).toHaveBeenCalledWith('/decks/deck-premium')
  })

  it('returns a validation error for unsupported formats', async () => {
    const createDeck = vi.fn()

    mocks.createDecksRepository.mockReturnValue({
      createDeck,
    })

    const formData = new FormData()
    formData.set('formatId', 'unsupported')

    const result = await createDeckAction(initialDeckCreateFormState, formData)

    expect(createDeck).not.toHaveBeenCalled()
    expect(result).toEqual({
      status: 'error',
      message: 'Select one of the supported formats before creating a deck.',
      fieldErrors: {
        formatId: 'Choose Standard, V Premium, or Premium.',
      },
    })
  })

  it('duplicates the current deck composition under a copied title', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-1',
        ownerProfileId: 'profile-1',
        formatId: 'standard',
        title: 'Azure Bastion',
        description: 'Current list.',
        tags: ['tempo'],
        isFavorite: true,
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
              quantity: 4,
            },
          ],
        },
      },
    })
    const createDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-copy',
      },
    })

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      createDeck,
    })

    const formData = new FormData()
    formData.set('deckId', 'deck-1')

    await duplicateDeckAction(formData)

    expect(getDeckById).toHaveBeenCalledWith('deck-1')
    expect(createDeck).toHaveBeenCalledWith({
      ownerProfileId: 'profile-1',
      formatId: 'standard',
      title: 'Azure Bastion (copy)',
      description: 'Current list.',
      tags: ['tempo'],
      isFavorite: true,
      visibility: 'private',
      cards: [
        {
          sectionKey: 'main',
          cardEntityId: 'entity-bastion',
          quantity: 4,
        },
      ],
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks')
  })

  it('deletes an owned deck and revalidates list/detail routes', async () => {
    const getDeckById = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: 'deck-1',
        ownerProfileId: 'profile-1',
      },
    })
    const deleteDeck = vi.fn().mockResolvedValue({
      ok: true,
      data: undefined,
    })

    mocks.createDecksRepository.mockReturnValue({
      getDeckById,
      deleteDeck,
    })

    const formData = new FormData()
    formData.set('deckId', 'deck-1')

    await deleteDeckAction(formData)

    expect(deleteDeck).toHaveBeenCalledWith('deck-1')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks')
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/decks/deck-1')
  })
})
