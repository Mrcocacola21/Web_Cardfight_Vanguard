import type {
  CreateMatchRecordInput,
  MatchHistoryListItemRecord,
  MatchRecord,
} from '@web-vg/db/repositories/matches'

export type StoredMatchRecord = MatchRecord
export type CreateStoredMatchRecordInput = CreateMatchRecordInput
export type StoredMatchHistoryListItem = MatchHistoryListItemRecord

export type MatchHistoryRepositoryResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
      }
    }

export interface MatchHistoryRepository {
  getOwnerProfileIdByAuthUserId(
    authUserId: string,
  ): Promise<MatchHistoryRepositoryResult<string | null>>
  getMatchRecordById(
    id: string,
  ): Promise<MatchHistoryRepositoryResult<StoredMatchRecord | null>>
  listMatchRecordsByOwner(
    ownerProfileId: string,
    limit: number,
  ): Promise<MatchHistoryRepositoryResult<readonly StoredMatchRecord[]>>
  listMatchHistoryItemsByOwner(
    ownerProfileId: string,
    limit: number,
  ): Promise<
    MatchHistoryRepositoryResult<readonly StoredMatchHistoryListItem[]>
  >
  listAllMatchHistoryItemsByOwner(
    ownerProfileId: string,
  ): Promise<
    MatchHistoryRepositoryResult<readonly StoredMatchHistoryListItem[]>
  >
  createMatchRecord(
    input: CreateStoredMatchRecordInput,
  ): Promise<MatchHistoryRepositoryResult<{ readonly id: string }>>
}
