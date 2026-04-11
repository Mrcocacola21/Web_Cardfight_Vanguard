import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  usePathname: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: mocks.usePathname,
}))

import { ProtectedMobileNavigation } from './protected-mobile-navigation'

describe('ProtectedMobileNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.usePathname.mockReturnValue('/profile')
  })

  it('opens the mobile navigation drawer with shared nav items', () => {
    render(<ProtectedMobileNavigation authUserLabel="pilot@example.com" />)

    fireEvent.click(
      screen.getByRole('button', { name: /open navigation menu/i }),
    )

    expect(
      screen.getByRole('dialog', { name: /protected navigation/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/pilot@example.com/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /catalog/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(document.body).toHaveClass('overflow-hidden')
  })

  it('closes the drawer on Escape and releases body scroll lock', () => {
    render(<ProtectedMobileNavigation authUserLabel="pilot@example.com" />)

    fireEvent.click(
      screen.getAllByRole('button', { name: /open navigation menu/i })[0]!,
    )
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(
      screen.queryByRole('dialog', { name: /protected navigation/i }),
    ).not.toBeInTheDocument()
    expect(document.body).not.toHaveClass('overflow-hidden')
  })
})
