import type {
  MatchHistoryApplicationResult,
  MatchHistoryApplicationServices,
} from './match-history-application-support'
import {
  createMatchStatsSummary,
  type MatchStatsSummary,
} from './match-stats-aggregation'

export type MatchStatsView = MatchStatsSummary

export interface GetMatchStatsViewCommand {
  readonly ownerProfileId: string
}

export async function getMatchStatsViewUseCase(
  services: MatchHistoryApplicationServices,
  command: GetMatchStatsViewCommand,
): Promise<MatchHistoryApplicationResult<MatchStatsView>> {
  const matchesResult =
    await services.repository.listAllMatchHistoryItemsByOwner(
      command.ownerProfileId,
    )

  if (!matchesResult.ok) {
    return mapRepositoryFailure(matchesResult.error.message)
  }

  return {
    ok: true,
    data: createMatchStatsSummary(matchesResult.data),
  }
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
