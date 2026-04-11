import type { Tables } from '../../generated/database.types'

import type {
  CatalogCardEntityRecord,
  CatalogCardPrintingDetailRecord,
  CatalogCardPrintingRecord,
  CatalogProductDetailRecord,
  CatalogProductPrintingCardRecord,
  CatalogProductPrintingRecord,
  CatalogProductRecord,
} from './catalog.types'

type CardEntityRow = Tables<{ schema: 'catalog' }, 'card_entities'>
type ProductRow = Pick<
  Tables<{ schema: 'catalog' }, 'products'>,
  | 'id'
  | 'canonical_key'
  | 'family_id'
  | 'official_code'
  | 'name'
  | 'product_category'
  | 'product_kind'
  | 'release_date'
  | 'region_code'
  | 'cycle_key'
>
type ProductFamilyRow = Pick<
  Tables<{ schema: 'catalog' }, 'product_families'>,
  'id' | 'display_name' | 'lineage'
>
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

type ProductPrintingRow = Omit<CardPrintingRow, 'card_entity_id'>

export interface CardPrintingWithProductRow extends CardPrintingRow {
  readonly product: ProductRow | null
}

export interface CardPrintingDetailWithRelationsRow extends CardPrintingRow {
  readonly product: ProductRow | null
  readonly card: CardEntityRow | null
}

export interface ProductWithFamilyRow extends ProductRow {
  readonly family: ProductFamilyRow | null
}

type ProductPrintingCardRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_entities'>,
  | 'id'
  | 'canonical_key'
  | 'name'
  | 'grade'
  | 'card_type'
  | 'trigger_type'
  | 'nation'
  | 'clan'
>

export interface ProductPrintingWithCardRow extends ProductPrintingRow {
  readonly card: ProductPrintingCardRow | null
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

export function mapProductDetailRow(
  row: ProductWithFamilyRow,
): CatalogProductDetailRecord {
  if (!row.family) {
    throw new Error('Expected product detail query to include family data.')
  }

  return {
    ...mapProductRow(row),
    family: {
      id: row.family.id,
      displayName: row.family.display_name,
      lineage: row.family.lineage,
    },
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

export function mapCardPrintingDetailRow(
  row: CardPrintingDetailWithRelationsRow,
): CatalogCardPrintingDetailRecord {
  if (!row.product) {
    throw new Error(
      'Expected card printing detail query to include product data.',
    )
  }

  if (!row.card) {
    throw new Error('Expected card printing detail query to include card data.')
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
    card: mapCardEntityRow(row.card),
  }
}

function mapProductPrintingCardRow(
  row: ProductPrintingCardRow,
): CatalogProductPrintingCardRecord {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    name: row.name,
    grade: row.grade,
    cardType: row.card_type,
    triggerType: row.trigger_type,
    nation: row.nation,
    clan: row.clan,
  }
}

export function mapProductPrintingRow(
  row: ProductPrintingWithCardRow,
): CatalogProductPrintingRecord {
  if (!row.card) {
    throw new Error('Expected product printing query to include card data.')
  }

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
    card: mapProductPrintingCardRow(row.card),
  }
}
