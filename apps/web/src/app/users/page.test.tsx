import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserSearchRouteQuery } from '@/features/profiles/user-search-query'

const mocks = vi.hoisted(() => ({
  getUserSearchPageState: vi.fn(),
  userSearchView: vi.fn(),
}))

vi.mock('@/features/profiles/server/user-search-read', () => ({
  getUserSearchPageState: mocks.getUserSearchPageState,
}))

vi.mock('@/components/profiles/user-search-view', () => ({
  UserSearchView: ({
    inputValue,
    state,
  }: {
    inputValue: string
    state: {
      kind: string
    }
  }) => {
    mocks.userSearchView(inputValue, state)

    return (
      <div>
        <span data-testid="user-search-input">{inputValue}</span>
        <span data-testid="user-search-state">{state.kind}</span>
      </div>
    )
  },
}))

import UsersPage from './page'

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUserSearchPageState.mockResolvedValue({
      kind: 'ready',
      results: [],
    })
  })

  it('normalizes URL search params before invoking the server-backed search read', async () => {
    render(
      await UsersPage({
        searchParams: Promise.resolve({
          q: '   Azure    Pilot   ',
        }),
      }),
    )

    const query = mocks.getUserSearchPageState.mock.calls[0]?.[0] as
      | UserSearchRouteQuery
      | undefined

    expect(query).toEqual({
      kind: 'searchable',
      inputValue: 'Azure Pilot',
      searchText: 'Azure Pilot',
    })
    expect(screen.getByTestId('user-search-input')).toHaveTextContent(
      'Azure Pilot',
    )
    expect(screen.getByTestId('user-search-state')).toHaveTextContent('ready')
  })
})
