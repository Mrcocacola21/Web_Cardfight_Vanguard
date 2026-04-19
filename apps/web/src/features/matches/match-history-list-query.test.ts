import { describe, expect, it } from 'vitest'

import {
  buildMatchHistoryListHref,
  hasActiveMatchHistoryListFilters,
  resolveMatchHistoryListQuery,
} from './match-history-list-query'

describe('resolveMatchHistoryListQuery', () => {
  it('normalizes supported filters and trims noisy opponent text', () => {
    const result = resolveMatchHistoryListQuery({
      result: 'win',
      deck: ' deck-1 ',
      opponent: '  Azure    Rival  ',
      format: 'standard',
      from: '2026-04-01',
      to: '2026-04-30',
    })

    expect(result).toEqual({
      result: 'win',
      deckId: 'deck-1',
      opponent: 'Azure Rival',
      formatId: 'standard',
      playedFrom: '2026-04-01',
      playedTo: '2026-04-30',
    })
  })

  it('falls back to safe defaults for unsupported filters and invalid dates', () => {
    const result = resolveMatchHistoryListQuery({
      result: 'forfeit',
      deck: '   ',
      opponent: 'a'.repeat(80),
      format: 'legacy',
      from: 'bad-date',
      to: '2026-02-31',
    })

    expect(result).toEqual({
      result: 'all',
      deckId: null,
      opponent: 'a'.repeat(64),
      formatId: 'all',
      playedFrom: null,
      playedTo: null,
    })
  })
})

describe('match history list query helpers', () => {
  it('reports whether any filters are active', () => {
    expect(
      hasActiveMatchHistoryListFilters({
        result: 'all',
        deckId: null,
        opponent: '',
        formatId: 'all',
        playedFrom: null,
        playedTo: null,
      }),
    ).toBe(false)

    expect(
      hasActiveMatchHistoryListFilters({
        result: 'draw',
        deckId: null,
        opponent: '',
        formatId: 'all',
        playedFrom: null,
        playedTo: null,
      }),
    ).toBe(true)
  })

  it('builds stable hrefs without empty parameters', () => {
    expect(
      buildMatchHistoryListHref({
        result: 'all',
        deckId: null,
        opponent: '',
        formatId: 'all',
        playedFrom: null,
        playedTo: null,
      }),
    ).toBe('/matches')

    expect(
      buildMatchHistoryListHref({
        result: 'loss',
        deckId: 'deck-7',
        opponent: 'Azure Rival',
        formatId: 'premium',
        playedFrom: '2026-04-01',
        playedTo: '2026-04-30',
      }),
    ).toBe(
      '/matches?result=loss&deck=deck-7&opponent=Azure+Rival&format=premium&from=2026-04-01&to=2026-04-30',
    )
  })
})
