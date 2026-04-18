import type { DeckId, MatchId, UserId } from '@web-vg/shared'

export type FriendRelationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'

export interface User {
  readonly id: UserId
  readonly handle: string
  readonly displayName: string
}

export interface FriendRelation {
  readonly fromUserId: UserId
  readonly toUserId: UserId
  readonly status: FriendRelationStatus
}

export type MatchOutcome = 'win' | 'loss' | 'draw'

export interface MatchEntry {
  readonly userId: UserId
  readonly deckId: DeckId
  readonly seat: 'player-one' | 'player-two'
}

export interface MatchResult {
  readonly outcome: MatchOutcome
  readonly winnerUserId?: UserId
}

export interface Match {
  readonly id: MatchId
  readonly entries: readonly MatchEntry[]
  readonly result?: MatchResult
}
