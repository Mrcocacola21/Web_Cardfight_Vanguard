import {
  createMatchesRepository,
  createProfilesRepository,
  type DbClient,
} from '@web-vg/db'

import type {
  CreateStoredMatchRecordInput,
  MatchHistoryRepository,
  MatchHistoryRepositoryResult,
  StoredMatchHistoryListItem,
  StoredMatchRecord,
} from '@/features/matches/application/match-history-repository'

export function createMatchHistoryRepository(
  client: DbClient,
): MatchHistoryRepository {
  const matchesRepository = createMatchesRepository(client)
  const profilesRepository = createProfilesRepository(client)
  const matchHistoryReadPageSize = 100

  return {
    async getOwnerProfileIdByAuthUserId(
      authUserId,
    ): Promise<MatchHistoryRepositoryResult<string | null>> {
      const result = await profilesRepository.getProfileByAuthUserId(authUserId)

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return {
        ok: true,
        data: result.data?.id ?? null,
      }
    },

    async getMatchRecordById(
      id,
    ): Promise<MatchHistoryRepositoryResult<StoredMatchRecord | null>> {
      const result = await matchesRepository.getMatchRecordById(id)

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return result
    },

    async listMatchRecordsByOwner(
      ownerProfileId,
      limit,
    ): Promise<MatchHistoryRepositoryResult<readonly StoredMatchRecord[]>> {
      const result = await matchesRepository.listMatchRecordsByOwner(
        ownerProfileId,
        limit,
      )

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return result
    },

    async listMatchHistoryItemsByOwner(
      ownerProfileId,
      limit,
    ): Promise<
      MatchHistoryRepositoryResult<readonly StoredMatchHistoryListItem[]>
    > {
      const result = await matchesRepository.listMatchHistoryItemsByOwner(
        ownerProfileId,
        limit,
      )

      if (!result.ok) {
        return mapRepositoryFailure(result.error.message)
      }

      return result
    },

    async listAllMatchHistoryItemsByOwner(
      ownerProfileId,
    ): Promise<
      MatchHistoryRepositoryResult<readonly StoredMatchHistoryListItem[]>
    > {
      const allItems: StoredMatchHistoryListItem[] = []
      let offset = 0

      while (true) {
        const result = await matchesRepository.listMatchHistoryItemsByOwner(
          ownerProfileId,
          matchHistoryReadPageSize,
          offset,
        )

        if (!result.ok) {
          return mapRepositoryFailure(result.error.message)
        }

        allItems.push(...result.data)

        if (result.data.length < matchHistoryReadPageSize) {
          break
        }

        offset += result.data.length
      }

      return {
        ok: true,
        data: allItems,
      }
    },

    async createMatchRecord(
      input: CreateStoredMatchRecordInput,
    ): Promise<MatchHistoryRepositoryResult<{ readonly id: string }>> {
      const result = await matchesRepository.createMatchRecord(input)

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
  }
}

function mapRepositoryFailure(
  message: string,
): MatchHistoryRepositoryResult<never> {
  return {
    ok: false,
    error: {
      message,
    },
  }
}
