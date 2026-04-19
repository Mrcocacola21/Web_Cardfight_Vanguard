import type { Tables } from '../../generated/database.types'

import type {
  MatchParticipantRecord,
  MatchParticipantResult,
  MatchRecord,
  MatchRecordSource,
  MatchRecordStatus,
  MatchRecordVisibility,
} from './matches.types'

type MatchRow = Pick<
  Tables<{ schema: 'social' }, 'matches'>,
  | 'id'
  | 'recorded_by_profile_id'
  | 'format_id'
  | 'visibility'
  | 'status'
  | 'entry_source'
  | 'occurred_at'
  | 'notes'
  | 'created_at'
  | 'updated_at'
>

type MatchParticipantRow = Pick<
  Tables<{ schema: 'social' }, 'match_participants'>,
  | 'id'
  | 'match_id'
  | 'profile_id'
  | 'deck_version_id'
  | 'result'
  | 'seat_order'
  | 'notes'
>

export function mapMatchParticipantRow(
  row: MatchParticipantRow,
): MatchParticipantRecord {
  return {
    id: row.id,
    matchId: row.match_id,
    profileId: row.profile_id,
    deckVersionId: row.deck_version_id,
    result: normalizeMatchParticipantResult(row.result),
    seatOrder: row.seat_order,
    notes: row.notes,
  }
}

export function mapMatchRow(
  row: MatchRow,
  participants: readonly MatchParticipantRecord[],
): MatchRecord {
  return {
    id: row.id,
    ownerProfileId: row.recorded_by_profile_id,
    formatId: row.format_id,
    visibility: normalizeMatchRecordVisibility(row.visibility),
    status: normalizeMatchRecordStatus(row.status),
    source: normalizeMatchRecordSource(row.entry_source),
    playedAt: row.occurred_at,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participants,
  }
}

function normalizeMatchRecordVisibility(value: string): MatchRecordVisibility {
  switch (value) {
    case 'friends':
    case 'public':
      return value
    default:
      return 'private'
  }
}

function normalizeMatchRecordStatus(value: string): MatchRecordStatus {
  switch (value) {
    case 'recorded':
    case 'voided':
      return value
    default:
      return 'completed'
  }
}

function normalizeMatchRecordSource(value: string): MatchRecordSource {
  return value === 'gameplay' ? 'gameplay' : 'manual'
}

function normalizeMatchParticipantResult(
  value: string,
): MatchParticipantResult {
  switch (value) {
    case 'win':
    case 'loss':
    case 'draw':
    case 'forfeit':
      return value
    default:
      return 'unknown'
  }
}
