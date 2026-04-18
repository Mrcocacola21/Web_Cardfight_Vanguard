import { UserSearchView } from '@/components/profiles/user-search-view'

export default function UsersLoadingPage() {
  return <UserSearchView inputValue="" state={{ kind: 'loading' }} />
}
