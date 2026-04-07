import type {
  Brand,
  CardId,
  CardPrintingId,
  ProductFamilyId,
  ProductId,
} from '@web-vg/shared'

export type ProductCode = Brand<string, 'ProductCode'>
export type ProductReleaseDate = Brand<string, 'ProductReleaseDate'>
export type RegionCode = Brand<string, 'RegionCode'>
export type LocaleCode = Brand<string, 'LocaleCode'>
export type Rarity = Brand<string, 'Rarity'>
export type ProductCycleKey = Brand<string, 'ProductCycleKey'>

export type ProductLineage =
  | 'standard-lineage'
  | 'v-lineage'
  | 'premium-lineage'
  | 'cross-lineage'

export interface ProductFamily {
  readonly id: ProductFamilyId
  readonly name: string
  readonly lineage: ProductLineage
  readonly parentFamilyId?: ProductFamilyId
}

export interface BoosterProductType {
  readonly category: 'booster'
  readonly boosterKind: 'main' | 'extra' | 'title' | 'lyrical'
}

export interface DeckProductType {
  readonly category: 'deck'
  readonly deckKind: 'trial' | 'start'
}

export interface PromoProductType {
  readonly category: 'promo'
  readonly promoKind: 'standalone' | 'event' | 'bundle' | 'shop' | 'other'
}

export interface SpecialSetProductType {
  readonly category: 'special-set'
  readonly specialSetKind: 'special-series' | 'festival' | 'collector' | 'other'
}

export type ProductType =
  | BoosterProductType
  | DeckProductType
  | PromoProductType
  | SpecialSetProductType

export interface Product {
  readonly id: ProductId
  readonly familyId: ProductFamilyId
  readonly code: ProductCode
  readonly name: string
  readonly type: ProductType
  readonly releaseDate: ProductReleaseDate
  readonly region?: RegionCode
  readonly cycleKey?: ProductCycleKey
}

export interface CardPrinting {
  readonly id: CardPrintingId
  readonly cardId: CardId
  readonly productId: ProductId
  readonly collectorNumber: string
  readonly rarity: Rarity
  readonly locale: LocaleCode
}
