import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import HomePage from './page'

describe('HomePage', () => {
  it('renders the foundation heading and baseline note', () => {
    render(<HomePage />)

    expect(
      screen.getByText(/cardfight!! vanguard web client/i),
    ).toBeInTheDocument()

    expect(
      screen.getByText(/this page is a technical baseline only/i),
    ).toBeInTheDocument()
  })
})
