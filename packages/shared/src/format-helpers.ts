import type {
  DeckSection,
  DeckSectionConstraint,
  FormatGameplayMarker,
  FormatProfile,
} from './format-contracts'
import type { TriggerType } from './card-vocabulary'

export function getDeckSectionConstraint(
  profile: FormatProfile,
  section: DeckSection,
): DeckSectionConstraint | undefined {
  return profile.deckStructure.find(
    (constraint) => constraint.section === section,
  )
}

export function formatHasSection(
  profile: FormatProfile,
  section: DeckSection,
): boolean {
  return getDeckSectionConstraint(profile, section) !== undefined
}

export function getRequiredDeckSections(
  profile: FormatProfile,
): readonly DeckSection[] {
  return profile.deckStructure
    .filter((constraint) => constraint.required)
    .map((constraint) => constraint.section)
}

export function getDuplicateCountingSections(
  profile: FormatProfile,
): readonly DeckSection[] {
  return [...profile.constructionRules.duplicateConstraint.appliesToSections]
}

export function getTriggerTypeLimit(
  profile: FormatProfile,
  triggerType: TriggerType,
): number | undefined {
  return profile.constructionRules.triggerConstraint?.perTypeLimits.find(
    (constraint) => constraint.triggerType === triggerType,
  )?.maxCopies
}

export function formatHasGameplayMarker(
  profile: FormatProfile,
  marker: FormatGameplayMarker,
): boolean {
  return profile.capabilities.gameplayMarkers.includes(marker)
}
