import type { DeckSection, FormatGameplayMarker } from '@web-vg/shared'

import type { GameplayFormatProjection, GameplayZone } from './gameplay'

export function projectionEnablesSection(
  projection: GameplayFormatProjection,
  section: DeckSection,
): boolean {
  return projection.enabledSections.includes(section)
}

export function projectionEnablesZone(
  projection: GameplayFormatProjection,
  zone: GameplayZone,
): boolean {
  return projection.zones.includes(zone)
}

export function projectionHasMarker(
  projection: GameplayFormatProjection,
  marker: FormatGameplayMarker,
): boolean {
  return projection.activeMarkers.includes(marker)
}
