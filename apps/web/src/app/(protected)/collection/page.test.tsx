import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCollectionPageState: vi.fn(),
}))

vi.mock('@/features/collections/server/collection-page-read', () => ({
  getCollectionPageState: mocks.getCollectionPageState,
}))

vi.mock('@/components/collections/collection-inventory-view', () => ({
  CollectionInventoryView: ({
    viewerDisplayName,
    totalOwnedPrintings,
    totalOwnedCopies,
  }: {
    viewerDisplayName: string
    totalOwnedPrintings: number
    totalOwnedCopies: number
  }) => (
    <div>
      <span data-testid="viewer-name">{viewerDisplayName}</span>
      <span data-testid="printing-count">{totalOwnedPrintings}</span>
      <span data-testid="copy-count">{totalOwnedCopies}</span>
    </div>
  ),
}))

import CollectionPage from './page'

describe('CollectionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCollectionPageState.mockResolvedValue({
      kind: 'ready',
      viewerDisplayName: 'Azure Collector',
      query: {
        view: 'binder',
        sort: 'recent',
      },
      totalOwnedPrintings: 2,
      totalOwnedCopies: 3,
      items: [{ id: 'item-1' }],
      totalWishlistItems: 1,
      totalFavoriteItems: 1,
      wishlistItems: [{ id: 'pref-1' }],
      favoriteItems: [{ id: 'pref-2' }],
    })
  })

  it('loads the collection page read model before rendering the inventory view', async () => {
    render(
      await CollectionPage({
        searchParams: Promise.resolve({
          view: 'list',
          sort: 'quantity',
        }),
      }),
    )

    expect(mocks.getCollectionPageState).toHaveBeenCalledWith({
      view: 'list',
      sort: 'quantity',
    })
    expect(screen.getByTestId('viewer-name')).toHaveTextContent(
      'Azure Collector',
    )
    expect(screen.getByTestId('printing-count')).toHaveTextContent('2')
    expect(screen.getByTestId('copy-count')).toHaveTextContent('3')
  })

  it('renders a profile prerequisite state when no persisted profile exists yet', async () => {
    mocks.getCollectionPageState.mockResolvedValueOnce({
      kind: 'profile-unavailable',
    })

    render(await CollectionPage({}))

    expect(screen.getByText(/create your profile first/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open profile/i })).toHaveAttribute(
      'href',
      '/profile',
    )
  })
})
