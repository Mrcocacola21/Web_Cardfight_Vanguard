import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SignUpForm } from './sign-up-form'

describe('SignUpForm', () => {
  it('renders the registration fields and submit action', () => {
    render(<SignUpForm />)

    expect(
      screen.getByText(/creates the initial profile baseline/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument()
  })
})
