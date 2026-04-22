import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { StoredCollectionInventoryItem } from '@/features/collections/application/collection-inventory-repository'

import { CollectionInventoryView } from './collection-inventory-view'

describe('CollectionInventoryView', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders binder mode as a collector-facing grid with quantity and action controls', () => {
    render(
      <CollectionInventoryView
        viewerDisplayName="Azure Collector"
        query={{
          view: 'binder',
          sort: 'recent',
        }}
        totalOwnedPrintings={1}
        totalOwnedCopies={3}
        items={[createItem()]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /my collection/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /binder view/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByText(/genesis of azure \(D-BT01\)/i)).toBeInTheDocument()
    expect(screen.getByText('x3')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add one copy/i }),
    ).toBeInTheDocument()
  })

  it('renders list mode as a denser inventory table', () => {
    render(
      <CollectionInventoryView
        viewerDisplayName="Azure Collector"
        query={{
          view: 'list',
          sort: 'quantity',
        }}
        totalOwnedPrintings={1}
        totalOwnedCopies={3}
        items={[createItem()]}
      />,
    )

    expect(screen.getByRole('link', { name: /list view/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText(/D-BT01 #001/i)).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders two printings of the same card as separate owned entries and keeps action targets printing-specific', () => {
    const { container } = render(
      <CollectionInventoryView
        viewerDisplayName="Azure Collector"
        query={{
          view: 'list',
          sort: 'name',
        }}
        totalOwnedPrintings={2}
        totalOwnedCopies={3}
        items={[
          createItem({
            id: 'item-regular',
            cardPrintingId: 'printing-regular',
            quantity: 2,
            printing: {
              id: 'printing-regular',
              printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.regular',
              collectorNumber: '001',
              rarity: 'RRR',
              localeCode: 'en',
              regionCode: 'en',
              printedName: 'Azure Vanguard Dragon',
              artVariant: null,
              isAlternateArt: false,
              isPromoVariant: false,
              product: {
                id: 'product-1',
                canonicalKey: 'product.d-bt01.genesis-of-azure',
                officialCode: 'D-BT01',
                name: 'Genesis of Azure',
                productCategory: 'booster',
                productKind: 'main',
                releaseDate: '2021-05-14',
                regionCode: 'en',
              },
              card: {
                id: 'card-1',
                canonicalKey: 'card.azure-vanguard-dragon',
                name: 'Azure Vanguard Dragon',
                grade: 3,
                cardType: 'normal-unit',
                nation: 'Dragon Empire',
                clan: null,
                triggerType: null,
              },
            },
          }),
          createItem({
            id: 'item-alt',
            cardPrintingId: 'printing-alt',
            quantity: 1,
            printing: {
              id: 'printing-alt',
              printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.alt',
              collectorNumber: '001',
              rarity: 'SP',
              localeCode: 'en',
              regionCode: 'en',
              printedName: 'Azure Vanguard Dragon',
              artVariant: 'special-foil',
              isAlternateArt: true,
              isPromoVariant: false,
              product: {
                id: 'product-1',
                canonicalKey: 'product.d-bt01.genesis-of-azure',
                officialCode: 'D-BT01',
                name: 'Genesis of Azure',
                productCategory: 'booster',
                productKind: 'main',
                releaseDate: '2021-05-14',
                regionCode: 'en',
              },
              card: {
                id: 'card-1',
                canonicalKey: 'card.azure-vanguard-dragon',
                name: 'Azure Vanguard Dragon',
                grade: 3,
                cardType: 'normal-unit',
                nation: 'Dragon Empire',
                clan: null,
                triggerType: null,
              },
            },
          }),
        ]}
      />,
    )

    expect(screen.getAllByText('Azure Vanguard Dragon')).toHaveLength(2)
    expect(screen.getAllByText(/D-BT01 #001/i)).toHaveLength(2)
    expect(screen.getByText('RRR')).toBeInTheDocument()
    expect(screen.getByText('SP')).toBeInTheDocument()
    expect(screen.getByText(/alt art/i)).toBeInTheDocument()
    expect(screen.getByText(/special-foil/i)).toBeInTheDocument()

    const regularRow = screen.getByText('RRR').closest('tr')
    const altRow = screen.getByText('SP').closest('tr')

    expect(regularRow).not.toBeNull()
    expect(altRow).not.toBeNull()

    expect(
      within(regularRow as HTMLTableRowElement).getByText('2'),
    ).toBeInTheDocument()
    expect(
      within(altRow as HTMLTableRowElement).getByText('1'),
    ).toBeInTheDocument()

    expect(
      container.querySelectorAll(
        'input[name="printingId"][value="printing-regular"]',
      ),
    ).toHaveLength(3)
    expect(
      container.querySelectorAll(
        'input[name="printingId"][value="printing-alt"]',
      ),
    ).toHaveLength(3)
  })

  it('renders an honest empty state when no owned printings exist yet', () => {
    render(
      <CollectionInventoryView
        viewerDisplayName="Azure Collector"
        query={{
          view: 'binder',
          sort: 'recent',
        }}
        totalOwnedPrintings={0}
        totalOwnedCopies={0}
        items={[]}
      />,
    )

    expect(screen.getByText(/your collection is empty/i)).toBeInTheDocument()
    const browseCatalogLinks = screen.getAllByRole('link', {
      name: /browse catalog/i,
    })

    expect(browseCatalogLinks).toHaveLength(2)
    for (const link of browseCatalogLinks) {
      expect(link).toHaveAttribute('href', '/catalog')
    }
  })

  it('renders stale linked catalog data without crashing the inventory surface', () => {
    render(
      <CollectionInventoryView
        viewerDisplayName="Azure Collector"
        query={{
          view: 'binder',
          sort: 'recent',
        }}
        totalOwnedPrintings={1}
        totalOwnedCopies={2}
        items={[
          createItem({
            cardPrintingId: 'printing-stale',
            quantity: 2,
            catalogState: 'stale',
            printing: null,
          }),
        ]}
      />,
    )

    expect(
      screen.getByText(/catalog printing unavailable/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Stale$/i)).toBeInTheDocument()
  })
})

function createItem(input?: {
  readonly id?: string
  readonly cardPrintingId?: string
  readonly quantity?: number
  readonly printing?: StoredCollectionInventoryItem['printing']
  readonly catalogState?: 'ready' | 'stale'
}) {
  return {
    id: input?.id ?? 'item-1',
    ownerProfileId: 'profile-1',
    cardPrintingId: input?.cardPrintingId ?? 'printing-1',
    quantity: input?.quantity ?? 3,
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T11:00:00.000Z',
    catalogState: input?.catalogState ?? 'ready',
    printing:
      input?.printing === undefined
        ? {
            id: 'printing-1',
            printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.en',
            collectorNumber: '001',
            rarity: 'RRR',
            localeCode: 'en',
            regionCode: 'en',
            printedName: 'Azure Vanguard Dragon',
            artVariant: 'special-foil',
            isAlternateArt: true,
            isPromoVariant: false,
            product: {
              id: 'product-1',
              canonicalKey: 'product.d-bt01.genesis-of-azure',
              officialCode: 'D-BT01',
              name: 'Genesis of Azure',
              productCategory: 'booster',
              productKind: 'main',
              releaseDate: '2021-05-14',
              regionCode: 'en',
            },
            card: {
              id: 'card-1',
              canonicalKey: 'card.azure-vanguard-dragon',
              name: 'Azure Vanguard Dragon',
              grade: 3,
              cardType: 'normal-unit',
              nation: 'Dragon Empire',
              clan: null,
              triggerType: null,
            },
          }
        : input.printing,
  }
}
