import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PrintingPreferencePanel } from './printing-preference-panel'

describe('PrintingPreferencePanel', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders wishlist and favorites controls for one exact printing', () => {
    render(
      <PrintingPreferencePanel
        printingId="printing-1"
        returnPath="/catalog/printings/printing-1"
        state={{
          kind: 'ready',
          ownerProfileId: 'profile-1',
          wishlisted: true,
          favorited: false,
        }}
      />,
    )

    expect(
      screen.getByText(
        /private collector preference state for this exact printing/i,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Wishlist')).toBeInTheDocument()
    expect(screen.getByText('Favorites')).toBeInTheDocument()
    expect(screen.getAllByText('Active')).toHaveLength(1)
    expect(screen.getAllByText('Not set')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: /remove from wishlist/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /add to favorites/i }),
    ).toBeInTheDocument()
  })

  it('renders a sign-in prompt for signed-out viewers', () => {
    render(
      <PrintingPreferencePanel
        printingId="printing-1"
        returnPath="/catalog/printings/printing-1"
        state={{
          kind: 'signed-out',
        }}
      />,
    )

    expect(
      screen.getByText(/sign in to wishlist or favorite this printing/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })
})
