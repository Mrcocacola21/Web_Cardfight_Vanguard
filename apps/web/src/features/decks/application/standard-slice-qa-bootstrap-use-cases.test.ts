import { describe, expect, it, vi } from 'vitest'

import type { CreateDeckRecordInput } from '@/features/decks/application/deck-write-repository'
import { STANDARD_SLICE_QA_DECKS } from '@/features/decks/standard-slice-qa-decks'

import {
  bootstrapStandardSliceQaDecksUseCase,
  type StandardSliceQaBootstrapServices,
} from './standard-slice-qa-bootstrap-use-cases'

describe('bootstrapStandardSliceQaDecksUseCase', () => {
  it('publishes catalog cards and creates the six QA decks for the current profile', async () => {
    const createDeck = vi.fn((input: CreateDeckRecordInput) =>
      Promise.resolve({
        ok: true as const,
        data: {
          id: `created:${input.name}`,
        },
      }),
    )
    const ensureStandardSliceQaCatalog = vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        data: undefined,
      }),
    )
    const services = createServices({
      createDeck,
      ensureStandardSliceQaCatalog,
    })

    const result = await bootstrapStandardSliceQaDecksUseCase(services, {
      authUserId: 'auth-user-1',
    })

    expect(result.ok).toBe(true)

    if (!result.ok) {
      throw new Error(result.error.message)
    }

    expect(result.data.ownerProfileId).toBe('profile-1')
    expect(result.data.createdDeckIds).toEqual(
      expect.arrayContaining([
        'created:[QA] Standard Slice - Reguregnus',
        'created:[QA] Standard Slice - Kairi',
      ]),
    )
    expect(result.data.skippedDeckTitles).toEqual([])
    expect(ensureStandardSliceQaCatalog).toHaveBeenCalledOnce()
    expect(createDeck).toHaveBeenCalledTimes(6)

    for (const [index, deck] of STANDARD_SLICE_QA_DECKS.entries()) {
      const call = createDeck.mock.calls[index]?.[0]

      expect(call).toBeDefined()

      if (!call) {
        throw new Error(`Missing createDeck call for ${deck.title}.`)
      }

      expect(call).toMatchObject({
        ownerProfileId: 'profile-1',
        formatId: 'standard',
        name: deck.title,
        visibility: 'private',
      })
      expect(call.cards).toEqual(deck.entries)
      expect(
        call.cards
          .filter((entry) => entry.section === 'main')
          .reduce((total, entry) => total + entry.quantity, 0),
      ).toBe(50)
      expect(
        call.cards
          .filter((entry) => entry.section === 'ride')
          .reduce((total, entry) => total + entry.quantity, 0),
      ).toBe(4)
    }
  })

  it('is idempotent for QA decks already created on the profile', async () => {
    const createDeck = vi.fn()
    const services = createServices({
      existingDecks: [
        { title: '[QA] Standard Slice - Reguregnus' },
        { title: '[QA] Standard Slice - Heartluru' },
        { title: '[QA] Standard Slice - Youthberk' },
        { title: '[QA] Standard Slice - Prison' },
        { title: '[QA] Standard Slice - Vyrgilla' },
        { title: '[QA] Standard Slice - Kairi' },
      ],
      createDeck,
    })

    const result = await bootstrapStandardSliceQaDecksUseCase(services, {
      authUserId: 'auth-user-1',
    })

    expect(result).toMatchObject({
      ok: true,
      data: {
        createdDeckIds: [],
        skippedDeckTitles: STANDARD_SLICE_QA_DECKS.map((deck) => deck.title),
      },
    })
    expect(createDeck).not.toHaveBeenCalled()
  })

  it('fails clearly when the signed-in user does not have a profile row yet', async () => {
    const services = createServices({
      ownerProfileId: null,
    })

    const result = await bootstrapStandardSliceQaDecksUseCase(services, {
      authUserId: 'auth-user-1',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'profile-unavailable',
        message:
          'Create your profile before creating the Standard slice QA decks.',
      },
    })
  })
})

function createServices(
  input: {
    readonly ownerProfileId?: string | null
    readonly existingDecks?: readonly { readonly title: string }[]
    readonly createDeck?: StandardSliceQaBootstrapServices['deckRepository']['createDeck']
    readonly ensureStandardSliceQaCatalog?: StandardSliceQaBootstrapServices['catalogRepository']['ensureStandardSliceQaCatalog']
  } = {},
): StandardSliceQaBootstrapServices {
  return {
    deckRepository: {
      getOwnerProfileIdByAuthUserId: vi.fn(() =>
        Promise.resolve({
          ok: true as const,
          data:
            input.ownerProfileId === undefined
              ? 'profile-1'
              : input.ownerProfileId,
        }),
      ),
      listDecksByOwnerProfileId: vi.fn(() =>
        Promise.resolve({
          ok: true as const,
          data: input.existingDecks ?? [],
        }),
      ),
      createDeck:
        input.createDeck ??
        vi.fn(() =>
          Promise.resolve({
            ok: true as const,
            data: {
              id: 'deck-created',
            },
          }),
        ),
    },
    catalogRepository: {
      ensureStandardSliceQaCatalog:
        input.ensureStandardSliceQaCatalog ??
        vi.fn(() =>
          Promise.resolve({
            ok: true as const,
            data: undefined,
          }),
        ),
    },
  }
}
