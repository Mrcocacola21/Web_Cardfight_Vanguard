import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CatalogListView } from './catalog-list-view'

describe('CatalogListView', () => {
  it('renders catalog cards with detail links', () => {
    render(
      <CatalogListView
        cards={[
          {
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
        ]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /card catalog/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/azure vanguard dragon/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view card/i })).toHaveAttribute(
      'href',
      '/catalog/card.azure-vanguard-dragon',
    )
  })
})
