export type FriendRequestFormCode =
  | 'request-sent'
  | 'auth-required'
  | 'self-request'
  | 'already-pending'
  | 'already-friends'
  | 'request-unavailable'
  | 'unavailable'

export interface FriendRequestFormState {
  readonly status: 'idle' | 'success' | 'error'
  readonly code: FriendRequestFormCode | null
  readonly message: string | null
}

export const initialFriendRequestFormState: FriendRequestFormState = {
  status: 'idle',
  code: null,
  message: null,
}
