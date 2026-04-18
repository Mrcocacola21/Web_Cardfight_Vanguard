import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UserSearchView } from './user-search-view'

describe('UserSearchView', () => {
  it('renders a loading state while the search route is resolving', () => {
    render(<UserSearchView inputValue="" state={{ kind: 'loading' }} />)

    expect(screen.getByText(/loading public profiles/i)).toBeInTheDocument()
    expect(
      screen.getByText(/resolving the public profile search surface/i),
    ).toBeInTheDocument()
  })

  it('renders the empty pre-search state', () => {
    render(
      <UserSearchView
        inputValue=""
        state={{ kind: 'idle', reason: 'empty' }}
      />,
    )

    expect(screen.getByText(/search public profiles/i)).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /^search$/i }).length,
    ).toBeGreaterThan(0)
  })

  it('renders a no-results state for unmatched queries', () => {
    render(
      <UserSearchView
        inputValue="Hidden"
        state={{ kind: 'ready', results: [] }}
      />,
    )

    expect(screen.getByText(/no users match this query/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /clear search/i })).toHaveAttribute(
      'href',
      '/users',
    )
  })

  it('renders an error state when the server search read fails', () => {
    render(
      <UserSearchView
        inputValue="Azure"
        state={{
          kind: 'error',
          message: 'Failed to search public profiles.',
        }}
      />,
    )

    expect(screen.getByText(/user search is unavailable/i)).toBeInTheDocument()
    expect(
      screen.getByText(/failed to search public profiles/i),
    ).toBeInTheDocument()
  })

  it('renders public-safe search results with links to public profiles', () => {
    render(
      <UserSearchView
        inputValue="Azure"
        state={{
          kind: 'ready',
          results: [
            {
              id: 'profile-public-1',
              displayName: 'Azure Pilot',
              avatarUrl: null,
              bio: 'Public pilot bio.',
            },
          ],
        }}
      />,
    )

    expect(screen.getByText(/azure pilot/i)).toBeInTheDocument()
    expect(screen.getByText(/public pilot bio/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view profile/i })).toHaveAttribute(
      'href',
      '/users/profile-public-1',
    )
  })
})
