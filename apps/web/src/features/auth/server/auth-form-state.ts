import type { AuthFieldErrors } from './auth-validation'

export interface AuthFormState {
  readonly status: 'idle' | 'success' | 'error'
  readonly message: string | null
  readonly fieldErrors: AuthFieldErrors
}

export const initialAuthFormState: AuthFormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}
