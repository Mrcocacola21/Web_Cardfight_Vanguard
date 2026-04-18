import { describe, expect, it } from 'vitest'

import { resolveUserSearchRouteQuery } from './user-search-query'

describe('resolveUserSearchRouteQuery', () => {
  it('normalizes and preserves a searchable display-name query', () => {
    expect(
      resolveUserSearchRouteQuery({
        q: '   Azure    Pilot   ',
      }),
    ).toEqual({
      kind: 'searchable',
      inputValue: 'Azure Pilot',
      searchText: 'Azure Pilot',
    })
  })

  it('returns an idle empty state for missing or blank queries', () => {
    expect(resolveUserSearchRouteQuery({})).toEqual({
      kind: 'idle',
      inputValue: '',
      reason: 'empty',
    })

    expect(
      resolveUserSearchRouteQuery({
        q: '   ',
      }),
    ).toEqual({
      kind: 'idle',
      inputValue: '',
      reason: 'empty',
    })
  })

  it('drops one-character noise tokens and blocks too-short broad searches', () => {
    expect(
      resolveUserSearchRouteQuery({
        q: 'a',
      }),
    ).toEqual({
      kind: 'idle',
      inputValue: 'a',
      reason: 'too-short',
    })

    expect(
      resolveUserSearchRouteQuery({
        q: 'a pilot',
      }),
    ).toEqual({
      kind: 'searchable',
      inputValue: 'a pilot',
      searchText: 'pilot',
    })
  })
})
