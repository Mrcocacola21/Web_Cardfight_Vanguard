import { readFileSync } from 'node:fs'
import path from 'node:path'

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDeckToMatchRoomPageState: vi.fn(),
  deckToMatchRoomView: vi.fn(),
}))

vi.mock('@/features/matches/server/deck-to-match-room-read', () => ({
  getDeckToMatchRoomPageState: mocks.getDeckToMatchRoomPageState,
}))

vi.mock('@/components/matches/deck-to-match-room-view', () => ({
  DeckToMatchRoomView: ({
    viewerDisplayName,
    deck,
  }: {
    readonly viewerDisplayName: string
    readonly deck: { readonly id: string; readonly title: string }
  }) => {
    mocks.deckToMatchRoomView({ viewerDisplayName, deck })

    return (
      <div data-testid="deck-to-match-room-view">
        {viewerDisplayName} starts {deck.title}
      </div>
    )
  },
}))

import StartMatchRoomPage from './page'

describe('StartMatchRoomPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDeckToMatchRoomPageState.mockResolvedValue({
      kind: 'ready',
      viewerDisplayName: 'Owner',
      deck: {
        id: 'deck-standard-1',
        title: 'Owned Standard',
      },
    })
  })

  it('loads the selected owned deck and renders the deck-to-room product flow', async () => {
    render(
      await StartMatchRoomPage({
        searchParams: Promise.resolve({
          deckId: 'deck-standard-1',
        }),
      }),
    )

    expect(mocks.getDeckToMatchRoomPageState).toHaveBeenCalledWith({
      deckId: 'deck-standard-1',
    })
    expect(mocks.deckToMatchRoomView).toHaveBeenCalledWith({
      viewerDisplayName: 'Owner',
      deck: {
        id: 'deck-standard-1',
        title: 'Owned Standard',
      },
    })
    expect(screen.getByTestId('deck-to-match-room-view')).toHaveTextContent(
      'Owner starts Owned Standard',
    )
  })

  it('keeps the product flow pointed at persisted multiplayer routes', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'src/app/(protected)/matches/start/page.tsx'),
      'utf8',
    )

    expect(source).toContain('DeckToMatchRoomView')
    expect(source).toContain('getDeckToMatchRoomPageState')
    expect(source).not.toContain('BasicMatchRoomView')
    expect(source).not.toContain('createLocalPrototypeMatchRoom')
  })
})
