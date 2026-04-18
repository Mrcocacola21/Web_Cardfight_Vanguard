import { createProfilesRepository } from '@web-vg/db'
import type { PublicProfileRecord } from '@web-vg/db/repositories/profiles'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  defaultUserSearchResultLimit,
  type UserSearchRouteQuery,
} from '@/features/profiles/user-search-query'

export type UserSearchPageState =
  | {
      readonly kind: 'idle'
      readonly reason: 'empty' | 'too-short'
    }
  | {
      readonly kind: 'ready'
      readonly results: readonly PublicProfileRecord[]
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getUserSearchPageState(
  query: UserSearchRouteQuery,
): Promise<UserSearchPageState> {
  if (query.kind === 'idle') {
    return {
      kind: 'idle',
      reason: query.reason,
    }
  }

  const client = await createSupabaseServerClient()
  const repository = createProfilesRepository(client)
  const result = await repository.searchPublicProfiles(
    query.searchText,
    defaultUserSearchResultLimit,
  )

  if (!result.ok) {
    return {
      kind: 'error',
      message: result.error.message,
    }
  }

  return {
    kind: 'ready',
    results: result.data,
  }
}
