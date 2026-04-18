export type FriendRemovalFormCode =
  | 'removed'
  | 'auth-required'
  | 'friendship-not-found'
  | 'unavailable'

export interface FriendRemovalFormState {
  readonly status: 'idle' | 'success' | 'error'
  readonly code: FriendRemovalFormCode | null
  readonly message: string | null
}

export const initialFriendRemovalFormState: FriendRemovalFormState = {
  status: 'idle',
  code: null,
  message: null,
}
