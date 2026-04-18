import { UserSearchView } from '@/components/profiles/user-search-view'
import { getUserSearchPageState } from '@/features/profiles/server/user-search-read'
import { resolveUserSearchRouteQuery } from '@/features/profiles/user-search-query'

interface UsersPageProps {
  readonly searchParams?: Promise<
    Record<string, string | readonly string[] | undefined>
  >
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const query = resolveUserSearchRouteQuery((await searchParams) ?? {})
  const state = await getUserSearchPageState(query)

  return <UserSearchView inputValue={query.inputValue} state={state} />
}
