import type { Database } from '../../generated/database.types'
import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import {
  mapDeckCardRow,
  mapDeckAggregateFormatRow,
  mapDeckDetailAggregateRow,
  mapDeckDetailCardsJson,
  mapDeckListSummaryAggregateRow,
  mapDeckRow,
  mapDeckVersionRow,
} from './decks.mappers'
import type {
  CreateDeckInput,
  DeckDetailRecord,
  DeckListItemRecord,
  DeckRecord,
  SaveDeckInput,
} from './decks.types'

type SaveDeckAggregateArgs =
  Database['user_data']['Functions']['save_deck_aggregate']['Args']
type SaveDeckAggregateRow =
  Database['user_data']['Functions']['save_deck_aggregate']['Returns'][number]
const deckSelect =
  'id, owner_profile_id, format_id, title, description, tags, is_favorite, visibility, archived_at, created_at, updated_at, current_version_id'
const deckVersionSelect =
  'id, deck_id, version_number, created_by_profile_id, version_note, created_at'

export interface DecksRepository {
  listDecksByUser(
    ownerProfileId: string,
  ): Promise<RepositoryResult<readonly DeckListItemRecord[]>>
  listDecksByOwner(
    ownerProfileId: string,
  ): Promise<RepositoryResult<readonly DeckListItemRecord[]>>
  getDeckById(id: string): Promise<RepositoryResult<DeckRecord | null>>
  getDeckDetailById(
    id: string,
  ): Promise<RepositoryResult<DeckDetailRecord | null>>
  createDeck(input: CreateDeckInput): Promise<RepositoryResult<DeckRecord>>
  saveDeck(input: SaveDeckInput): Promise<RepositoryResult<DeckRecord>>
  deleteDeck(id: string): Promise<RepositoryResult<void>>
}

export function createDecksRepository(client: DbClient): DecksRepository {
  async function listDecksByUser(
    ownerProfileId: string,
  ): Promise<RepositoryResult<readonly DeckListItemRecord[]>> {
    const { data: deckRows, error: deckError } = await client
      .schema('user_data')
      .rpc('list_deck_summaries', {
        read_owner_profile_id: ownerProfileId,
      })

    if (deckError) {
      return err(mapQueryError(deckError, 'Failed to list decks.'))
    }

    if (!deckRows || deckRows.length === 0) {
      return ok([])
    }

    const decks: DeckListItemRecord[] = []

    for (const deckRow of deckRows) {
      const format = mapDeckAggregateFormatRow(deckRow)

      if (!format) {
        return err({
          code: 'query-failed',
          message: 'Failed to resolve the attached deck format.',
          details: `Deck ${deckRow.deck_id} references missing format ${deckRow.format_id}.`,
        })
      }

      decks.push(mapDeckListSummaryAggregateRow(deckRow, format))
    }

    return ok(decks)
  }

  return {
    listDecksByUser,

    async listDecksByOwner(ownerProfileId) {
      return listDecksByUser(ownerProfileId)
    },

    async getDeckById(id) {
      const { data: deckRow, error: deckError } = await client
        .schema('user_data')
        .from('decks')
        .select(deckSelect)
        .eq('id', id)
        .maybeSingle()

      if (deckError) {
        return err(mapQueryError(deckError, 'Failed to load deck.'))
      }

      if (!deckRow) {
        return ok(null)
      }

      if (!deckRow.current_version_id) {
        return ok(mapDeckRow(deckRow, null))
      }

      const { data: versionRow, error: versionError } = await client
        .schema('user_data')
        .from('deck_versions')
        .select(deckVersionSelect)
        .eq('id', deckRow.current_version_id)
        .eq('deck_id', deckRow.id)
        .maybeSingle()

      if (versionError) {
        return err(
          mapQueryError(versionError, 'Failed to load current deck version.'),
        )
      }

      if (!versionRow) {
        return ok(mapDeckRow(deckRow, null))
      }

      const { data: cardRows, error: cardError } = await client
        .schema('user_data')
        .from('deck_cards')
        .select('section_key, card_entity_id, quantity')
        .eq('deck_version_id', versionRow.id)
        .order('section_key', { ascending: true })
        .order('card_entity_id', { ascending: true })

      if (cardError) {
        return err(
          mapQueryError(cardError, 'Failed to load persisted deck cards.'),
        )
      }

      const currentVersion = mapDeckVersionRow(
        versionRow,
        (cardRows ?? []).map(mapDeckCardRow),
      )

      return ok(mapDeckRow(deckRow, currentVersion))
    },

    async getDeckDetailById(id) {
      const { data: deckRow, error: deckError } = await client
        .schema('user_data')
        .rpc('get_deck_detail_aggregate', {
          read_deck_id: id,
        })
        .maybeSingle()

      if (deckError) {
        return err(mapQueryError(deckError, 'Failed to load deck detail.'))
      }

      if (!deckRow) {
        return ok(null)
      }

      const format = mapDeckAggregateFormatRow(deckRow)

      if (!format) {
        return err({
          code: 'query-failed',
          message: 'Failed to resolve the attached deck format.',
          details: `Deck ${deckRow.deck_id} references missing format ${deckRow.format_id}.`,
        })
      }

      if (deckRow.has_missing_card_entity) {
        return err({
          code: 'query-failed',
          message: 'Failed to resolve a canonical card for the deck.',
          details:
            deckRow.current_version_id === null
              ? 'The current deck version references a missing card entity.'
              : `Deck version ${deckRow.current_version_id} references a missing card entity.`,
        })
      }

      const deckCards = mapDeckDetailCardsJson(deckRow.current_version_cards)

      if (deckCards === null) {
        return err({
          code: 'query-failed',
          message: 'Failed to load deck detail.',
          details: `Deck ${deckRow.deck_id} returned a malformed card aggregate payload.`,
        })
      }

      return ok(mapDeckDetailAggregateRow(deckRow, format, deckCards))
    },

    async createDeck(input) {
      return this.saveDeck(input)
    },

    async saveDeck(input) {
      const cards = input.cards ?? []
      const { data: persistedDeck, error: writeError } = await client
        .schema('user_data')
        .rpc('save_deck_aggregate', buildSaveDeckAggregateArgs(input))
        .single()

      if (writeError) {
        return err(mapSaveDeckError(writeError, input))
      }

      if (!persistedDeck) {
        return err({
          code: 'query-failed',
          message: input.deckId
            ? 'Failed to save deck.'
            : 'Failed to create deck.',
          details:
            'The atomic deck write completed without returning the persisted aggregate.',
        })
      }

      return ok(mapSavedDeckAggregateRow(persistedDeck, cards))
    },

    async deleteDeck(id) {
      const { error } = await client
        .schema('user_data')
        .from('decks')
        .delete()
        .eq('id', id)

      if (error) {
        return err(mapQueryError(error, 'Failed to delete deck.'))
      }

      return ok(undefined)
    },
  }
}

function buildSaveDeckAggregateArgs(
  input: SaveDeckInput,
): SaveDeckAggregateArgs {
  return {
    save_deck_id: input.deckId ?? null,
    save_owner_profile_id: input.ownerProfileId,
    save_format_id: input.formatId,
    save_title: input.title,
    save_description: input.description ?? null,
    save_tags: input.tags ? [...input.tags] : null,
    save_is_favorite: input.isFavorite ?? null,
    save_visibility: input.visibility ?? null,
    save_archived_at: input.archivedAt ?? null,
    save_version_note: input.versionNote ?? null,
    save_cards: input.cards
      ? input.cards.map((card) => ({
          section_key: card.sectionKey,
          card_entity_id: card.cardEntityId,
          quantity: card.quantity,
        }))
      : [],
  }
}

function mapSavedDeckAggregateRow(
  row: SaveDeckAggregateRow,
  cards: NonNullable<SaveDeckInput['cards']>,
): DeckRecord {
  return {
    id: row.deck_id,
    ownerProfileId: row.owner_profile_id,
    formatId: row.format_id,
    title: row.title,
    description: row.description,
    tags: row.tags,
    isFavorite: row.is_favorite,
    visibility: row.visibility,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentVersion: {
      id: row.current_version_id,
      deckId: row.deck_id,
      versionNumber: row.current_version_number,
      createdByProfileId: row.current_version_created_by_profile_id,
      versionNote: row.current_version_note,
      createdAt: row.current_version_created_at,
      cards: (cards ?? []).map((card) => ({
        sectionKey: card.sectionKey,
        cardEntityId: card.cardEntityId,
        quantity: card.quantity,
      })),
    },
  }
}

function mapSaveDeckError(
  error: {
    readonly code?: string | null
    readonly message: string
    readonly details?: string | null
  },
  input: SaveDeckInput,
) {
  if (error.code === 'P0002' && input.deckId) {
    return {
      code: 'conflict' as const,
      message:
        'Failed to save deck because the persisted deck no longer exists.',
      details: error.details ?? error.message,
    }
  }

  if (error.code === '42501' && input.deckId) {
    return {
      code: 'conflict' as const,
      message: 'Failed to save deck because ownership does not match.',
      details: error.details ?? error.message,
    }
  }

  return mapQueryError(
    error,
    input.deckId ? 'Failed to save deck.' : 'Failed to create deck.',
  )
}
