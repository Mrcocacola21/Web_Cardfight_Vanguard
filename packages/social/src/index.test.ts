import { describe, expect, expectTypeOf, it } from 'vitest'

import * as entry from './index'
import type { Match, MatchId, MatchResult, User, UserId } from './index'

describe('@web-vg/social', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(Object.keys(entry)).toEqual([])
  })

  it('keeps social records keyed by social identities', () => {
    expectTypeOf<User['id']>().toEqualTypeOf<UserId>()
    expectTypeOf<Match['id']>().toEqualTypeOf<MatchId>()
    expectTypeOf<Match['result']>().toEqualTypeOf<MatchResult | undefined>()
  })
})
