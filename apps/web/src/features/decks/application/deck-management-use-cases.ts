import {
  defaultDeckName,
  isSupportedDeckFormatId,
} from '@/features/decks/deck-format-options'

import {
  type DeckApplicationResult,
  type DeckApplicationServices,
  resolveOwnedDeck,
  resolveDeckOwnerProfile,
} from './deck-application-support'
import type { CreateDeckRecordInput } from './deck-write-repository'

export interface CreateDeckCommand {
  readonly authUserId: string
  readonly formatId: string
}

export interface DeleteDeckCommand {
  readonly authUserId: string
  readonly deckId: string
}

export interface DuplicateDeckCommand {
  readonly authUserId: string
  readonly deckId: string
}

export type CreateDeckResult = DeckApplicationResult<{
  readonly deckId: string
}>

export type DeleteDeckResult = DeckApplicationResult<{
  readonly deckId: string
}>

export type DuplicateDeckResult = DeckApplicationResult<{
  readonly deckId: string
}>

export async function createDeckUseCase(
  services: DeckApplicationServices,
  command: CreateDeckCommand,
): Promise<CreateDeckResult> {
  if (!isSupportedDeckFormatId(command.formatId)) {
    return {
      ok: false,
      error: {
        code: 'unsupported-format',
        message: 'Select one of the supported formats before creating a deck.',
      },
    }
  }

  const ownerProfileResult = await resolveDeckOwnerProfile(
    services,
    command.authUserId,
  )

  if (!ownerProfileResult.ok) {
    return ownerProfileResult
  }

  return createDeckRecord(services, {
    ownerProfileId: ownerProfileResult.data,
    formatId: command.formatId,
    name: defaultDeckName,
    description: null,
    tags: [],
    isFavorite: false,
    cards: [],
  })
}

export async function deleteDeckUseCase(
  services: DeckApplicationServices,
  command: DeleteDeckCommand,
): Promise<DeleteDeckResult> {
  const ownedDeckResult = await resolveOwnedDeck(services, {
    authUserId: command.authUserId,
    deckId: command.deckId,
    forbiddenMessage: 'The current profile cannot delete this deck.',
  })

  if (!ownedDeckResult.ok) {
    return ownedDeckResult
  }

  const deleteResult = await services.repository.deleteDeck(command.deckId)

  if (!deleteResult.ok) {
    return {
      ok: false,
      error: {
        code: 'repository-failed',
        message: deleteResult.error.message,
      },
    }
  }

  return {
    ok: true,
    data: {
      deckId: command.deckId,
    },
  }
}

export async function duplicateDeckUseCase(
  services: DeckApplicationServices,
  command: DuplicateDeckCommand,
): Promise<DuplicateDeckResult> {
  const ownedDeckResult = await resolveOwnedDeck(services, {
    authUserId: command.authUserId,
    deckId: command.deckId,
    forbiddenMessage: 'The current profile cannot duplicate this deck.',
  })

  if (!ownedDeckResult.ok) {
    return ownedDeckResult
  }

  return createDeckRecord(services, {
    ownerProfileId: ownedDeckResult.data.ownerProfileId,
    formatId: ownedDeckResult.data.storedDeck.deck.formatId,
    name: buildDeckCopyTitle(ownedDeckResult.data.storedDeck.deck.name),
    description: ownedDeckResult.data.storedDeck.deck.description,
    tags: ownedDeckResult.data.storedDeck.deck.tags,
    isFavorite: ownedDeckResult.data.storedDeck.deck.isFavorite,
    visibility: ownedDeckResult.data.storedDeck.visibility,
    cards: ownedDeckResult.data.storedDeck.deck.currentVersion.cards,
  })
}

async function createDeckRecord(
  services: DeckApplicationServices,
  input: CreateDeckRecordInput,
): Promise<DeckApplicationResult<{ readonly deckId: string }>> {
  const createResult = await services.repository.createDeck(input)

  if (!createResult.ok) {
    return {
      ok: false,
      error: {
        code: 'repository-failed',
        message: createResult.error.message,
      },
    }
  }

  return {
    ok: true,
    data: {
      deckId: createResult.data.id,
    },
  }
}

function buildDeckCopyTitle(title: string): string {
  const trimmedTitle = title.trim()

  if (trimmedTitle.length === 0) {
    return `${defaultDeckName} (copy)`
  }

  return `${trimmedTitle} (copy)`
}
