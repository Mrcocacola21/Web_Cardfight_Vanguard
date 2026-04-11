import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ProtectedNavLinks } from './protected-nav-links'

describe('ProtectedNavLinks', () => {
  it('marks the current deck route as active for nested deck paths', () => {
    render(<ProtectedNavLinks pathname="/decks/deck-123" />)

    expect(screen.getByRole('link', { name: /decks/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: /profile/i })).not.toHaveAttribute(
      'aria-current',
    )
  })
})
