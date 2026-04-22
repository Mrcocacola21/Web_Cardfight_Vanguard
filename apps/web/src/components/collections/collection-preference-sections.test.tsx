import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { StoredCollectionPrintingPreferenceItem } from '@/features/collections/application/collection-preference-repository'

import { CollectionPreferenceSections } from './collection-preference-sections'

describe('CollectionPreferenceSections', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders separate wishlist and favorites sections for different printings of the same card', () => {
    render(
      <CollectionPreferenceSections
        wishlistItems={[
          createPreferenceItem({
            id: 'pref-wishlist',
            cardPrintingId: 'printing-alt',
            preferenceKind: 'wishlist',
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
        favoriteItems={[
          createPreferenceItem({
            id: 'pref-favorite',
            cardPrintingId: 'printing-regular',
            preferenceKind: 'favorite',
            printing: {
              id: 'printing-regular',
              printingKey: 'printing.azure-vanguard-dragon.d-bt01.001.en',
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
        ]}
        totalWishlistItems={1}
        totalFavoriteItems={1}
        returnPath="/collection"
      />,
    )

    expect(screen.getByText(/wishlist printings/i)).toBeInTheDocument()
    expect(screen.getByText(/favorite printings/i)).toBeInTheDocument()
    expect(screen.getAllByText('Azure Vanguard Dragon')).toHaveLength(2)
    expect(screen.getByText('SP')).toBeInTheDocument()
    expect(screen.getByText('RRR')).toBeInTheDocument()
    expect(screen.getByText(/alt art/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(2)
    expect(
      screen.getAllByRole('link', { name: /open printing/i }),
    ).toHaveLength(2)
  })

  it('renders honest empty states when no preferences are saved yet', () => {
    render(
      <CollectionPreferenceSections
        wishlistItems={[]}
        favoriteItems={[]}
        totalWishlistItems={0}
        totalFavoriteItems={0}
        returnPath="/collection"
      />,
    )

    expect(
      screen.getAllByText(/no printings are currently marked in this section/i),
    ).toHaveLength(2)
  })
})

function createPreferenceItem(input?: {
  readonly id?: string
  readonly cardPrintingId?: string
  readonly preferenceKind?: 'wishlist' | 'favorite'
  readonly printing?: StoredCollectionPrintingPreferenceItem['printing']
}) {
  return {
    id: input?.id ?? 'pref-1',
    ownerProfileId: 'profile-1',
    cardPrintingId: input?.cardPrintingId ?? 'printing-1',
    preferenceKind: input?.preferenceKind ?? 'wishlist',
    createdAt: '2026-04-22T10:00:00.000Z',
    updatedAt: '2026-04-22T11:00:00.000Z',
    catalogState: 'ready' as const,
    printing:
      input?.printing === undefined
        ? {
            id: 'printing-1',
            printingKey: 'printing.default',
            collectorNumber: '001',
            rarity: 'C',
            localeCode: 'en',
            regionCode: 'en',
            printedName: 'Default Card',
            artVariant: null,
            isAlternateArt: false,
            isPromoVariant: false,
            product: {
              id: 'product-1',
              canonicalKey: 'product.default',
              officialCode: 'D-BT01',
              name: 'Default Set',
              productCategory: 'booster',
              productKind: 'main',
              releaseDate: '2021-01-01',
              regionCode: 'en',
            },
            card: {
              id: 'card-1',
              canonicalKey: 'card.default',
              name: 'Default Card',
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
