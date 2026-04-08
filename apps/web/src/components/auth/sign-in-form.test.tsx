import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SignInForm } from './sign-in-form'

describe('SignInForm', () => {
  it('renders the login fields and submit action', () => {
    render(<SignInForm />)

    expect(screen.getByText(/server-side session path/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})
