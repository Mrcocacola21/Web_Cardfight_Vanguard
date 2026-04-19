import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProtectedNavLinks } from './protected-nav-links'

describe('ProtectedNavLinks', () => {
  it('marks the current deck route as active for nested deck paths', () => {
    render(<ProtectedNavLinks pathname="/decks/deck-123" />)
    const deckLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/decks')
    const profileLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/profile')

    expect(
      deckLinks.some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true)
    expect(
      profileLinks.some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(false)
  })

  it('includes the public user search route in the protected app navigation', () => {
    render(<ProtectedNavLinks pathname="/users" />)
    const usersLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/users')

    expect(
      usersLinks.some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true)
  })

  it('marks the friends dashboard route as active for the dedicated social dashboard', () => {
    render(<ProtectedNavLinks pathname="/friends" />)
    const friendsLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/friends')

    expect(
      friendsLinks.some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true)
  })

  it('marks nested manual match entry routes as active in the protected navigation', () => {
    render(<ProtectedNavLinks pathname="/matches/new" />)
    const matchLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/matches')

    expect(
      matchLinks.some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true)
  })
})
