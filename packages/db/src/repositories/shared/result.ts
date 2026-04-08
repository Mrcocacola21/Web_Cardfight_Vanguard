export type RepositoryErrorCode = 'query-failed' | 'conflict'

export interface RepositoryError {
  readonly code: RepositoryErrorCode
  readonly message: string
  readonly details?: string
}

export type RepositoryResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: RepositoryError
    }

interface QueryErrorLike {
  readonly code?: string | null
  readonly message: string
  readonly details?: string | null
}

export function ok<TData>(data: TData): RepositoryResult<TData> {
  return {
    ok: true,
    data,
  }
}

export function err<TData>(error: RepositoryError): RepositoryResult<TData> {
  return {
    ok: false,
    error,
  }
}

export function mapQueryError(
  error: QueryErrorLike,
  fallbackMessage: string,
): RepositoryError {
  return {
    code: error.code === '23505' ? 'conflict' : 'query-failed',
    message: fallbackMessage,
    details: error.details ?? error.message,
  }
}
