export type MatchLobbyInviteStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'started'

export interface MatchLobbyInviteRecord {
  readonly id: string
  readonly requesterProfileId: string
  readonly inviteeProfileId: string
  readonly formatId: string
  readonly status: MatchLobbyInviteStatus
  readonly requesterDeckId: string | null
  readonly inviteeDeckId: string | null
  readonly requesterReady: boolean
  readonly inviteeReady: boolean
  readonly startedRoomId: string | null
  readonly createdAt: string
  readonly respondedAt: string | null
  readonly updatedAt: string
}

export interface CreateMatchLobbyInviteInput {
  readonly requesterProfileId: string
  readonly inviteeProfileId: string
  readonly formatId: string
}

export interface SetMatchLobbyDeckInput {
  readonly inviteId: string
  readonly profileId: string
  readonly deckId: string
}

export interface SetMatchLobbyReadyInput {
  readonly inviteId: string
  readonly profileId: string
  readonly ready: boolean
}
