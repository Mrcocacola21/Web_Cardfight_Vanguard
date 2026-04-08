import type { Tables } from '../../generated/database.types'

import type {
  CatalogCardEntityRecord,
  CatalogCardPrintingRecord,
  CatalogProductRecord,
} from './catalog.types'

type CardEntityRow = Tables<{ schema: 'catalog' }, 'card_entities'>
type ProductRow = Tables<{ schema: 'catalog' }, 'products'>
type CardPrintingRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_printings'>,
  | 'id'
  | 'printing_key'
  | 'card_entity_id'
  | 'collector_number'
  | 'rarity'
  | 'locale_code'
  | 'region_code'
  | 'printed_name'
  | 'art_variant'
  | 'is_alternate_art'
  | 'is_promo_variant'
>

export interface CardPrintingWithProductRow extends CardPrintingRow {
  readonly product: ProductRow | null
}

export function mapCardEntityRow(row: CardEntityRow): CatalogCardEntityRecord {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    name: row.name,
    normalizedName: row.normalized_name,
    grade: row.grade,
    cardType: row.card_type,
    nation: row.nation,
    clan: row.clan,
    race: row.race,
    triggerType: row.trigger_type,
    basePower: row.base_power,
    baseCritical: row.base_critical,
    baseShield: row.base_shield,
    keywords: row.keywords,
    effectRefs: row.effect_refs,
  }
}

export function mapProductRow(row: ProductRow): CatalogProductRecord {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    familyId: row.family_id,
    officialCode: row.official_code,
    name: row.name,
    productCategory: row.product_category,
    productKind: row.product_kind,
    releaseDate: row.release_date,
    regionCode: row.region_code,
    cycleKey: row.cycle_key,
  }
}

export function mapCardPrintingRow(
  row: CardPrintingWithProductRow,
): CatalogCardPrintingRecord {
  if (!row.product) {
    throw new Error('Expected card printing query to include product data.')
  }

  return {
    id: row.id,
    printingKey: row.printing_key,
    cardEntityId: row.card_entity_id,
    collectorNumber: row.collector_number,
    rarity: row.rarity,
    localeCode: row.locale_code,
    regionCode: row.region_code,
    printedName: row.printed_name,
    artVariant: row.art_variant,
    isAlternateArt: row.is_alternate_art,
    isPromoVariant: row.is_promo_variant,
    product: mapProductRow(row.product),
  }
}
