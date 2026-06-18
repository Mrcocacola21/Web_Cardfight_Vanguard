import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const actionMocks = vi.hoisted(() => ({
  createStandardSliceQaDecksAction: vi.fn(),
  deleteDeckAction: vi.fn(),
  duplicateDeckAction: vi.fn(),
}))

vi.mock('@/features/decks/server/deck-actions', () => ({
  createStandardSliceQaDecksAction:
    actionMocks.createStandardSliceQaDecksAction,
  deleteDeckAction: actionMocks.deleteDeckAction,
  duplicateDeckAction: actionMocks.duplicateDeckAction,
}))

import { DeckListView } from './deck-list-view'

afterEach(() => {
  cleanup()
})

describe('DeckListView', () => {
  it('renders persisted deck summaries with start, open, duplicate, and delete actions', () => {
    render(
      <DeckListView
        query={{
          formatId: 'all',
        }}
        totalDeckCount={1}
        showStandardSliceQaBootstrap
        profile={{
          id: 'profile-1',
          username: 'azure_pilot',
          displayName: 'Azure Pilot',
          bio: null,
          avatarUrl: null,
          visibility: 'private',
          bioVisibility: 'private',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T00:00:00.000Z',
        }}
        decks={[
          {
            id: 'deck-1',
            ownerProfileId: 'profile-1',
            title: 'Azure Standard Deck',
            description: 'Current persisted Standard list.',
            tags: [],
            isFavorite: false,
            visibility: 'private',
            archivedAt: null,
            createdAt: '2026-04-08T00:00:00.000Z',
            updatedAt: '2026-04-08T01:00:00.000Z',
            format: {
              id: 'standard',
              displayName: 'Standard',
              description: 'D-era baseline profile',
            },
            currentVersionId: 'version-1',
            currentVersionNumber: 2,
            totalCards: 50,
            sectionCounts: {
              main: 46,
              ride: 4,
              g: 0,
            },
          },
        ]}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /my decks/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/azure standard deck/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^standard$/i)).toHaveLength(2)
    expect(screen.getByText(/1 of 1 deck/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      '/decks/deck-1',
    )
    expect(
      screen.getByRole('link', { name: /invite to match/i }),
    ).toHaveAttribute('href', '/matches/lobby')
    expect(screen.getByRole('link', { name: /create deck/i })).toHaveAttribute(
      'href',
      '/decks/create',
    )
    expect(
      screen.getByRole('button', { name: /create standard slice qa decks/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /duplicate azure standard deck/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /delete azure standard deck/i }),
    ).toBeInTheDocument()
  })

  it('renders an empty state with a create action when no decks exist yet', () => {
    render(
      <DeckListView
        query={{
          formatId: 'all',
        }}
        totalDeckCount={0}
        profile={{
          id: 'profile-1',
          username: 'azure_pilot',
          displayName: 'Azure Pilot',
          bio: null,
          avatarUrl: null,
          visibility: 'private',
          bioVisibility: 'private',
          createdAt: '2026-04-08T00:00:00.000Z',
          updatedAt: '2026-04-08T00:00:00.000Z',
        }}
        decks={[]}
      />,
    )

    expect(screen.getByText(/no decks yet/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /create standard slice qa decks/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /create your first deck/i }),
    ).toHaveAttribute('href', '/decks/create')
  })
})
