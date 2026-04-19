import type { VisibleProfileRecord } from '@web-vg/db/repositories/profiles'

export type MatchOpponentSearchFormState =
  | {
      readonly kind: 'idle'
      readonly query: string
      readonly reason: 'empty' | 'too-short'
    }
  | {
      readonly kind: 'ready'
      readonly query: string
      readonly results: readonly VisibleProfileRecord[]
    }
  | {
      readonly kind: 'error'
      readonly query: string
      readonly message: string
    }

export const initialMatchOpponentSearchFormState: MatchOpponentSearchFormState =
  {
    kind: 'idle',
    query: '',
    reason: 'empty',
  }
