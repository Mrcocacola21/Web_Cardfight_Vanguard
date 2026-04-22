import type { Tables } from '../../index'

import type {
  CollectionInventoryCardRecord,
  CollectionInventoryItemRecord,
  CollectionInventoryPrintingRecord,
  CollectionInventoryProductRecord,
  CollectionItemRecord,
  CollectionPreferenceKind,
  CollectionPrintingPreferenceItemRecord,
  CollectionPrintingPreferenceRecord,
} from './collections.types'

type CollectionItemRow = Tables<{ schema: 'user_data' }, 'collection_items'>
type CollectionPrintingPreferenceRow = Tables<
  { schema: 'user_data' },
  'collection_printing_preferences'
>
type CollectionInventoryCardRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_entities'>,
  | 'id'
  | 'canonical_key'
  | 'name'
  | 'grade'
  | 'card_type'
  | 'nation'
  | 'clan'
  | 'trigger_type'
>
type CollectionInventoryProductRow = Pick<
  Tables<{ schema: 'catalog' }, 'products'>,
  | 'id'
  | 'canonical_key'
  | 'official_code'
  | 'name'
  | 'product_category'
  | 'product_kind'
  | 'release_date'
  | 'region_code'
>
type CollectionInventoryPrintingRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_printings'>,
  | 'id'
  | 'printing_key'
  | 'collector_number'
  | 'rarity'
  | 'locale_code'
  | 'region_code'
  | 'printed_name'
  | 'art_variant'
  | 'is_alternate_art'
  | 'is_promo_variant'
> & {
  readonly product: CollectionInventoryProductRow | null
  readonly card: CollectionInventoryCardRow | null
}

export interface CollectionInventoryWithRelationsRow extends CollectionItemRow {
  readonly printing: CollectionInventoryPrintingRow | null
}

export interface CollectionPrintingPreferenceWithRelationsRow extends CollectionPrintingPreferenceRow {
  readonly printing: CollectionInventoryPrintingRow | null
}

export function mapCollectionItemRow(
  row: CollectionItemRow,
): CollectionItemRecord {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    cardPrintingId: row.card_printing_id,
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCollectionInventoryItemRow(
  row: CollectionInventoryWithRelationsRow,
): CollectionInventoryItemRecord {
  return {
    ...mapCollectionItemRow(row),
    catalogState: row.printing ? 'ready' : 'stale',
    printing: row.printing
      ? mapCollectionInventoryPrintingRow(row.printing)
      : null,
  }
}

export function mapCollectionPrintingPreferenceRow(
  row: CollectionPrintingPreferenceRow,
): CollectionPrintingPreferenceRecord {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    cardPrintingId: row.card_printing_id,
    preferenceKind: row.preference_kind as CollectionPreferenceKind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCollectionPrintingPreferenceItemRow(
  row: CollectionPrintingPreferenceWithRelationsRow,
): CollectionPrintingPreferenceItemRecord {
  return {
    ...mapCollectionPrintingPreferenceRow(row),
    catalogState: row.printing ? 'ready' : 'stale',
    printing: row.printing
      ? mapCollectionInventoryPrintingRow(row.printing)
      : null,
  }
}

function mapCollectionInventoryPrintingRow(
  row: CollectionInventoryPrintingRow,
): CollectionInventoryPrintingRecord {
  return {
    id: row.id,
    printingKey: row.printing_key,
    collectorNumber: row.collector_number,
    rarity: row.rarity,
    localeCode: row.locale_code,
    regionCode: row.region_code,
    printedName: row.printed_name,
    artVariant: row.art_variant,
    isAlternateArt: row.is_alternate_art,
    isPromoVariant: row.is_promo_variant,
    product: row.product ? mapCollectionInventoryProductRow(row.product) : null,
    card: row.card ? mapCollectionInventoryCardRow(row.card) : null,
  }
}

function mapCollectionInventoryProductRow(
  row: CollectionInventoryProductRow,
): CollectionInventoryProductRecord {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    officialCode: row.official_code,
    name: row.name,
    productCategory: row.product_category,
    productKind: row.product_kind,
    releaseDate: row.release_date,
    regionCode: row.region_code,
  }
}

function mapCollectionInventoryCardRow(
  row: CollectionInventoryCardRow,
): CollectionInventoryCardRecord {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    name: row.name,
    grade: row.grade,
    cardType: row.card_type,
    nation: row.nation,
    clan: row.clan,
    triggerType: row.trigger_type,
  }
}
