import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState, ErrorState, LoadingState, SuccessState } from '.'

describe('feedback states', () => {
  it('renders a loading state with the default title', () => {
    render(<LoadingState description="Preparing the page." />)

    const loadingTitle = screen.getByText(/^loading$/i)

    expect(loadingTitle.closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    expect(loadingTitle).toBeInTheDocument()
    expect(screen.getByText(/preparing the page/i)).toBeInTheDocument()
  })

  it('renders an empty state action link', () => {
    render(
      <EmptyState
        title="No decks yet"
        description="Create a deck to get started."
        actionLabel="Open profile"
        actionHref="/profile"
      />,
    )

    expect(screen.getByRole('link', { name: /open profile/i })).toHaveAttribute(
      'href',
      '/profile',
    )
  })

  it('renders an error state message', () => {
    render(
      <ErrorState
        title="Deck flow unavailable"
        description="The request could not be completed."
      />,
    )

    const errorTitle = screen.getByText(/deck flow unavailable/i)

    expect(errorTitle.closest('[role="alert"]')).toHaveAttribute(
      'aria-live',
      'assertive',
    )
    expect(errorTitle).toBeInTheDocument()
  })

  it('renders a compact success state', () => {
    render(
      <SuccessState
        compact
        title="Profile saved"
        description="Changes were written successfully."
      />,
    )

    const successTitle = screen.getByText(/profile saved/i)

    expect(successTitle.closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    expect(successTitle).toBeInTheDocument()
    expect(
      screen.getByText(/changes were written successfully/i),
    ).toBeInTheDocument()
  })
})
