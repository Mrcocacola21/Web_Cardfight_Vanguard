import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getManualMatchEntryPageState: vi.fn(),
  manualMatchEntryView: vi.fn(),
}))

vi.mock('@/features/matches/server/manual-match-entry-read', () => ({
  getManualMatchEntryPageState: mocks.getManualMatchEntryPageState,
}))

vi.mock('@/components/matches/manual-match-entry-view', () => ({
  ManualMatchEntryView: ({
    viewerDisplayName,
    deckOptions,
    defaultPlayedOn,
  }: {
    viewerDisplayName: string
    deckOptions: readonly unknown[]
    defaultPlayedOn: string
  }) => {
    mocks.manualMatchEntryView({
      viewerDisplayName,
      deckOptions,
      defaultPlayedOn,
    })

    return (
      <div>
        <span data-testid="viewer-name">{viewerDisplayName}</span>
        <span data-testid="deck-count">{deckOptions.length}</span>
        <span data-testid="default-played-on">{defaultPlayedOn}</span>
      </div>
    )
  },
}))

import NewMatchPage from './page'

describe('NewMatchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getManualMatchEntryPageState.mockResolvedValue({
      kind: 'ready',
      viewerDisplayName: 'Azure Pilot',
      deckOptions: [{ id: 'deck-1' }],
      defaultPlayedOn: '2026-04-18',
    })
  })

  it('loads the manual match entry read model before rendering the page view', async () => {
    render(await NewMatchPage())

    expect(mocks.getManualMatchEntryPageState).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('viewer-name')).toHaveTextContent('Azure Pilot')
    expect(screen.getByTestId('deck-count')).toHaveTextContent('1')
    expect(screen.getByTestId('default-played-on')).toHaveTextContent(
      '2026-04-18',
    )
  })
})
