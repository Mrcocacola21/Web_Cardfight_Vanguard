import {
  createDecksRepository,
  createProfilesRepository,
  type DbClient,
} from '@web-vg/db'

import type {
  CreateDeckRecordInput,
  DeckWriteRepository,
  DeckWriteRepositoryResult,
  StoredDeck,
} from '@/features/decks/application/deck-write-repository'

import {
  mapCreateDeckRecordInputToPersistence,
  mapDeckRecordToStoredDeck,
  mapStoredDeckToSaveDeckInput,
} from './deck-write-repository.mapper'

export function createDeckWriteRepository(
  client: DbClient,
): DeckWriteRepository {
  const decksRepository = createDecksRepository(client)
  const profilesRepository = createProfilesRepository(client)

  return {
    async getOwnerProfileIdByAuthUserId(
      authUserId,
    ): Promise<DeckWriteRepositoryResult<string | null>> {
      const result = await profilesRepository.getProfileByAuthUserId(authUserId)

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return {
        ok: true,
        data: result.data?.id ?? null,
      }
    },

    async getDeckById(
      id,
    ): Promise<DeckWriteRepositoryResult<StoredDeck | null>> {
      const result = await decksRepository.getDeckById(id)

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return {
        ok: true,
        data: result.data ? mapDeckRecordToStoredDeck(result.data) : null,
      }
    },

    async getDeckDetailById(id) {
      const result = await decksRepository.getDeckDetailById(id)

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return result
    },

    async createDeck(
      input: CreateDeckRecordInput,
    ): Promise<DeckWriteRepositoryResult<{ readonly id: string }>> {
      const result = await decksRepository.createDeck(
        mapCreateDeckRecordInputToPersistence(input),
      )

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return {
        ok: true,
        data: {
          id: result.data.id,
        },
      }
    },

    async saveDeck(
      current,
      nextDeck,
    ): Promise<DeckWriteRepositoryResult<void>> {
      const result = await decksRepository.saveDeck(
        mapStoredDeckToSaveDeckInput(current, nextDeck),
      )

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return {
        ok: true,
        data: undefined,
      }
    },

    async deleteDeck(id) {
      const result = await decksRepository.deleteDeck(id)

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return result
    },
  }
}

function mapRepositoryFailure(
  message: string,
): DeckWriteRepositoryResult<never> {
  return {
    ok: false,
    error: {
      message,
    },
  }
}
