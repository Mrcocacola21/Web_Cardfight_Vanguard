import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CatalogCardDetailView } from './catalog-card-detail-view'

describe('CatalogCardDetailView', () => {
  it('renders canonical card fields and linked printings', () => {
    render(
      <CatalogCardDetailView
        card={{
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
        }}
        printings={[
          {
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
          },
        ]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /azure vanguard dragon/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^canonical card$/i)).toBeInTheDocument()
    expect(screen.getByText(/azure vanguard start deck/i)).toBeInTheDocument()
    expect(screen.getByText(/effect\.ref\.dev\.dragon/i)).toBeInTheDocument()
  })
})
