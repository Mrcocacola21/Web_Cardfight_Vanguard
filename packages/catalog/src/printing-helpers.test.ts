import { describe, expect, it } from 'vitest'

import type { CardId, CardPrintingId, ProductId } from './index'
import { groupPrintingsByCardId, isPrintingOfCard } from './index'
import type { CardPrinting, LocaleCode, Rarity } from './index'

const cardAlphaId = 'card-alpha' as CardId
const cardBetaId = 'card-beta' as CardId
const productAlphaId = 'product-alpha' as ProductId
const productBetaId = 'product-beta' as ProductId
const localeEn = 'en' as LocaleCode
const rarityRrr = 'RRR' as Rarity

function makePrinting(
  id: string,
  cardId: CardId,
  productId: ProductId,
  collectorNumber: string,
): CardPrinting {
  return {
    id: id as CardPrintingId,
    cardId,
    productId,
    collectorNumber,
    rarity: rarityRrr,
    locale: localeEn,
  }
}

describe('@web-vg/catalog printing helpers', () => {
  it('preserves canonical card identity across multiple printings', () => {
    const firstPrinting = makePrinting(
      'printing-a-1',
      cardAlphaId,
      productAlphaId,
      '001',
    )
    const reprint = makePrinting(
      'printing-a-2',
      cardAlphaId,
      productBetaId,
      '050',
    )
    const grouped = groupPrintingsByCardId([firstPrinting, reprint])

    expect(grouped.size).toBe(1)
    expect(grouped.get(cardAlphaId)).toEqual([firstPrinting, reprint])
  })

  it('keeps distinct canonical cards in separate printing groups', () => {
    const alphaPrinting = makePrinting(
      'printing-a-1',
      cardAlphaId,
      productAlphaId,
      '001',
    )
    const betaPrinting = makePrinting(
      'printing-b-1',
      cardBetaId,
      productAlphaId,
      '002',
    )
    const grouped = groupPrintingsByCardId([alphaPrinting, betaPrinting])

    expect(grouped.size).toBe(2)
    expect(grouped.get(cardAlphaId)).toEqual([alphaPrinting])
    expect(grouped.get(cardBetaId)).toEqual([betaPrinting])
  })

  it('checks printing membership against canonical card identity rather than product data', () => {
    const firstPrinting = makePrinting(
      'printing-a-1',
      cardAlphaId,
      productAlphaId,
      '001',
    )
    const reprint = makePrinting(
      'printing-a-2',
      cardAlphaId,
      productBetaId,
      '050',
    )

    expect(isPrintingOfCard(firstPrinting, cardAlphaId)).toBe(true)
    expect(isPrintingOfCard(reprint, cardAlphaId)).toBe(true)
    expect(isPrintingOfCard(reprint, cardBetaId)).toBe(false)
  })
})
