import type { ManualMatchEntryValidationErrors } from './manual-match-entry-validation'

export interface ManualMatchEntryFormState {
  readonly status: 'idle' | 'success' | 'error'
  readonly message: string | null
  readonly fieldErrors: ManualMatchEntryValidationErrors
  readonly createdMatchId: string | null
}

export const initialManualMatchEntryFormState: ManualMatchEntryFormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
  createdMatchId: null,
}
