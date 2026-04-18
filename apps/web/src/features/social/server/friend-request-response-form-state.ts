export type FriendRequestResponseFormCode =
  | 'accepted'
  | 'declined'
  | 'auth-required'
  | 'forbidden'
  | 'already-handled'
  | 'unavailable'

export interface FriendRequestResponseFormState {
  readonly status: 'idle' | 'success' | 'error'
  readonly code: FriendRequestResponseFormCode | null
  readonly message: string | null
}

export const initialFriendRequestResponseFormState: FriendRequestResponseFormState =
  {
    status: 'idle',
    code: null,
    message: null,
  }
