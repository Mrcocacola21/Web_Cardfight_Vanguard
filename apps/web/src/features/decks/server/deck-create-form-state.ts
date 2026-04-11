export interface DeckCreateFormState {
  readonly status: 'idle' | 'error'
  readonly message: string | null
  readonly fieldErrors: {
    readonly formatId?: string
  }
}

export const initialDeckCreateFormState: DeckCreateFormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}
