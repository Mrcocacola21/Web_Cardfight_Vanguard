import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const notFoundError = new Error('NEXT_NOT_FOUND')

const mocks = vi.hoisted(() => ({
  getCatalogPrintingDetail: vi.fn(),
  notFound: vi.fn(() => {
    throw notFoundError
  }),
}))

vi.mock('@/features/catalog/server/catalog-printing-read', () => ({
  getCatalogPrintingDetail: mocks.getCatalogPrintingDetail,
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}))

vi.mock('@/components/catalog/catalog-printing-detail-view', () => ({
  CatalogPrintingDetailView: ({
    detail,
  }: {
    detail: {
      printing: {
        printingKey: string
      }
    }
  }) => <div data-testid="printing-detail">{detail.printing.printingKey}</div>,
}))

import CatalogPrintingPage from './page'

describe('CatalogPrintingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the printing-centric detail surface from the server read model', async () => {
    mocks.getCatalogPrintingDetail.mockResolvedValueOnce({
      ok: true,
      data: {
        printing: {
          printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
        },
      },
    })

    render(
      await CatalogPrintingPage({
        params: Promise.resolve({
          printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
        }),
      }),
    )

    expect(mocks.getCatalogPrintingDetail).toHaveBeenCalledWith(
      'printing.azure-vanguard-dragon.d-sd01.004.en',
    )
    expect(screen.getByTestId('printing-detail')).toHaveTextContent(
      'printing.azure-vanguard-dragon.d-sd01.004.en',
    )
  })

  it('routes missing printings into Next.js not-found handling', async () => {
    mocks.getCatalogPrintingDetail.mockResolvedValueOnce({
      ok: true,
      data: null,
    })

    await expect(
      CatalogPrintingPage({
        params: Promise.resolve({
          printingKey: 'printing.missing',
        }),
      }),
    ).rejects.toBe(notFoundError)

    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('renders an explicit error state when the printing detail read fails', async () => {
    mocks.getCatalogPrintingDetail.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'query-failed',
        message: 'Failed to load catalog card printing.',
      },
    })

    render(
      await CatalogPrintingPage({
        params: Promise.resolve({
          printingKey: 'printing.azure-vanguard-dragon.d-sd01.004.en',
        }),
      }),
    )

    expect(
      screen.getByText(/printing detail is unavailable/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /back to catalog/i }),
    ).toHaveAttribute('href', '/catalog')
  })
})
