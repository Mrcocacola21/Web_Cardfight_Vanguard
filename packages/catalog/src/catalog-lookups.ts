import type { CardId, CardPrintingId, ProductId } from '@web-vg/shared'

import type {
  CanonicalCardKey,
  CardPrintingKey,
  ProductCanonicalKey,
} from './catalog-identifiers'

export interface CatalogCardEntityLookupById {
  readonly target: 'card-entity'
  readonly by: 'id'
  readonly value: CardId
}

export interface CatalogCardEntityLookupByCanonicalKey {
  readonly target: 'card-entity'
  readonly by: 'canonical-key'
  readonly value: CanonicalCardKey
}

export type CatalogCardEntityLookup =
  | CatalogCardEntityLookupById
  | CatalogCardEntityLookupByCanonicalKey

export interface CatalogCardPrintingLookupById {
  readonly target: 'card-printing'
  readonly by: 'id'
  readonly value: CardPrintingId
}

export interface CatalogCardPrintingLookupByPrintingKey {
  readonly target: 'card-printing'
  readonly by: 'printing-key'
  readonly value: CardPrintingKey
}

export type CatalogCardPrintingLookup =
  | CatalogCardPrintingLookupById
  | CatalogCardPrintingLookupByPrintingKey

export interface CatalogProductLookupById {
  readonly target: 'product'
  readonly by: 'id'
  readonly value: ProductId
}

export interface CatalogProductLookupByCanonicalKey {
  readonly target: 'product'
  readonly by: 'canonical-key'
  readonly value: ProductCanonicalKey
}

export type CatalogProductLookup =
  | CatalogProductLookupById
  | CatalogProductLookupByCanonicalKey

export type CatalogLookup =
  | CatalogCardEntityLookup
  | CatalogCardPrintingLookup
  | CatalogProductLookup

export function cardEntityLookupById(
  value: CardId,
): CatalogCardEntityLookupById {
  return {
    target: 'card-entity',
    by: 'id',
    value,
  }
}

export function cardEntityLookupByCanonicalKey(
  value: CanonicalCardKey,
): CatalogCardEntityLookupByCanonicalKey {
  return {
    target: 'card-entity',
    by: 'canonical-key',
    value,
  }
}

export function cardPrintingLookupById(
  value: CardPrintingId,
): CatalogCardPrintingLookupById {
  return {
    target: 'card-printing',
    by: 'id',
    value,
  }
}

export function cardPrintingLookupByPrintingKey(
  value: CardPrintingKey,
): CatalogCardPrintingLookupByPrintingKey {
  return {
    target: 'card-printing',
    by: 'printing-key',
    value,
  }
}

export function productLookupById(value: ProductId): CatalogProductLookupById {
  return {
    target: 'product',
    by: 'id',
    value,
  }
}

export function productLookupByCanonicalKey(
  value: ProductCanonicalKey,
): CatalogProductLookupByCanonicalKey {
  return {
    target: 'product',
    by: 'canonical-key',
    value,
  }
}

export function isCardEntityLookup(
  lookup: CatalogLookup,
): lookup is CatalogCardEntityLookup {
  return lookup.target === 'card-entity'
}

export function isCardPrintingLookup(
  lookup: CatalogLookup,
): lookup is CatalogCardPrintingLookup {
  return lookup.target === 'card-printing'
}

export function isProductLookup(
  lookup: CatalogLookup,
): lookup is CatalogProductLookup {
  return lookup.target === 'product'
}
