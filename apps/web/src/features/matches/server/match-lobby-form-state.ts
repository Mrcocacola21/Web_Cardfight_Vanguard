export interface MatchLobbyFormState {
  readonly status: 'idle' | 'success' | 'error'
  readonly message: string | null
  readonly fieldErrors: Readonly<Record<string, string>>
}

export const initialMatchLobbyFormState: MatchLobbyFormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}
