import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeckCreateForm } from './deck-create-form'

describe('DeckCreateForm', () => {
  it('renders the format selector and create action', () => {
    render(<DeckCreateForm />)

    expect(screen.getByText(/create a new deck/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/format/i)).toHaveValue('standard')
    expect(
      screen.getByRole('option', { name: /standard/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /v premium/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: /^premium$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create deck/i }),
    ).toBeInTheDocument()
  })
})
