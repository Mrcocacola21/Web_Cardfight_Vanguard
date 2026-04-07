import type { CardType, Grade, TriggerType } from './card-vocabulary'
import type { FormatId, ProductFamilyId } from './identifiers'

export type CapabilitySupportStatus =
  | 'supported'
  | 'partially_supported'
  | 'unsupported'

export type DeckSection = 'main' | 'ride' | 'g'

export type ConstructionBasis = 'nation-based' | 'clan-based' | 'open'

export type ProductEligibilityBasis =
  | 'explicit-family-membership'
  | 'family-membership-with-overrides'
  | 'broad-english-pool'

export type RestrictionModelCompatibility =
  | 'official-list'
  | 'official-list-with-overrides'

export type FormatGameplayMarker =
  | 'ride-deck'
  | 'g-zone'
  | 'stride'
  | 'imaginary-gift'
  | 'overdress'
  | 'over-trigger'

export interface Format {
  readonly id: FormatId
  readonly displayName: string
}

export interface FormatCapabilitySet {
  readonly supportsRideDeck: boolean
  readonly supportsGDeck: boolean
  readonly supportsStride: boolean
  readonly supportsImaginaryGift: boolean
  readonly supportsOverDress: boolean
  readonly gameplayMarkers: readonly FormatGameplayMarker[]
}

export interface FormatMechanicSupport {
  readonly capability: FormatGameplayMarker | (string & {})
  readonly support: CapabilitySupportStatus
}

export interface FormatSupportMatrix {
  readonly deckBuilding: CapabilitySupportStatus
  readonly legality: CapabilitySupportStatus
  readonly gameplay: CapabilitySupportStatus
  readonly mechanics: readonly FormatMechanicSupport[]
}

export interface DeckSectionConstraint {
  readonly section: DeckSection
  readonly minCards: number
  readonly maxCards: number
  readonly required: boolean
  readonly allowedGrades?: readonly Grade[]
  readonly allowedCardTypes?: readonly CardType[]
}

export interface DuplicateConstraint {
  readonly appliesToSections: readonly DeckSection[]
  readonly defaultMaxCopiesPerCard: number
}

export interface TriggerTypeConstraint {
  readonly triggerType: TriggerType
  readonly maxCopies: number
}

export interface TriggerConstraint {
  readonly appliesToSection: 'main'
  readonly maxTotalTriggers: number
  readonly perTypeLimits: readonly TriggerTypeConstraint[]
}

export interface DeckConstructionRules {
  readonly duplicateConstraint: DuplicateConstraint
  readonly triggerConstraint?: TriggerConstraint
}

export interface ProductEligibilityPolicy {
  readonly basis: ProductEligibilityBasis
  readonly supportedProductFamilies: readonly ProductFamilyId[]
}

export interface FormatProfile {
  readonly formatId: FormatId
  readonly displayName: string
  readonly constructionBasis: ConstructionBasis
  readonly productEligibility: ProductEligibilityPolicy
  readonly deckStructure: readonly DeckSectionConstraint[]
  readonly constructionRules: DeckConstructionRules
  readonly capabilities: FormatCapabilitySet
  readonly restrictionCompatibility: RestrictionModelCompatibility
}
