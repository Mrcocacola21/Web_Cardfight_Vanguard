import type {
  CardId,
  DeckSection,
  DeckSectionState,
  DeckSnapshot,
} from '@web-vg/shared'

export function getDeckSection(
  snapshot: DeckSnapshot,
  section: DeckSection,
): DeckSectionState | undefined {
  return snapshot.sections.find((state) => state.section === section)
}

export function countCardsInSection(
  snapshot: DeckSnapshot,
  section: DeckSection,
): number {
  const sectionState = getDeckSection(snapshot, section)

  if (!sectionState) {
    return 0
  }

  return sectionState.entries.reduce((total, entry) => total + entry.count, 0)
}

export function countCardCopies(
  snapshot: DeckSnapshot,
  cardId: CardId,
  sections?: readonly DeckSection[],
): number {
  const scopedSections = sections ? new Set(sections) : undefined

  return snapshot.sections.reduce((total, sectionState) => {
    if (scopedSections && !scopedSections.has(sectionState.section)) {
      return total
    }

    return (
      total +
      sectionState.entries.reduce((sectionTotal, entry) => {
        if (entry.cardId !== cardId) {
          return sectionTotal
        }

        return sectionTotal + entry.count
      }, 0)
    )
  }, 0)
}
