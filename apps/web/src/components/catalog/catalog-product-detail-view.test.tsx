import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CatalogProductDetailView } from './catalog-product-detail-view'

describe('CatalogProductDetailView', () => {
  it('renders a published wave product as a printing-centric release surface', () => {
    render(
      <CatalogProductDetailView
        detail={{
          product: {
            id: 'product-dz-bt01',
            canonicalKey: 'product.dz-bt01.fated-clash',
            familyId: 'family-standard',
            officialCode: 'DZ-BT01',
            name: 'Fated Clash',
            productCategory: 'booster',
            productKind: 'main',
            releaseDate: '2024-05-03',
            regionCode: 'en',
            cycleKey: 'content-wave-1',
            family: {
              id: 'family-standard',
              displayName: 'Standard Lineage',
              lineage: 'standard-lineage',
            },
          },
          summary: {
            printingCount: 2,
            uniqueCardCount: 1,
            promoPrintingCount: 0,
            alternateArtPrintingCount: 0,
            localeCodes: ['en'],
            rarities: ['DSR', 'RRR'],
          },
          printings: [
            {
              id: 'printing-rezael-main',
              printingKey:
                'printing.fated-one-of-miracles-rezael.dz-bt01.010.en',
              collectorNumber: '010',
              rarity: 'RRR',
              localeCode: 'en',
              regionCode: 'en',
              printedName: 'Fated One of Miracles, Rezael',
              artVariant: null,
              isAlternateArt: false,
              isPromoVariant: false,
              card: {
                id: 'entity-rezael',
                canonicalKey: 'card.fated-one-of-miracles-rezael',
                name: 'Fated One of Miracles, Rezael',
                grade: 3,
                cardType: 'normal-unit',
                triggerType: null,
                nation: 'Keter Sanctuary',
                clan: null,
              },
            },
            {
              id: 'printing-rezael-dsr',
              printingKey:
                'printing.fated-one-of-miracles-rezael.dz-bt01.dsr01.en',
              collectorNumber: 'DSR01',
              rarity: 'DSR',
              localeCode: 'en',
              regionCode: 'en',
              printedName: 'Fated One of Miracles, Rezael',
              artVariant: null,
              isAlternateArt: false,
              isPromoVariant: false,
              card: {
                id: 'entity-rezael',
                canonicalKey: 'card.fated-one-of-miracles-rezael',
                name: 'Fated One of Miracles, Rezael',
                grade: 3,
                cardType: 'normal-unit',
                triggerType: null,
                nation: 'Keter Sanctuary',
                clan: null,
              },
            },
          ],
        }}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /fated clash/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/release info/i, {
        selector: '[data-slot="card-title"]',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/printing list/i, {
        selector: '[data-slot="card-title"]',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/standard lineage/i)).toHaveLength(2)
    expect(
      screen.getAllByText(/canonical card: fated one of miracles, rezael/i),
    ).toHaveLength(2)
    expect(screen.getByText(/collector #010/i)).toBeInTheDocument()
    expect(screen.getByText(/collector #dsr01/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /printing detail/i }),
    ).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /card detail/i })).toHaveLength(
      2,
    )
    const printingDetailLinks = screen.getAllByRole('link', {
      name: /printing detail/i,
    })
    const cardDetailLinks = screen.getAllByRole('link', {
      name: /card detail/i,
    })

    expect(printingDetailLinks[0]).toHaveAttribute(
      'href',
      '/catalog/printings/printing.fated-one-of-miracles-rezael.dz-bt01.010.en',
    )
    expect(printingDetailLinks[1]).toHaveAttribute(
      'href',
      '/catalog/printings/printing.fated-one-of-miracles-rezael.dz-bt01.dsr01.en',
    )
    expect(cardDetailLinks[0]).toHaveAttribute(
      'href',
      '/catalog/card.fated-one-of-miracles-rezael',
    )
    expect(cardDetailLinks[1]).toHaveAttribute(
      'href',
      '/catalog/card.fated-one-of-miracles-rezael',
    )
    expect(
      screen.getByRole('link', { name: /back to catalog/i }),
    ).toBeInTheDocument()
  })

  it('renders an honest empty state for a published product whose unresolved card never crossed publication', () => {
    render(
      <CatalogProductDetailView
        detail={{
          product: {
            id: 'product-dz-bt02',
            canonicalKey: 'product.dz-bt02.illusionless-strife',
            familyId: 'family-standard',
            officialCode: 'DZ-BT02',
            name: 'Illusionless Strife',
            productCategory: 'booster',
            productKind: 'main',
            releaseDate: '2024-06-28',
            regionCode: 'en',
            cycleKey: 'content-wave-1',
            family: {
              id: 'family-standard',
              displayName: 'Standard Lineage',
              lineage: 'standard-lineage',
            },
          },
          summary: {
            printingCount: 0,
            uniqueCardCount: 0,
            promoPrintingCount: 0,
            alternateArtPrintingCount: 0,
            localeCodes: [],
            rarities: [],
          },
          printings: [],
        }}
      />,
    )

    expect(
      screen.getByText(
        /no concrete printings are currently published for this product/i,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/liael=amorta/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/none published/i)).toHaveLength(2)
  })
})
