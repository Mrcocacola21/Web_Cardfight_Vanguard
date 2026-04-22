export interface CollectionOwnedPrintingIdentity {
  readonly ownerProfileId: string
  readonly cardPrintingId: string
}

export interface CollectionItemRecord extends CollectionOwnedPrintingIdentity {
  readonly id: string
  readonly quantity: number
  readonly createdAt: string
  readonly updatedAt: string
}

export type CollectionInventoryCatalogState = 'ready' | 'stale'

export interface CollectionInventoryCardRecord {
  readonly id: string
  readonly canonicalKey: string
  readonly name: string
  readonly grade: number
  readonly cardType: string
  readonly nation: string
  readonly clan: string | null
  readonly triggerType: string | null
}

export interface CollectionInventoryProductRecord {
  readonly id: string
  readonly canonicalKey: string
  readonly officialCode: string
  readonly name: string
  readonly productCategory: string
  readonly productKind: string
  readonly releaseDate: string
  readonly regionCode: string | null
}

export interface CollectionInventoryPrintingRecord {
  readonly id: string
  readonly printingKey: string
  readonly collectorNumber: string
  readonly rarity: string
  readonly localeCode: string
  readonly regionCode: string | null
  readonly printedName: string | null
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
  readonly product: CollectionInventoryProductRecord | null
  readonly card: CollectionInventoryCardRecord | null
}

export interface CollectionInventoryItemRecord extends CollectionOwnedPrintingIdentity {
  readonly id: string
  readonly quantity: number
  readonly createdAt: string
  readonly updatedAt: string
  readonly catalogState: CollectionInventoryCatalogState
  readonly printing: CollectionInventoryPrintingRecord | null
}

export type CollectionPreferenceKind = 'wishlist' | 'favorite'

export interface CollectionPrintingPreferenceRecord extends CollectionOwnedPrintingIdentity {
  readonly id: string
  readonly preferenceKind: CollectionPreferenceKind
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CollectionPrintingPreferenceItemRecord extends CollectionOwnedPrintingIdentity {
  readonly id: string
  readonly preferenceKind: CollectionPreferenceKind
  readonly createdAt: string
  readonly updatedAt: string
  readonly catalogState: CollectionInventoryCatalogState
  readonly printing: CollectionInventoryPrintingRecord | null
}

export interface ChangeCollectionItemQuantityInput extends CollectionOwnedPrintingIdentity {
  readonly quantityDelta: number
}

export interface SetCollectionItemQuantityInput extends CollectionOwnedPrintingIdentity {
  readonly quantity: number
}

export type RemoveCollectionItemInput = CollectionOwnedPrintingIdentity

export interface UpsertCollectionPrintingPreferenceInput extends CollectionOwnedPrintingIdentity {
  readonly preferenceKind: CollectionPreferenceKind
}

export interface RemoveCollectionPrintingPreferenceInput extends CollectionOwnedPrintingIdentity {
  readonly preferenceKind: CollectionPreferenceKind
}
