import { describe, expect, it } from 'vitest'

import {
  buildMatchFriendOpponentStatsHref,
  resolveMatchFriendOpponentStatsQuery,
} from './match-friend-opponent-stats-query'

describe('resolveMatchFriendOpponentStatsQuery', () => {
  it('normalizes a selected friend profile id from search params', () => {
    expect(
      resolveMatchFriendOpponentStatsQuery({
        friend: ' profile-friend-1 ',
      }),
    ).toEqual({
      friendProfileId: 'profile-friend-1',
    })
  })

  it('falls back to an unscoped query for empty or missing values', () => {
    expect(
      resolveMatchFriendOpponentStatsQuery({
        friend: '',
      }),
    ).toEqual({
      friendProfileId: null,
    })

    expect(resolveMatchFriendOpponentStatsQuery({})).toEqual({
      friendProfileId: null,
    })
  })
})

describe('buildMatchFriendOpponentStatsHref', () => {
  it('builds the route href with or without a selected friend', () => {
    expect(
      buildMatchFriendOpponentStatsHref({
        friendProfileId: null,
      }),
    ).toBe('/matches/friends')

    expect(
      buildMatchFriendOpponentStatsHref({
        friendProfileId: 'profile-friend-2',
      }),
    ).toBe('/matches/friends?friend=profile-friend-2')
  })
})
