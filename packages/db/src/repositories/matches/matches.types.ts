export type MatchRecordVisibility = 'private' | 'friends' | 'public'

export type MatchRecordStatus = 'recorded' | 'completed' | 'voided'

export type MatchRecordSource = 'manual' | 'gameplay'

export type MatchParticipantResult =
  | 'win'
  | 'loss'
  | 'draw'
  | 'forfeit'
  | 'unknown'

export interface MatchParticipantRecord {
  readonly id: string
  readonly matchId: string
  readonly profileId: string
  readonly deckVersionId: string | null
  readonly result: MatchParticipantResult
  readonly seatOrder: number | null
  readonly notes: string | null
}

export interface MatchRecord {
  readonly id: string
  readonly ownerProfileId: string
  readonly formatId: string
  readonly visibility: MatchRecordVisibility
  readonly status: MatchRecordStatus
  readonly source: MatchRecordSource
  readonly playedAt: string
  readonly notes: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly participants: readonly MatchParticipantRecord[]
}

export interface MatchHistoryDeckSummaryRecord {
  readonly deckId: string | null
  readonly title: string | null
  readonly versionNumber: number | null
}

export interface MatchHistoryOpponentSummaryRecord {
  readonly profileId: string | null
  readonly displayName: string | null
  readonly avatarUrl: string | null
  readonly bio: string | null
  readonly profileVisible: boolean
}

export interface MatchHistoryListItemRecord {
  readonly id: string
  readonly formatId: string
  readonly status: MatchRecordStatus
  readonly playedAt: string
  readonly createdAt: string
  readonly result: MatchParticipantResult
  readonly notes: string | null
  readonly ownDeck: MatchHistoryDeckSummaryRecord
  readonly opponent: MatchHistoryOpponentSummaryRecord
}

export interface CreateMatchParticipantInput {
  readonly profileId: string
  readonly deckVersionId?: string | null
  readonly result?: MatchParticipantResult
  readonly seatOrder?: number | null
  readonly notes?: string | null
}

export interface CreateMatchRecordInput {
  readonly ownerProfileId: string
  readonly formatId: string
  readonly playedAt?: string
  readonly visibility?: MatchRecordVisibility
  readonly status?: MatchRecordStatus
  readonly source?: MatchRecordSource
  readonly notes?: string | null
  readonly participants?: readonly CreateMatchParticipantInput[]
}
