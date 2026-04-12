import type { DeckWriteRepository, StoredDeck } from './deck-write-repository'

export type DeckApplicationErrorCode =
  | 'unsupported-format'
  | 'profile-required'
  | 'deck-not-found'
  | 'forbidden'
  | 'repository-failed'
  | 'max-quantity-exceeded'
  | 'mutation-failed'

export interface DeckApplicationError {
  readonly code: DeckApplicationErrorCode
  readonly message: string
}

export type DeckApplicationResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: DeckApplicationError
    }

export interface DeckApplicationServices {
  readonly repository: DeckWriteRepository
}

export interface OwnedDeckState {
  readonly ownerProfileId: string
  readonly storedDeck: StoredDeck
}

export interface ResolveOwnedDeckInput {
  readonly authUserId: string
  readonly deckId: string
  readonly forbiddenMessage: string
}

export async function resolveDeckOwnerProfile(
  services: DeckApplicationServices,
  authUserId: string,
): Promise<DeckApplicationResult<string>> {
  const profileResult =
    await services.repository.getOwnerProfileIdByAuthUserId(authUserId)

  if (!profileResult.ok) {
    return mapRepositoryFailure(profileResult.error.message)
  }

  if (!profileResult.data) {
    return {
      ok: false,
      error: {
        code: 'profile-required',
        message:
          'A persisted profile row is required before deck actions can run.',
      },
    }
  }

  return {
    ok: true,
    data: profileResult.data,
  }
}

export async function resolveOwnedDeck(
  services: DeckApplicationServices,
  input: ResolveOwnedDeckInput,
): Promise<DeckApplicationResult<OwnedDeckState>> {
  const ownerProfileResult = await resolveDeckOwnerProfile(
    services,
    input.authUserId,
  )

  if (!ownerProfileResult.ok) {
    return ownerProfileResult
  }

  const deckResult = await services.repository.getDeckById(input.deckId)

  if (!deckResult.ok) {
    return mapRepositoryFailure(deckResult.error.message)
  }

  if (!deckResult.data) {
    return {
      ok: false,
      error: {
        code: 'deck-not-found',
        message: 'The requested deck could not be found.',
      },
    }
  }

  if (deckResult.data.deck.ownerId !== ownerProfileResult.data) {
    return {
      ok: false,
      error: {
        code: 'forbidden',
        message: input.forbiddenMessage,
      },
    }
  }

  return {
    ok: true,
    data: {
      ownerProfileId: ownerProfileResult.data,
      storedDeck: deckResult.data,
    },
  }
}

function mapRepositoryFailure(message: string): DeckApplicationResult<never> {
  return {
    ok: false,
    error: {
      code: 'repository-failed',
      message,
    },
  }
}
