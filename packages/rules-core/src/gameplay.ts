import type {
  DeckSection,
  EffectRef,
  FormatGameplayMarker,
  FormatId,
  GameplayCard,
} from '@web-vg/shared'

export type GameplayZone =
  | 'deck'
  | 'hand'
  | 'drop'
  | 'damage'
  | 'soul'
  | 'field'
  | 'order-zone'
  | 'ride-deck'
  | 'g-zone'

export interface GameplayFormatProjection {
  readonly formatId: FormatId
  readonly enabledSections: readonly DeckSection[]
  readonly activeMarkers: readonly FormatGameplayMarker[]
  readonly zones: readonly GameplayZone[]
}

export type { EffectRef, GameplayCard }
