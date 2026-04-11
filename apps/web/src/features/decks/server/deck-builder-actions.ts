'use server'

import {
  addCard,
  createDeck,
  DeckDomainError,
  decrementCard,
  incrementCard,
  removeCard,
  type Deck,
} from '@web-vg/decks'
import type { DeckDetailRecord, DeckRecord, DeckSectionKey } from '@web-vg/db'
import { createDecksRepository, createProfilesRepository } from '@web-vg/db'
import type {
  CardId,
  DeckId,
  DeckSection,
  FormatId,
  UserId,
} from '@web-vg/shared'
import { revalidatePath } from 'next/cache'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import { isSupportedDeckFormatId } from '@/features/decks/deck-format-options'
import type { DeckBuilderDraftSaveInput } from '@/features/decks/deck-builder-draft'
import { DECK_BUILDER_MAX_COPIES } from '@/features/decks/deck-builder-limits'

export type DeckBuilderMutationKind =
  | 'add'
  | 'increment'
  | 'decrement'
  | 'remove'

export interface DeckBuilderMutationInput {
  readonly deckId: string
  readonly cardEntityId: string
  readonly mutation: DeckBuilderMutationKind
  readonly sectionKey?: DeckSectionKey
}

export type DeckBuilderMutationResult =
  | {
      readonly ok: true
      readonly data: DeckDetailRecord
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
      }
    }

export type SaveDeckDraftResult = DeckBuilderMutationResult

export async function mutateDeckCompositionAction(
  input: DeckBuilderMutationInput,
): Promise<DeckBuilderMutationResult> {
  const ownedDeckState = await resolveOwnedDeckState(input.deckId)

  if (!ownedDeckState.ok) {
    return {
      ok: false,
      error: {
        message: ownedDeckState.message,
      },
    }
  }

  let nextDeck: Deck

  try {
    nextDeck = applyDeckMutation(ownedDeckState.deck, input)
  } catch (error) {
    return {
      ok: false,
      error: {
        message: resolveDeckMutationErrorMessage(error),
      },
    }
  }

  return persistDeckChange(ownedDeckState, nextDeck)
}

export async function saveDeckDraftAction(
  input: DeckBuilderDraftSaveInput,
): Promise<SaveDeckDraftResult> {
  if (!isSupportedDeckFormatId(input.formatId)) {
    return {
      ok: false,
      error: {
        message:
          'Choose Standard, V Premium, or Premium before saving the deck.',
      },
    }
  }

  const ownedDeckState = await resolveOwnedDeckState(input.deckId)

  if (!ownedDeckState.ok) {
    return {
      ok: false,
      error: {
        message: ownedDeckState.message,
      },
    }
  }

  let nextDeck: Deck

  try {
    nextDeck = createDeckFromDraftInput(ownedDeckState.deck, input)
  } catch (error) {
    return {
      ok: false,
      error: {
        message: resolveDeckMutationErrorMessage(error),
      },
    }
  }

  return persistDeckChange(ownedDeckState, nextDeck)
}

interface OwnedDeckState {
  readonly repository: ReturnType<typeof createDecksRepository>
  readonly deck: DeckRecord
}

async function resolveOwnedDeckState(deckId: string): Promise<
  | ({
      readonly ok: true
    } & OwnedDeckState)
  | {
      readonly ok: false
      readonly message: string
    }
> {
  const ownerProfileState = await resolveCurrentDeckOwnerProfile()

  if (!ownerProfileState.ok) {
    return ownerProfileState
  }

  const repository = createDecksRepository(ownerProfileState.client)
  const existingDeckResult = await repository.getDeckById(deckId)

  if (!existingDeckResult.ok) {
    return {
      ok: false,
      message: existingDeckResult.error.message,
    }
  }

  if (!existingDeckResult.data) {
    return {
      ok: false,
      message: 'The requested deck could not be found.',
    }
  }

  if (existingDeckResult.data.ownerProfileId !== ownerProfileState.profile.id) {
    return {
      ok: false,
      message: 'The current profile cannot edit this deck.',
    }
  }

  return {
    ok: true,
    repository,
    deck: existingDeckResult.data,
  }
}

async function persistDeckChange(
  ownedDeckState: OwnedDeckState,
  nextDeck: Deck,
): Promise<DeckBuilderMutationResult> {
  const saveResult = await ownedDeckState.repository.saveDeck({
    deckId: ownedDeckState.deck.id,
    ownerProfileId: ownedDeckState.deck.ownerProfileId,
    formatId: nextDeck.formatId,
    title: nextDeck.name,
    description: nextDeck.description,
    tags: nextDeck.tags,
    isFavorite: nextDeck.isFavorite,
    visibility: ownedDeckState.deck.visibility as
      | 'private'
      | 'unlisted'
      | 'public',
    cards: nextDeck.currentVersion.cards.map((card) => ({
      sectionKey: card.section as DeckSectionKey,
      cardEntityId: card.cardEntityId,
      quantity: card.quantity,
    })),
  })

  if (!saveResult.ok) {
    return {
      ok: false,
      error: {
        message: saveResult.error.message,
      },
    }
  }

  const detailResult = await ownedDeckState.repository.getDeckDetailById(
    ownedDeckState.deck.id,
  )

  if (!detailResult.ok) {
    return {
      ok: false,
      error: {
        message: detailResult.error.message,
      },
    }
  }

  if (!detailResult.data) {
    return {
      ok: false,
      error: {
        message: 'The updated deck could not be loaded after save.',
      },
    }
  }

  revalidatePath('/decks')
  revalidatePath(`/decks/${encodeURIComponent(ownedDeckState.deck.id)}`)

  return {
    ok: true,
    data: detailResult.data,
  }
}

function applyDeckMutation(
  deckRecord: DeckRecord,
  input: DeckBuilderMutationInput,
): Deck {
  const domainDeck = mapDeckRecordToDomain(deckRecord)
  const cardEntityId = input.cardEntityId as CardId
  const section = (input.sectionKey ?? 'main') as DeckSection

  switch (input.mutation) {
    case 'add':
      return addCard(domainDeck, cardEntityId, 1, {
        section,
        maxQuantity: DECK_BUILDER_MAX_COPIES,
      })
    case 'increment':
      return incrementCard(domainDeck, cardEntityId, {
        section,
        maxQuantity: DECK_BUILDER_MAX_COPIES,
      })
    case 'decrement':
      return decrementCard(domainDeck, cardEntityId, { section })
    case 'remove':
      return removeCard(domainDeck, cardEntityId, { section })
  }
}

function mapDeckRecordToDomain(deckRecord: DeckRecord): Deck {
  return createDeck({
    id: deckRecord.id as DeckId,
    ownerId: deckRecord.ownerProfileId as UserId,
    formatId: deckRecord.formatId as FormatId,
    name: deckRecord.title,
    description: deckRecord.description,
    tags: deckRecord.tags,
    isFavorite: deckRecord.isFavorite,
    createdAt: deckRecord.createdAt,
    updatedAt: deckRecord.updatedAt,
    currentVersionId: (deckRecord.currentVersion?.id ??
      `${deckRecord.id}-draft-version`) as never,
    revision: deckRecord.currentVersion?.versionNumber ?? 1,
    cards:
      deckRecord.currentVersion?.cards.map((card) => ({
        section: card.sectionKey as DeckSection,
        cardEntityId: card.cardEntityId as CardId,
        quantity: card.quantity,
      })) ?? [],
  })
}

function createDeckFromDraftInput(
  deckRecord: DeckRecord,
  input: DeckBuilderDraftSaveInput,
): Deck {
  const nextDeck = createDeck({
    id: deckRecord.id as DeckId,
    ownerId: deckRecord.ownerProfileId as UserId,
    formatId: input.formatId as FormatId,
    name: input.title,
    description: input.description,
    tags: input.tags,
    isFavorite: input.isFavorite,
    createdAt: deckRecord.createdAt,
    updatedAt: deckRecord.updatedAt,
    currentVersionId: (deckRecord.currentVersion?.id ??
      `${deckRecord.id}-draft-version`) as never,
    revision: deckRecord.currentVersion?.versionNumber ?? 1,
    cards: input.cards.map((card) => ({
      section: card.sectionKey as DeckSection,
      cardEntityId: card.cardEntityId as CardId,
      quantity: card.quantity,
    })),
  })

  for (const card of nextDeck.currentVersion.cards) {
    if (card.quantity > DECK_BUILDER_MAX_COPIES) {
      throw new DeckDomainError(
        'max-quantity-exceeded',
        `Deck card quantity cannot exceed ${DECK_BUILDER_MAX_COPIES}.`,
      )
    }
  }

  return nextDeck
}

async function resolveCurrentDeckOwnerProfile() {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'error') {
    return {
      ok: false as const,
      message: authState.message,
    }
  }

  if (authState.kind !== 'ready') {
    return {
      ok: false as const,
      message: 'You need an authenticated session before deck actions can run.',
    }
  }

  const profilesRepository = createProfilesRepository(client)
  const profileResult = await profilesRepository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!profileResult.ok) {
    return {
      ok: false as const,
      message: profileResult.error.message,
    }
  }

  if (!profileResult.data) {
    return {
      ok: false as const,
      message:
        'A persisted profile row is required before deck actions can run.',
    }
  }

  return {
    ok: true as const,
    client,
    profile: profileResult.data,
  }
}

function resolveDeckMutationErrorMessage(error: unknown): string {
  if (
    error instanceof DeckDomainError &&
    error.code === 'max-quantity-exceeded'
  ) {
    return `Builder copy cap reached. A card cannot exceed ${DECK_BUILDER_MAX_COPIES} copies before full validation is available.`
  }

  if (error instanceof DeckDomainError) {
    return error.message
  }

  return 'The deck mutation could not be applied.'
}
