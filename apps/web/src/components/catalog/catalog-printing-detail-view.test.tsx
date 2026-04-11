import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CatalogPrintingDetailView } from './catalog-printing-detail-view'

describe('CatalogPrintingDetailView', () => {
  it('renders a printing-centric detail surface without replacing the canonical card identity', () => {
    render(
      <CatalogPrintingDetailView
        detail={{
          printing: {
            id: 'printing-1',
            printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
            cardEntityId: 'card-1',
            collectorNumber: '004',
            rarity: 'RRR',
            localeCode: 'en',
            regionCode: 'en',
            printedName: 'Azure Vanguard Dragon',
            artVariant: 'starter-art',
            isAlternateArt: false,
            isPromoVariant: false,
            product: {
              id: 'product-1',
              canonicalKey: 'product.d-sd01.azure-vanguard-start-deck',
              familyId: 'family-standard',
              officialCode: 'D-SD01',
              name: 'Azure Vanguard Start Deck',
              productCategory: 'deck',
              productKind: 'start',
              releaseDate: '2021-05-28',
              regionCode: 'en',
              cycleKey: 'dev-standard-wave-1',
            },
            card: {
              id: 'card-1',
              canonicalKey: 'card.azure-vanguard-dragon',
              name: 'Azure Vanguard Dragon',
              normalizedName: 'azure vanguard dragon',
              grade: 3,
              cardType: 'normal-unit',
              nation: 'Dragon Empire',
              clan: null,
              race: 'Cosmo Dragon',
              triggerType: null,
              basePower: 13000,
              baseCritical: 1,
              baseShield: 0,
              keywords: ['twin-drive'],
              effectRefs: ['effect.ref.dev.dragon'],
            },
          },
          siblingPrintings: [
            {
              id: 'printing-2',
              printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.en',
              cardEntityId: 'card-1',
              collectorNumber: '001',
              rarity: 'RRR',
              localeCode: 'en',
              regionCode: 'en',
              printedName: 'Azure Vanguard Dragon',
              artVariant: null,
              isAlternateArt: false,
              isPromoVariant: false,
              product: {
                id: 'product-2',
                canonicalKey: 'product.d-bt01.genesis-of-azure',
                familyId: 'family-standard',
                officialCode: 'D-BT01',
                name: 'Genesis of Azure',
                productCategory: 'booster',
                productKind: 'main',
                releaseDate: '2021-05-14',
                regionCode: 'en',
                cycleKey: 'dev-standard-wave-1',
              },
            },
          ],
        }}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: /azure vanguard dragon/i,
        level: 1,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/printing facts/i, {
        selector: '[data-slot="card-title"]',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/canonical card entity/i, {
        selector: '[data-slot="card-title"]',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /canonical card/i }),
    ).toHaveAttribute('href', '/catalog/card.azure-vanguard-dragon')
    expect(screen.getByRole('link', { name: /release page/i })).toHaveAttribute(
      'href',
      '/catalog/products/product.d-sd01.azure-vanguard-start-deck',
    )
    expect(
      screen.getByText(/other printings of this card/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /open printing/i }),
    ).toHaveAttribute(
      'href',
      '/catalog/printings/printing.azure-vanguard-dragon.d-bt01.001.en',
    )
  })

  it('renders an honest empty state when no sibling printings are published yet', () => {
    render(
      <CatalogPrintingDetailView
        detail={{
          printing: {
            id: 'printing-1',
            printingKey: 'printing.azure-critical-pulse.pr-g01.010.en',
            cardEntityId: 'card-2',
            collectorNumber: '010',
            rarity: 'PR',
            localeCode: 'en',
            regionCode: 'en',
            printedName: 'Azure Critical Pulse',
            artVariant: null,
            isAlternateArt: false,
            isPromoVariant: true,
            product: {
              id: 'product-2',
              canonicalKey: 'product.pr-g01.premium-anniversary-pack',
              familyId: 'family-premium',
              officialCode: 'PR-G01',
              name: 'Premium Anniversary Promo Pack',
              productCategory: 'promo',
              productKind: 'standalone',
              releaseDate: '2019-08-09',
              regionCode: 'en',
              cycleKey: 'dev-premium-wave-1',
            },
            card: {
              id: 'card-2',
              canonicalKey: 'card.azure-critical-pulse',
              name: 'Azure Critical Pulse',
              normalizedName: 'azure critical pulse',
              grade: 0,
              cardType: 'trigger-unit',
              nation: 'Dragon Empire',
              clan: null,
              race: 'Element',
              triggerType: 'critical',
              basePower: 5000,
              baseCritical: 1,
              baseShield: 15000,
              keywords: [],
              effectRefs: [],
            },
          },
          siblingPrintings: [],
        }}
      />,
    )

    expect(
      screen.getByText(/no additional printings are currently published/i),
    ).toBeInTheDocument()
  })
})
