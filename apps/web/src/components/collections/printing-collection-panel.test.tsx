import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PrintingCollectionPanel } from './printing-collection-panel'

describe('PrintingCollectionPanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders add and quantity controls for an owned printing row', () => {
    render(
      <PrintingCollectionPanel
        printingId="printing-1"
        returnPath="/catalog/printings/printing-1"
        state={{
          kind: 'ready',
          ownerProfileId: 'profile-1',
          item: {
            id: 'item-1',
            ownerProfileId: 'profile-1',
            cardPrintingId: 'printing-1',
            quantity: 3,
            createdAt: '2026-04-22T10:00:00.000Z',
            updatedAt: '2026-04-22T11:00:00.000Z',
          },
        }}
      />,
    )

    expect(
      screen.getByText(
        /private owner-owned inventory for this exact printing/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add one/i })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /remove one/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /remove all/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('spinbutton', { name: /set exact quantity/i }),
    ).toHaveValue(3)
  })

  it('renders an add-to-collection entry point for an unowned printing', () => {
    render(
      <PrintingCollectionPanel
        printingId="printing-1"
        returnPath="/catalog/printings/printing-1"
        state={{
          kind: 'ready',
          ownerProfileId: 'profile-1',
          item: null,
        }}
      />,
    )

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add to collection/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /remove one/i }),
    ).not.toBeInTheDocument()
  })

  it('renders a sign-in prompt for signed-out viewers', () => {
    render(
      <PrintingCollectionPanel
        printingId="printing-1"
        returnPath="/catalog/printings/printing-1"
        state={{
          kind: 'signed-out',
        }}
      />,
    )

    expect(
      screen.getByText(/sign in to track ownership for this printing/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })
})
