import type { CardId } from '@web-vg/shared'

import type { CardPrinting } from './products'

export function isPrintingOfCard(
  printing: CardPrinting,
  cardId: CardId,
): boolean {
  return printing.cardId === cardId
}

export function groupPrintingsByCardId(
  printings: readonly CardPrinting[],
): ReadonlyMap<CardId, readonly CardPrinting[]> {
  const grouped = new Map<CardId, CardPrinting[]>()

  for (const printing of printings) {
    const existing = grouped.get(printing.cardId)

    if (existing) {
      existing.push(printing)
      continue
    }

    grouped.set(printing.cardId, [printing])
  }

  return grouped
}
