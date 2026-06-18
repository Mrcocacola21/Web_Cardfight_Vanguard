import type { Tables } from '../../generated/database.types'
import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import type {
  CreateMatchLobbyInviteInput,
  MatchLobbyInviteRecord,
  MatchLobbyInviteStatus,
  SetMatchLobbyDeckInput,
  SetMatchLobbyReadyInput,
} from './match-lobby.types'

type MatchLobbyInviteRow = Tables<{ schema: 'social' }, 'match_lobby_invites'>

const inviteSelect =
  'id, requester_profile_id, invitee_profile_id, format_id, status, requester_deck_id, invitee_deck_id, requester_ready, invitee_ready, started_room_id, created_at, responded_at, updated_at'

export interface MatchLobbyRepository {
  createInvite(
    input: CreateMatchLobbyInviteInput,
  ): Promise<RepositoryResult<MatchLobbyInviteRecord>>
  getInviteById(
    inviteId: string,
  ): Promise<RepositoryResult<MatchLobbyInviteRecord | null>>
  listInvitesForProfile(
    profileId: string,
    limit: number,
  ): Promise<RepositoryResult<readonly MatchLobbyInviteRecord[]>>
  updateInviteStatus(input: {
    readonly inviteId: string
    readonly status: Exclude<MatchLobbyInviteStatus, 'started'>
    readonly respondedAt: string | null
    readonly updatedAt: string
  }): Promise<RepositoryResult<MatchLobbyInviteRecord>>
  setDeckSelection(
    input: SetMatchLobbyDeckInput & { readonly updatedAt: string },
  ): Promise<RepositoryResult<MatchLobbyInviteRecord>>
  setReady(
    input: SetMatchLobbyReadyInput & { readonly updatedAt: string },
  ): Promise<RepositoryResult<MatchLobbyInviteRecord>>
  markStarted(input: {
    readonly inviteId: string
    readonly roomId: string
    readonly updatedAt: string
  }): Promise<RepositoryResult<MatchLobbyInviteRecord>>
}

export function createMatchLobbyRepository(
  client: DbClient,
): MatchLobbyRepository {
  return {
    async createInvite(input) {
      const { data, error } = await client
        .schema('social')
        .from('match_lobby_invites')
        .insert({
          requester_profile_id: input.requesterProfileId,
          invitee_profile_id: input.inviteeProfileId,
          format_id: input.formatId,
          status: 'pending',
        })
        .select(inviteSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to create match invite.'))
      }

      return ok(mapInviteRow(data))
    },

    async getInviteById(inviteId) {
      const { data, error } = await client
        .schema('social')
        .from('match_lobby_invites')
        .select(inviteSelect)
        .eq('id', inviteId)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load match lobby invite.'))
      }

      return ok(data ? mapInviteRow(data) : null)
    },

    async listInvitesForProfile(profileId, limit) {
      const normalizedLimit = Math.max(1, Math.min(Math.trunc(limit), 50))
      const { data, error } = await client
        .schema('social')
        .from('match_lobby_invites')
        .select(inviteSelect)
        .or(
          `requester_profile_id.eq.${profileId},invitee_profile_id.eq.${profileId}`,
        )
        .order('created_at', { ascending: false })
        .limit(normalizedLimit)

      if (error) {
        return err(mapQueryError(error, 'Failed to list match lobby invites.'))
      }

      return ok((data ?? []).map(mapInviteRow))
    },

    async updateInviteStatus(input) {
      const { data, error } = await client
        .schema('social')
        .from('match_lobby_invites')
        .update({
          status: input.status,
          responded_at: input.respondedAt,
          updated_at: input.updatedAt,
        })
        .eq('id', input.inviteId)
        .select(inviteSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to update match invite.'))
      }

      return ok(mapInviteRow(data))
    },

    async setDeckSelection(input) {
      const invite = await this.getInviteById(input.inviteId)

      if (!invite.ok) {
        return invite
      }

      if (!invite.data) {
        return err({
          code: 'query-failed',
          message: 'Match lobby invite does not exist.',
        })
      }

      const update =
        input.profileId === invite.data.requesterProfileId
          ? {
              requester_deck_id: input.deckId,
              requester_ready: false,
            }
          : input.profileId === invite.data.inviteeProfileId
            ? {
                invitee_deck_id: input.deckId,
                invitee_ready: false,
              }
            : null

      if (update === null) {
        return err({
          code: 'query-failed',
          message: 'Only lobby participants can choose a deck.',
        })
      }

      const { data, error } = await client
        .schema('social')
        .from('match_lobby_invites')
        .update({
          ...update,
          updated_at: input.updatedAt,
        })
        .eq('id', input.inviteId)
        .select(inviteSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to choose lobby deck.'))
      }

      return ok(mapInviteRow(data))
    },

    async setReady(input) {
      const invite = await this.getInviteById(input.inviteId)

      if (!invite.ok) {
        return invite
      }

      if (!invite.data) {
        return err({
          code: 'query-failed',
          message: 'Match lobby invite does not exist.',
        })
      }

      const update =
        input.profileId === invite.data.requesterProfileId
          ? {
              requester_ready: input.ready,
            }
          : input.profileId === invite.data.inviteeProfileId
            ? {
                invitee_ready: input.ready,
              }
            : null

      if (update === null) {
        return err({
          code: 'query-failed',
          message: 'Only lobby participants can change ready state.',
        })
      }

      const { data, error } = await client
        .schema('social')
        .from('match_lobby_invites')
        .update({
          ...update,
          updated_at: input.updatedAt,
        })
        .eq('id', input.inviteId)
        .select(inviteSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to update ready state.'))
      }

      return ok(mapInviteRow(data))
    },

    async markStarted(input) {
      const { data, error } = await client
        .schema('social')
        .from('match_lobby_invites')
        .update({
          status: 'started',
          started_room_id: input.roomId,
          updated_at: input.updatedAt,
        })
        .eq('id', input.inviteId)
        .select(inviteSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to mark lobby as started.'))
      }

      return ok(mapInviteRow(data))
    },
  }
}

function mapInviteRow(row: MatchLobbyInviteRow): MatchLobbyInviteRecord {
  return {
    id: row.id,
    requesterProfileId: row.requester_profile_id,
    inviteeProfileId: row.invitee_profile_id,
    formatId: row.format_id,
    status: row.status as MatchLobbyInviteStatus,
    requesterDeckId: row.requester_deck_id,
    inviteeDeckId: row.invitee_deck_id,
    requesterReady: row.requester_ready,
    inviteeReady: row.invitee_ready,
    startedRoomId: row.started_room_id,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    updatedAt: row.updated_at,
  }
}
