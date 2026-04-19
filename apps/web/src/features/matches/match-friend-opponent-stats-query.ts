export interface MatchFriendOpponentStatsQuery {
  readonly friendProfileId: string | null
}

export function resolveMatchFriendOpponentStatsQuery(
  searchParams: Record<string, string | readonly string[] | undefined>,
): MatchFriendOpponentStatsQuery {
  const friendProfileId = normalizeIdentifier(searchParams.friend)

  return {
    friendProfileId,
  }
}

export function buildMatchFriendOpponentStatsHref(
  query: MatchFriendOpponentStatsQuery,
): string {
  if (!query.friendProfileId) {
    return '/matches/friends'
  }

  const params = new URLSearchParams({
    friend: query.friendProfileId,
  })

  return `/matches/friends?${params.toString()}`
}

function normalizeIdentifier(
  value: string | readonly string[] | undefined,
): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (Array.isArray(value)) {
    const normalized = typeof value[0] === 'string' ? value[0].trim() : ''
    return normalized.length > 0 ? normalized : null
  }

  return null
}
