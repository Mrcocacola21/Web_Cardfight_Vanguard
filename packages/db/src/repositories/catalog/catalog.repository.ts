import type { QueryData } from '@supabase/supabase-js'

import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import { mapCardEntityRow, mapCardPrintingRow } from './catalog.mappers'
import type {
  CatalogCardEntityRecord,
  CatalogCardPrintingRecord,
} from './catalog.types'

const cardEntitySelect =
  'id, canonical_key, name, normalized_name, grade, card_type, nation, clan, race, trigger_type, base_power, base_critical, base_shield, keywords, effect_refs'

export interface CatalogRepository {
  listCardEntities(): Promise<
    RepositoryResult<readonly CatalogCardEntityRecord[]>
  >
  getCardEntityById(
    id: string,
  ): Promise<RepositoryResult<CatalogCardEntityRecord | null>>
  getCardEntityByCanonicalKey(
    canonicalKey: string,
  ): Promise<RepositoryResult<CatalogCardEntityRecord | null>>
  listCardPrintings(
    cardEntityId: string,
  ): Promise<RepositoryResult<readonly CatalogCardPrintingRecord[]>>
}

export function createCatalogRepository(client: DbClient): CatalogRepository {
  return {
    async listCardEntities() {
      const { data, error } = await client
        .schema('catalog')
        .from('card_entities')
        .select(cardEntitySelect)
        .order('grade', { ascending: true })
        .order('normalized_name', { ascending: true })

      if (error) {
        return err(
          mapQueryError(error, 'Failed to list catalog card entities.'),
        )
      }

      return ok((data ?? []).map(mapCardEntityRow))
    },

    async getCardEntityById(id) {
      const { data, error } = await client
        .schema('catalog')
        .from('card_entities')
        .select(cardEntitySelect)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load catalog card entity.'))
      }

      return ok(data ? mapCardEntityRow(data) : null)
    },

    async getCardEntityByCanonicalKey(canonicalKey) {
      const { data, error } = await client
        .schema('catalog')
        .from('card_entities')
        .select(cardEntitySelect)
        .eq('canonical_key', canonicalKey)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load catalog card entity.'))
      }

      return ok(data ? mapCardEntityRow(data) : null)
    },

    async listCardPrintings(cardEntityId) {
      const query = client
        .schema('catalog')
        .from('card_printings')
        .select(
          'id, printing_key, card_entity_id, collector_number, rarity, locale_code, region_code, printed_name, art_variant, is_alternate_art, is_promo_variant, product:products(id, canonical_key, family_id, official_code, name, product_category, product_kind, release_date, region_code, cycle_key)',
        )
        .eq('card_entity_id', cardEntityId)
        .order('collector_number', { ascending: true })

      type CardPrintingQueryResult = QueryData<typeof query>

      const { data, error } = await query

      if (error) {
        return err(
          mapQueryError(error, 'Failed to load catalog card printings.'),
        )
      }

      const rows: CardPrintingQueryResult = data ?? []

      return ok(rows.map(mapCardPrintingRow))
    },
  }
}
