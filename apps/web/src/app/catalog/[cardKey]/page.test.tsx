import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notFoundError = new Error('NEXT_NOT_FOUND')

const mocks = vi.hoisted(() => ({
  getCatalogCardDetail: vi.fn(),
  notFound: vi.fn(() => {
    throw notFoundError
  }),
}))

vi.mock('@/features/catalog/server/catalog-read', () => ({
  getCatalogCardDetail: mocks.getCatalogCardDetail,
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

vi.mock('@/components/catalog/catalog-card-detail-view', () => ({
  CatalogCardDetailView: ({
    detail,
  }: {
    detail: {
      card: {
        canonicalKey: string
      }
    }
  }) => <div data-testid="card-detail">{detail.card.canonicalKey}</div>,
}))

import CatalogCardPage from './page'

describe('CatalogCardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the canonical card detail surface from the server read model', async () => {
    mocks.getCatalogCardDetail.mockResolvedValueOnce({
      ok: true,
      data: {
        card: {
          canonicalKey: 'card.azure-vanguard-dragon',
        },
      },
    })

    render(
      await CatalogCardPage({
        params: Promise.resolve({
          cardKey: 'card.azure-vanguard-dragon',
        }),
      }),
    )

    expect(mocks.getCatalogCardDetail).toHaveBeenCalledWith(
      'card.azure-vanguard-dragon',
    )
    expect(screen.getByTestId('card-detail')).toHaveTextContent(
      'card.azure-vanguard-dragon',
    )
  })

  it('routes missing canonical cards into Next.js not-found handling', async () => {
    mocks.getCatalogCardDetail.mockResolvedValueOnce({
      ok: true,
      data: null,
    })

    await expect(
      CatalogCardPage({
        params: Promise.resolve({
          cardKey: 'card.missing',
        }),
      }),
    ).rejects.toBe(notFoundError)

    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('renders an explicit error state when the card detail read fails', async () => {
    mocks.getCatalogCardDetail.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to load catalog card entity.',
      },
    })

    render(
      await CatalogCardPage({
        params: Promise.resolve({
          cardKey: 'card.azure-vanguard-dragon',
        }),
      }),
    )

    expect(screen.getByText(/card detail is unavailable/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /back to catalog/i }),
    ).toHaveAttribute('href', '/catalog')
  })
})
