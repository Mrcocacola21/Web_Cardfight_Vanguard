import type { ProfileValidationErrors } from './profile-validation'

export interface ProfileFormState {
  readonly status: 'idle' | 'success' | 'error'
  readonly message: string | null
  readonly fieldErrors: ProfileValidationErrors
}

export const initialProfileFormState: ProfileFormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}
