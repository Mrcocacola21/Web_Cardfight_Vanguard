import type { ActiveFriendRecord } from '@web-vg/db/repositories/social'

import type { MatchHistoryApplicationResult } from './match-history-application-support'
import {
  createMatchStatsSummary,
  isTrackedStatsMatch,
  type MatchStatsTopDeck,
} from './match-stats-aggregation'
import type { MatchHistoryRepository } from './match-history-repository'
import type { MatchHistoryRepositoryResult } from './match-history-repository'
import type { StoredMatchHistoryListItem } from './match-history-repository'

export interface FriendOpponentStatsSummary {
  readonly friendProfileId: string
  readonly friendDisplayName: string
  readonly friendAvatarUrl: string | null
  readonly friendBio: string | null
  readonly friendProfileVisible: boolean
  readonly totalMatches: number
  readonly wins: number
  readonly losses: number
  readonly draws: number
  readonly winRate: number | null
  readonly latestMatchAt: string | null
}

export interface FriendOpponentStatsDetail {
  readonly friendProfileId: string
  readonly friendDisplayName: string
  readonly friendAvatarUrl: string | null
  readonly friendBio: string | null
  readonly friendProfileVisible: boolean
  readonly totalMatches: number
  readonly wins: number
  readonly losses: number
  readonly draws: number
  readonly winRate: number | null
  readonly latestMatchAt: string | null
  readonly topDecks: readonly MatchStatsTopDeck[]
}

export interface FriendOpponentStatsView {
  readonly totalCurrentFriends: number
  readonly friendsWithTrackedMatches: number
  readonly friendSummaries: readonly FriendOpponentStatsSummary[]
  readonly selectedFriendProfileId: string | null
  readonly selectedFriend: FriendOpponentStatsDetail | null
}

export interface MatchFriendOpponentStatsServices {
  readonly matchHistoryRepository: Pick<
    MatchHistoryRepository,
    'listAllMatchHistoryItemsByOwner'
  >
  readonly listAllActiveFriendships: (
    ownerProfileId: string,
  ) => Promise<MatchHistoryRepositoryResult<readonly ActiveFriendRecord[]>>
}

export interface GetFriendOpponentStatsViewCommand {
  readonly ownerProfileId: string
  readonly selectedFriendProfileId?: string | null
}

export async function getFriendOpponentStatsViewUseCase(
  services: MatchFriendOpponentStatsServices,
  command: GetFriendOpponentStatsViewCommand,
): Promise<MatchHistoryApplicationResult<FriendOpponentStatsView>> {
  const [friendsResult, matchesResult] = await Promise.all([
    services.listAllActiveFriendships(command.ownerProfileId),
    services.matchHistoryRepository.listAllMatchHistoryItemsByOwner(
      command.ownerProfileId,
    ),
  ])

  if (!friendsResult.ok) {
    return mapRepositoryFailure(friendsResult.error.message)
  }

  if (!matchesResult.ok) {
    return mapRepositoryFailure(matchesResult.error.message)
  }

  const matchesByFriendProfileId = groupMatchesByCurrentFriend(
    matchesResult.data,
    friendsResult.data,
  )
  const friendSummaries = [...friendsResult.data]
    .map((friend) =>
      createFriendSummary(
        friend,
        matchesByFriendProfileId.get(friend.friendProfileId) ?? [],
      ),
    )
    .sort(compareFriendSummaries)
  const selectedFriendProfileId = resolveSelectedFriendProfileId(
    friendSummaries,
    command.selectedFriendProfileId ?? null,
  )
  const selectedFriend = friendSummaries.find(
    (friend) => friend.friendProfileId === selectedFriendProfileId,
  )

  return {
    ok: true,
    data: {
      totalCurrentFriends: friendSummaries.length,
      friendsWithTrackedMatches: friendSummaries.filter(
        (friend) => friend.totalMatches > 0,
      ).length,
      friendSummaries,
      selectedFriendProfileId,
      selectedFriend: selectedFriend
        ? createFriendDetail(
            selectedFriend,
            matchesByFriendProfileId.get(selectedFriend.friendProfileId) ?? [],
          )
        : null,
    },
  }
}

function groupMatchesByCurrentFriend(
  matches: readonly StoredMatchHistoryListItem[],
  friends: readonly ActiveFriendRecord[],
) {
  const currentFriendIds = new Set(
    friends.map((friend) => friend.friendProfileId),
  )
  const grouped = new Map<string, StoredMatchHistoryListItem[]>()

  for (const match of matches) {
    const opponentProfileId = match.opponent.profileId

    if (!opponentProfileId || !currentFriendIds.has(opponentProfileId)) {
      continue
    }

    const friendMatches = grouped.get(opponentProfileId)

    if (friendMatches) {
      friendMatches.push(match)
      continue
    }

    grouped.set(opponentProfileId, [match])
  }

  return grouped
}

function createFriendSummary(
  friend: ActiveFriendRecord,
  matches: readonly StoredMatchHistoryListItem[],
): FriendOpponentStatsSummary {
  const summary = createMatchStatsSummary(matches, {
    topDeckLimit: 3,
  })

  return {
    friendProfileId: friend.friendProfileId,
    friendDisplayName: friend.friendDisplayName,
    friendAvatarUrl: friend.friendAvatarUrl,
    friendBio: friend.friendBio,
    friendProfileVisible: friend.friendProfileVisible,
    totalMatches: summary.totalMatches,
    wins: summary.wins,
    losses: summary.losses,
    draws: summary.draws,
    winRate: summary.winRate,
    latestMatchAt: resolveLatestMatchAt(matches),
  }
}

function createFriendDetail(
  friend: FriendOpponentStatsSummary,
  matches: readonly StoredMatchHistoryListItem[],
): FriendOpponentStatsDetail {
  const summary = createMatchStatsSummary(matches, {
    topDeckLimit: 3,
  })

  return {
    friendProfileId: friend.friendProfileId,
    friendDisplayName: friend.friendDisplayName,
    friendAvatarUrl: friend.friendAvatarUrl,
    friendBio: friend.friendBio,
    friendProfileVisible: friend.friendProfileVisible,
    totalMatches: summary.totalMatches,
    wins: summary.wins,
    losses: summary.losses,
    draws: summary.draws,
    winRate: summary.winRate,
    latestMatchAt: resolveLatestMatchAt(matches),
    topDecks: summary.topDecks,
  }
}

function resolveLatestMatchAt(matches: readonly StoredMatchHistoryListItem[]) {
  const trackedMatches = matches.filter(isTrackedStatsMatch)

  if (trackedMatches.length === 0) {
    return null
  }

  return trackedMatches
    .map((match) => match.playedAt)
    .sort((left, right) => right.localeCompare(left))[0]!
}

function resolveSelectedFriendProfileId(
  summaries: readonly FriendOpponentStatsSummary[],
  requestedFriendProfileId: string | null,
) {
  if (
    requestedFriendProfileId &&
    summaries.some(
      (friend) => friend.friendProfileId === requestedFriendProfileId,
    )
  ) {
    return requestedFriendProfileId
  }

  return summaries[0]?.friendProfileId ?? null
}

function compareFriendSummaries(
  left: FriendOpponentStatsSummary,
  right: FriendOpponentStatsSummary,
) {
  return (
    right.totalMatches - left.totalMatches ||
    compareNullableDates(right.latestMatchAt, left.latestMatchAt) ||
    left.friendDisplayName.localeCompare(right.friendDisplayName)
  )
}

function compareNullableDates(left: string | null, right: string | null) {
  if (left && right) {
    return left.localeCompare(right)
  }

  if (left) {
    return -1
  }

  if (right) {
    return 1
  }

  return 0
}

function mapRepositoryFailure(
  message: string,
): MatchHistoryApplicationResult<never> {
  return {
    ok: false,
    error: {
      code: 'repository-failed',
      message,
    },
  }
}
