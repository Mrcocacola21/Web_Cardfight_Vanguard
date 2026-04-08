import type { Tables } from '../../generated/database.types'
import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import {
  createDeckSectionCounts,
  mapDeckCardRow,
  mapDeckDetailCardRow,
  mapDeckDetailRow,
  mapDeckDetailVersionRow,
  mapDeckFormatRow,
  mapDeckListItemRow,
  mapDeckRow,
  mapDeckVersionRow,
} from './decks.mappers'
import type {
  CreateDeckInput,
  DeckDetailRecord,
  DeckListItemRecord,
  DeckRecord,
} from './decks.types'

type DeckVersionRow = Tables<{ schema: 'user_data' }, 'deck_versions'>
type DeckCardRow = Pick<
  Tables<{ schema: 'user_data' }, 'deck_cards'>,
  'deck_version_id' | 'section_key' | 'card_entity_id' | 'quantity'
>
type CardEntitySummaryRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_entities'>,
  'id' | 'canonical_key' | 'name' | 'grade' | 'card_type' | 'trigger_type'
>

const deckSelect =
  'id, owner_profile_id, format_id, title, description, visibility, archived_at, created_at, updated_at, current_version_id'
const deckVersionSelect =
  'id, deck_id, version_number, created_by_profile_id, version_note, created_at'
const deckCardSelect = 'deck_version_id, section_key, card_entity_id, quantity'
const formatSelect = 'id, display_name, description'
const cardEntitySummarySelect =
  'id, canonical_key, name, grade, card_type, trigger_type'

export interface DecksRepository {
  listDecksByOwner(
    ownerProfileId: string,
  ): Promise<RepositoryResult<readonly DeckListItemRecord[]>>
  getDeckById(id: string): Promise<RepositoryResult<DeckRecord | null>>
  getDeckDetailById(
    id: string,
  ): Promise<RepositoryResult<DeckDetailRecord | null>>
  createDeck(input: CreateDeckInput): Promise<RepositoryResult<DeckRecord>>
}

export function createDecksRepository(client: DbClient): DecksRepository {
  return {
    async listDecksByOwner(ownerProfileId) {
      const { data: deckRows, error: deckError } = await client
        .schema('user_data')
        .from('decks')
        .select(deckSelect)
        .eq('owner_profile_id', ownerProfileId)
        .order('updated_at', { ascending: false })

      if (deckError) {
        return err(mapQueryError(deckError, 'Failed to list decks.'))
      }

      if (!deckRows || deckRows.length === 0) {
        return ok([])
      }

      const formatMapResult = await loadFormatsByIds(
        client,
        deckRows.map((deckRow) => deckRow.format_id),
      )

      if (!formatMapResult.ok) {
        return formatMapResult
      }

      const versionMapResult = await loadDeckVersionsByIds(
        client,
        deckRows.flatMap((deckRow) =>
          deckRow.current_version_id ? [deckRow.current_version_id] : [],
        ),
      )

      if (!versionMapResult.ok) {
        return versionMapResult
      }

      const cardRowsByVersionResult = await loadDeckCardsByVersionIds(
        client,
        Array.from(versionMapResult.data.keys()),
      )

      if (!cardRowsByVersionResult.ok) {
        return cardRowsByVersionResult
      }

      const decks: DeckListItemRecord[] = []

      for (const deckRow of deckRows) {
        const format = formatMapResult.data.get(deckRow.format_id)

        if (!format) {
          return err({
            code: 'query-failed',
            message: 'Failed to resolve the attached deck format.',
            details: `Deck ${deckRow.id} references missing format ${deckRow.format_id}.`,
          })
        }

        const currentVersion = deckRow.current_version_id
          ? (versionMapResult.data.get(deckRow.current_version_id) ?? null)
          : null
        const versionCards = currentVersion
          ? (cardRowsByVersionResult.data.get(currentVersion.id) ?? [])
          : []

        decks.push(
          mapDeckListItemRow(
            deckRow,
            format,
            currentVersion,
            createDeckSectionCounts(versionCards),
          ),
        )
      }

      return ok(decks)
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
        .from('decks')
        .select(deckSelect)
        .eq('id', id)
        .maybeSingle()

      if (deckError) {
        return err(mapQueryError(deckError, 'Failed to load deck detail.'))
      }

      if (!deckRow) {
        return ok(null)
      }

      const formatMapResult = await loadFormatsByIds(client, [
        deckRow.format_id,
      ])

      if (!formatMapResult.ok) {
        return formatMapResult
      }

      const format = formatMapResult.data.get(deckRow.format_id)

      if (!format) {
        return err({
          code: 'query-failed',
          message: 'Failed to resolve the attached deck format.',
          details: `Deck ${deckRow.id} references missing format ${deckRow.format_id}.`,
        })
      }

      if (!deckRow.current_version_id) {
        return ok(mapDeckDetailRow(deckRow, format, null))
      }

      const versionMapResult = await loadDeckVersionsByIds(client, [
        deckRow.current_version_id,
      ])

      if (!versionMapResult.ok) {
        return versionMapResult
      }

      const versionRow = versionMapResult.data.get(deckRow.current_version_id)

      if (!versionRow) {
        return ok(mapDeckDetailRow(deckRow, format, null))
      }

      const cardRowsByVersionResult = await loadDeckCardsByVersionIds(client, [
        versionRow.id,
      ])

      if (!cardRowsByVersionResult.ok) {
        return cardRowsByVersionResult
      }

      const versionCardRows =
        cardRowsByVersionResult.data.get(versionRow.id) ?? []

      const cardEntityMapResult = await loadCardEntitiesByIds(
        client,
        versionCardRows.map((cardRow) => cardRow.card_entity_id),
      )

      if (!cardEntityMapResult.ok) {
        return cardEntityMapResult
      }

      const deckCards = []

      for (const cardRow of versionCardRows) {
        const cardEntity = cardEntityMapResult.data.get(cardRow.card_entity_id)

        if (!cardEntity) {
          return err({
            code: 'query-failed',
            message: 'Failed to resolve a canonical card for the deck.',
            details: `Deck version ${versionRow.id} references missing card entity ${cardRow.card_entity_id}.`,
          })
        }

        deckCards.push(mapDeckDetailCardRow(cardRow, cardEntity))
      }

      const currentVersion = mapDeckDetailVersionRow(versionRow, deckCards)

      return ok(mapDeckDetailRow(deckRow, format, currentVersion))
    },

    async createDeck(input) {
      const cleanupIds: {
        deckId?: string
        deckVersionId?: string
      } = {}

      const cards = input.cards ?? []
      const updatedAt = new Date().toISOString()

      const { data: deckRow, error: deckError } = await client
        .schema('user_data')
        .from('decks')
        .insert({
          owner_profile_id: input.ownerProfileId,
          format_id: input.formatId,
          title: input.title,
          description: input.description ?? null,
          visibility: input.visibility ?? 'private',
        })
        .select(deckSelect)
        .single()

      if (deckError) {
        return err(mapQueryError(deckError, 'Failed to create deck.'))
      }

      cleanupIds.deckId = deckRow.id

      const { data: versionRow, error: versionError } = await client
        .schema('user_data')
        .from('deck_versions')
        .insert({
          deck_id: deckRow.id,
          version_number: 1,
          created_by_profile_id: input.ownerProfileId,
          version_note: input.versionNote ?? null,
        })
        .select(deckVersionSelect)
        .single()

      if (versionError) {
        await bestEffortDeleteDeck(client, cleanupIds.deckId)

        return err(
          mapQueryError(versionError, 'Failed to create initial deck version.'),
        )
      }

      cleanupIds.deckVersionId = versionRow.id

      if (cards.length > 0) {
        const { error: cardsError } = await client
          .schema('user_data')
          .from('deck_cards')
          .insert(
            cards.map((card) => ({
              deck_version_id: versionRow.id,
              section_key: card.sectionKey,
              card_entity_id: card.cardEntityId,
              quantity: card.quantity,
            })),
          )

        if (cardsError) {
          await bestEffortDeleteDeckVersion(client, cleanupIds.deckVersionId)
          await bestEffortDeleteDeck(client, cleanupIds.deckId)

          return err(
            mapQueryError(cardsError, 'Failed to persist initial deck cards.'),
          )
        }
      }

      const { error: updateError } = await client
        .schema('user_data')
        .from('decks')
        .update({
          current_version_id: versionRow.id,
          updated_at: updatedAt,
        })
        .eq('id', deckRow.id)

      if (updateError) {
        await bestEffortDeleteDeckVersion(client, cleanupIds.deckVersionId)
        await bestEffortDeleteDeck(client, cleanupIds.deckId)

        return err(
          mapQueryError(
            updateError,
            'Failed to attach the initial deck version to the deck.',
          ),
        )
      }

      const currentVersion = mapDeckVersionRow(
        versionRow,
        cards.map((card) => ({
          sectionKey: card.sectionKey,
          cardEntityId: card.cardEntityId,
          quantity: card.quantity,
        })),
      )

      return ok(
        mapDeckRow(
          {
            ...deckRow,
            current_version_id: versionRow.id,
            updated_at: updatedAt,
          },
          currentVersion,
        ),
      )
    },
  }
}

async function loadFormatsByIds(
  client: DbClient,
  formatIds: readonly string[],
): Promise<
  RepositoryResult<ReadonlyMap<string, ReturnType<typeof mapDeckFormatRow>>>
> {
  const uniqueFormatIds = Array.from(new Set(formatIds))

  if (uniqueFormatIds.length === 0) {
    return ok(new Map())
  }

  const { data, error } = await client
    .schema('legality')
    .from('formats')
    .select(formatSelect)
    .in('id', uniqueFormatIds)

  if (error) {
    return err(mapQueryError(error, 'Failed to load attached deck formats.'))
  }

  const formatMap = new Map<string, ReturnType<typeof mapDeckFormatRow>>()

  for (const row of data ?? []) {
    formatMap.set(row.id, mapDeckFormatRow(row))
  }

  return ok(formatMap)
}

async function loadDeckVersionsByIds(
  client: DbClient,
  versionIds: readonly string[],
): Promise<RepositoryResult<ReadonlyMap<string, DeckVersionRow>>> {
  const uniqueVersionIds = Array.from(new Set(versionIds))

  if (uniqueVersionIds.length === 0) {
    return ok(new Map())
  }

  const { data, error } = await client
    .schema('user_data')
    .from('deck_versions')
    .select(deckVersionSelect)
    .in('id', uniqueVersionIds)

  if (error) {
    return err(mapQueryError(error, 'Failed to load current deck versions.'))
  }

  return ok(
    new Map(
      (data ?? []).map(
        (row) => [row.id, row] satisfies [string, DeckVersionRow],
      ),
    ),
  )
}

async function loadDeckCardsByVersionIds(
  client: DbClient,
  versionIds: readonly string[],
): Promise<RepositoryResult<ReadonlyMap<string, readonly DeckCardRow[]>>> {
  const uniqueVersionIds = Array.from(new Set(versionIds))

  if (uniqueVersionIds.length === 0) {
    return ok(new Map())
  }

  const { data, error } = await client
    .schema('user_data')
    .from('deck_cards')
    .select(deckCardSelect)
    .in('deck_version_id', uniqueVersionIds)
    .order('section_key', { ascending: true })
    .order('card_entity_id', { ascending: true })

  if (error) {
    return err(mapQueryError(error, 'Failed to load persisted deck cards.'))
  }

  const cardsByVersion = new Map<string, DeckCardRow[]>()

  for (const row of data ?? []) {
    const versionCards = cardsByVersion.get(row.deck_version_id)

    if (versionCards) {
      versionCards.push(row)
      continue
    }

    cardsByVersion.set(row.deck_version_id, [row])
  }

  return ok(cardsByVersion)
}

async function loadCardEntitiesByIds(
  client: DbClient,
  cardEntityIds: readonly string[],
): Promise<RepositoryResult<ReadonlyMap<string, CardEntitySummaryRow>>> {
  const uniqueCardEntityIds = Array.from(new Set(cardEntityIds))

  if (uniqueCardEntityIds.length === 0) {
    return ok(new Map())
  }

  const { data, error } = await client
    .schema('catalog')
    .from('card_entities')
    .select(cardEntitySummarySelect)
    .in('id', uniqueCardEntityIds)

  if (error) {
    return err(
      mapQueryError(error, 'Failed to load canonical cards for the deck.'),
    )
  }

  return ok(
    new Map(
      (data ?? []).map(
        (row) => [row.id, row] satisfies [string, CardEntitySummaryRow],
      ),
    ),
  )
}

async function bestEffortDeleteDeckVersion(
  client: DbClient,
  deckVersionId: string | undefined,
): Promise<void> {
  if (!deckVersionId) {
    return
  }

  await client
    .schema('user_data')
    .from('deck_versions')
    .delete()
    .eq('id', deckVersionId)
}

async function bestEffortDeleteDeck(
  client: DbClient,
  deckId: string | undefined,
): Promise<void> {
  if (!deckId) {
    return
  }

  await client.schema('user_data').from('decks').delete().eq('id', deckId)
}
