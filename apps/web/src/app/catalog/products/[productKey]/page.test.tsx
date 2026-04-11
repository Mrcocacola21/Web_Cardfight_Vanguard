import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notFoundError = new Error('NEXT_NOT_FOUND')

const mocks = vi.hoisted(() => ({
  getCatalogProductDetail: vi.fn(),
  notFound: vi.fn(() => {
    throw notFoundError
  }),
}))

vi.mock('@/features/catalog/server/catalog-product-read', () => ({
  getCatalogProductDetail: mocks.getCatalogProductDetail,
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

vi.mock('@/components/catalog/catalog-product-detail-view', () => ({
  CatalogProductDetailView: ({
    detail,
  }: {
    detail: {
      product: {
        canonicalKey: string
      }
    }
  }) => <div data-testid="product-detail">{detail.product.canonicalKey}</div>,
}))

import CatalogProductPage from './page'

describe('CatalogProductPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the product-centric detail surface from the server read model', async () => {
    mocks.getCatalogProductDetail.mockResolvedValueOnce({
      ok: true,
      data: {
        product: {
          canonicalKey: 'product.d-sd01.azure-vanguard-start-deck',
        },
      },
    })

    render(
      await CatalogProductPage({
        params: Promise.resolve({
          productKey: 'product.d-sd01.azure-vanguard-start-deck',
        }),
      }),
    )

    expect(mocks.getCatalogProductDetail).toHaveBeenCalledWith(
      'product.d-sd01.azure-vanguard-start-deck',
    )
    expect(screen.getByTestId('product-detail')).toHaveTextContent(
      'product.d-sd01.azure-vanguard-start-deck',
    )
  })

  it('routes missing products into Next.js not-found handling', async () => {
    mocks.getCatalogProductDetail.mockResolvedValueOnce({
      ok: true,
      data: null,
    })

    await expect(
      CatalogProductPage({
        params: Promise.resolve({
          productKey: 'product.missing',
        }),
      }),
    ).rejects.toBe(notFoundError)

    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('renders an explicit error state when the product detail read fails', async () => {
    mocks.getCatalogProductDetail.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to load catalog product.',
      },
    })

    render(
      await CatalogProductPage({
        params: Promise.resolve({
          productKey: 'product.d-sd01.azure-vanguard-start-deck',
        }),
      }),
    )

    expect(
      screen.getByText(/product detail is unavailable/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /back to catalog/i }),
    ).toHaveAttribute('href', '/catalog')
  })
})
