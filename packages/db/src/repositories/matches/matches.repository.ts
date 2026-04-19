import type { Tables } from '../../generated/database.types'
import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import { mapMatchParticipantRow, mapMatchRow } from './matches.mappers'
import type {
  CreateMatchRecordInput,
  MatchHistoryDeckSummaryRecord,
  MatchHistoryListItemRecord,
  MatchHistoryOpponentSummaryRecord,
  MatchParticipantRecord,
  MatchRecord,
  MatchRecordStatus,
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
type DeckVersionSummaryRow = Pick<
  Tables<{ schema: 'user_data' }, 'deck_versions'>,
  'id' | 'deck_id' | 'version_number'
>
type DeckSummaryRow = Pick<
  Tables<{ schema: 'user_data' }, 'decks'>,
  'id' | 'title'
>
type VisibleProfileSummaryRow = Pick<
  Tables<{ schema: 'user_data' }, 'visible_profiles'>,
  'id' | 'display_name' | 'avatar_url' | 'bio'
>

const matchSelect =
  'id, recorded_by_profile_id, format_id, visibility, status, entry_source, occurred_at, notes, created_at, updated_at'
const participantSelect =
  'id, match_id, profile_id, deck_version_id, result, seat_order, notes'
const deckVersionSelect = 'id, deck_id, version_number'
const deckSummarySelect = 'id, title'
const visibleProfileSummarySelect = 'id, display_name, avatar_url, bio'
const matchesMaxLimit = 100

export interface MatchesRepository {
  getMatchRecordById(id: string): Promise<RepositoryResult<MatchRecord | null>>
  listMatchRecordsByOwner(
    ownerProfileId: string,
    limit: number,
  ): Promise<RepositoryResult<readonly MatchRecord[]>>
  listMatchHistoryItemsByOwner(
    ownerProfileId: string,
    limit: number,
    offset?: number,
  ): Promise<RepositoryResult<readonly MatchHistoryListItemRecord[]>>
  createMatchRecord(
    input: CreateMatchRecordInput,
  ): Promise<RepositoryResult<MatchRecord>>
}

export function createMatchesRepository(client: DbClient): MatchesRepository {
  function normalizeMatchesLimit(limit: number) {
    if (!Number.isFinite(limit)) {
      return 1
    }

    return Math.max(1, Math.min(Math.trunc(limit), matchesMaxLimit))
  }

  function normalizeMatchesOffset(offset: number | undefined) {
    if (typeof offset !== 'number' || !Number.isFinite(offset)) {
      return 0
    }

    return Math.max(0, Math.trunc(offset))
  }

  async function loadParticipantsByMatchIds(
    matchIds: readonly string[],
  ): Promise<
    RepositoryResult<ReadonlyMap<string, readonly MatchParticipantRecord[]>>
  > {
    const uniqueMatchIds = Array.from(new Set(matchIds))

    if (uniqueMatchIds.length === 0) {
      return ok(new Map())
    }

    const { data, error } = await client
      .schema('social')
      .from('match_participants')
      .select(participantSelect)
      .in('match_id', uniqueMatchIds)
      .order('seat_order', {
        ascending: true,
      })
      .order('id', {
        ascending: true,
      })

    if (error) {
      return err(mapQueryError(error, 'Failed to load match participants.'))
    }

    const participantsByMatchId = new Map<string, MatchParticipantRecord[]>()

    for (const row of data ?? []) {
      const matchId = row.match_id
      const mappedParticipant = mapMatchParticipantRow(row)
      const matchParticipants = participantsByMatchId.get(matchId)

      if (matchParticipants) {
        matchParticipants.push(mappedParticipant)
        continue
      }

      participantsByMatchId.set(matchId, [mappedParticipant])
    }

    return ok(participantsByMatchId)
  }

  async function loadDeckVersionsByIds(
    deckVersionIds: readonly string[],
  ): Promise<RepositoryResult<ReadonlyMap<string, DeckVersionSummaryRow>>> {
    const uniqueDeckVersionIds = Array.from(new Set(deckVersionIds))

    if (uniqueDeckVersionIds.length === 0) {
      return ok(new Map())
    }

    const { data, error } = await client
      .schema('user_data')
      .from('deck_versions')
      .select(deckVersionSelect)
      .in('id', uniqueDeckVersionIds)

    if (error) {
      return err(mapQueryError(error, 'Failed to load match deck versions.'))
    }

    return ok(
      new Map(
        (data ?? []).map(
          (row) => [row.id, row] satisfies [string, DeckVersionSummaryRow],
        ),
      ),
    )
  }

  async function loadDecksByIds(
    deckIds: readonly string[],
  ): Promise<RepositoryResult<ReadonlyMap<string, DeckSummaryRow>>> {
    const uniqueDeckIds = Array.from(new Set(deckIds))

    if (uniqueDeckIds.length === 0) {
      return ok(new Map())
    }

    const { data, error } = await client
      .schema('user_data')
      .from('decks')
      .select(deckSummarySelect)
      .in('id', uniqueDeckIds)

    if (error) {
      return err(mapQueryError(error, 'Failed to load match decks.'))
    }

    return ok(
      new Map(
        (data ?? []).map(
          (row) => [row.id, row] satisfies [string, DeckSummaryRow],
        ),
      ),
    )
  }

  async function loadVisibleProfilesByIds(
    profileIds: readonly string[],
  ): Promise<RepositoryResult<ReadonlyMap<string, VisibleProfileSummaryRow>>> {
    const uniqueProfileIds = Array.from(new Set(profileIds))

    if (uniqueProfileIds.length === 0) {
      return ok(new Map())
    }

    const { data, error } = await client
      .schema('user_data')
      .from('visible_profiles')
      .select(visibleProfileSummarySelect)
      .in('id', uniqueProfileIds)

    if (error) {
      return err(mapQueryError(error, 'Failed to load match opponents.'))
    }

    return ok(
      new Map(
        (data ?? []).map(
          (row) => [row.id, row] satisfies [string, VisibleProfileSummaryRow],
        ),
      ),
    )
  }

  async function loadOwnerMatchRows(
    ownerProfileId: string,
    limit: number,
    offset: number,
    failureMessage: string,
  ): Promise<RepositoryResult<readonly MatchRow[]>> {
    const normalizedLimit = normalizeMatchesLimit(limit)
    const normalizedOffset = normalizeMatchesOffset(offset)
    const { data: matchRows, error: matchError } = await client
      .schema('social')
      .from('matches')
      .select(matchSelect)
      .eq('recorded_by_profile_id', ownerProfileId)
      .order('occurred_at', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      })
      .range(normalizedOffset, normalizedOffset + normalizedLimit - 1)

    if (matchError) {
      return err(mapQueryError(matchError, failureMessage))
    }

    return ok(matchRows ?? [])
  }

  async function loadMatchHistoryItemsForRows(
    ownerProfileId: string,
    matchRows: readonly MatchRow[],
  ): Promise<RepositoryResult<readonly MatchHistoryListItemRecord[]>> {
    if (matchRows.length === 0) {
      return ok([])
    }

    const participantsResult = await loadParticipantsByMatchIds(
      matchRows.map((row) => row.id),
    )

    if (!participantsResult.ok) {
      return participantsResult
    }

    const ownerParticipants = matchRows
      .map((row) =>
        (participantsResult.data.get(row.id) ?? []).find(
          (participant) => participant.profileId === ownerProfileId,
        ),
      )
      .filter((participant): participant is MatchParticipantRecord =>
        Boolean(participant),
      )

    const deckVersionsResult = await loadDeckVersionsByIds(
      ownerParticipants
        .map((participant) => participant.deckVersionId)
        .filter((deckVersionId): deckVersionId is string =>
          Boolean(deckVersionId),
        ),
    )

    if (!deckVersionsResult.ok) {
      return deckVersionsResult
    }

    const decksResult = await loadDecksByIds(
      Array.from(deckVersionsResult.data.values()).map((row) => row.deck_id),
    )

    if (!decksResult.ok) {
      return decksResult
    }

    const opponentParticipants = matchRows
      .map((row) =>
        (participantsResult.data.get(row.id) ?? []).find(
          (participant) => participant.profileId !== ownerProfileId,
        ),
      )
      .filter((participant): participant is MatchParticipantRecord =>
        Boolean(participant),
      )

    const visibleProfilesResult = await loadVisibleProfilesByIds(
      opponentParticipants.map((participant) => participant.profileId),
    )

    if (!visibleProfilesResult.ok) {
      return visibleProfilesResult
    }

    return ok(
      matchRows.map((row) => {
        const participants = participantsResult.data.get(row.id) ?? []
        const ownerParticipant =
          participants.find(
            (participant) => participant.profileId === ownerProfileId,
          ) ?? null
        const opponentParticipant =
          participants.find(
            (participant) => participant.profileId !== ownerProfileId,
          ) ?? null
        const ownDeck = resolveMatchHistoryDeckSummary(
          ownerParticipant,
          deckVersionsResult.data,
          decksResult.data,
        )
        const opponent = resolveMatchHistoryOpponentSummary(
          opponentParticipant,
          visibleProfilesResult.data,
        )

        return {
          id: row.id,
          formatId: row.format_id,
          status: row.status as MatchRecordStatus,
          playedAt: row.occurred_at,
          createdAt: row.created_at,
          result: ownerParticipant?.result ?? 'unknown',
          notes: row.notes,
          ownDeck,
          opponent,
        } satisfies MatchHistoryListItemRecord
      }),
    )
  }

  return {
    async getMatchRecordById(id) {
      const { data: matchRow, error: matchError } = await client
        .schema('social')
        .from('matches')
        .select(matchSelect)
        .eq('id', id)
        .maybeSingle()

      if (matchError) {
        return err(mapQueryError(matchError, 'Failed to load match record.'))
      }

      if (!matchRow) {
        return ok(null)
      }

      const participantsResult = await loadParticipantsByMatchIds([matchRow.id])

      if (!participantsResult.ok) {
        return participantsResult
      }

      return ok(
        mapMatchRow(matchRow, participantsResult.data.get(matchRow.id) ?? []),
      )
    },

    async listMatchRecordsByOwner(ownerProfileId, limit) {
      const matchRowsResult = await loadOwnerMatchRows(
        ownerProfileId,
        limit,
        0,
        'Failed to list match records.',
      )

      if (!matchRowsResult.ok) {
        return matchRowsResult
      }

      const matchRows = matchRowsResult.data

      if (matchRows.length === 0) {
        return ok([])
      }

      const participantsResult = await loadParticipantsByMatchIds(
        matchRows.map((row) => row.id),
      )

      if (!participantsResult.ok) {
        return participantsResult
      }

      return ok(
        matchRows.map((row) =>
          mapMatchRow(row, participantsResult.data.get(row.id) ?? []),
        ),
      )
    },

    async listMatchHistoryItemsByOwner(ownerProfileId, limit, offset = 0) {
      const matchRowsResult = await loadOwnerMatchRows(
        ownerProfileId,
        limit,
        offset,
        'Failed to list match history.',
      )

      if (!matchRowsResult.ok) {
        return matchRowsResult
      }

      return loadMatchHistoryItemsForRows(ownerProfileId, matchRowsResult.data)
    },

    async createMatchRecord(input) {
      const timestamp = new Date().toISOString()
      const playedAt = input.playedAt ?? timestamp
      const participants = [...(input.participants ?? [])]

      const { data: matchRow, error: matchError } = await client
        .schema('social')
        .from('matches')
        .insert({
          recorded_by_profile_id: input.ownerProfileId,
          format_id: input.formatId,
          visibility: input.visibility ?? 'private',
          status: input.status ?? 'completed',
          entry_source: input.source ?? 'manual',
          occurred_at: playedAt,
          notes: input.notes ?? null,
          updated_at: timestamp,
        })
        .select(matchSelect)
        .single()

      if (matchError) {
        return err(mapQueryError(matchError, 'Failed to create match record.'))
      }

      if (participants.length === 0) {
        return ok(mapMatchRow(matchRow, []))
      }

      const insertedParticipantsResult = await client
        .schema('social')
        .from('match_participants')
        .insert(
          participants.map((participant) => ({
            match_id: matchRow.id,
            profile_id: participant.profileId,
            deck_version_id: participant.deckVersionId ?? null,
            result: participant.result ?? 'unknown',
            seat_order: participant.seatOrder ?? null,
            notes: participant.notes ?? null,
          })),
        )
        .select(participantSelect)

      if (insertedParticipantsResult.error) {
        await bestEffortDeleteMatchRecord(client, matchRow.id)

        return err(
          mapQueryError(
            insertedParticipantsResult.error,
            'Failed to create match participants.',
          ),
        )
      }

      return ok(
        mapMatchRow(
          matchRow,
          (insertedParticipantsResult.data ?? []).map(mapMatchParticipantRow),
        ),
      )
    },
  }
}

function resolveMatchHistoryDeckSummary(
  ownerParticipant: MatchParticipantRecord | null,
  deckVersionsById: ReadonlyMap<string, DeckVersionSummaryRow>,
  decksById: ReadonlyMap<string, DeckSummaryRow>,
): MatchHistoryDeckSummaryRecord {
  if (!ownerParticipant?.deckVersionId) {
    return {
      deckId: null,
      title: null,
      versionNumber: null,
    }
  }

  const deckVersion = deckVersionsById.get(ownerParticipant.deckVersionId)

  if (!deckVersion) {
    return {
      deckId: null,
      title: null,
      versionNumber: null,
    }
  }

  const deck = decksById.get(deckVersion.deck_id)

  return {
    deckId: deck?.id ?? null,
    title: deck?.title ?? null,
    versionNumber: deckVersion.version_number,
  }
}

function resolveMatchHistoryOpponentSummary(
  opponentParticipant: MatchParticipantRecord | null,
  visibleProfilesById: ReadonlyMap<string, VisibleProfileSummaryRow>,
): MatchHistoryOpponentSummaryRecord {
  if (!opponentParticipant) {
    return {
      profileId: null,
      displayName: null,
      avatarUrl: null,
      bio: null,
      profileVisible: false,
    }
  }

  const profile = visibleProfilesById.get(opponentParticipant.profileId)

  if (!profile) {
    return {
      profileId: opponentParticipant.profileId,
      displayName: null,
      avatarUrl: null,
      bio: null,
      profileVisible: false,
    }
  }

  return {
    profileId: profile.id,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    profileVisible: true,
  }
}

async function bestEffortDeleteMatchRecord(
  client: DbClient,
  matchId: string,
): Promise<void> {
  await client.schema('social').from('matches').delete().eq('id', matchId)
}
