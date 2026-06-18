export interface DeckToMatchRoomFieldErrors {
  readonly deckId?: string
  readonly opponentProfileId?: string
}

export interface DeckToMatchRoomFormState {
  readonly status: 'idle' | 'error'
  readonly message: string | null
  readonly fieldErrors: DeckToMatchRoomFieldErrors
}

export const initialDeckToMatchRoomFormState: DeckToMatchRoomFormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}
