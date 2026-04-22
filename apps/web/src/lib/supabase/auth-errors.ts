interface SupabaseAuthErrorFields {
  readonly code: string | null
  readonly message: string | null
}

function readSupabaseAuthErrorFields(error: unknown): SupabaseAuthErrorFields {
  if (typeof error === 'string') {
    return {
      code: null,
      message: error,
    }
  }

  if (typeof error !== 'object' || error === null) {
    return {
      code: null,
      message: null,
    }
  }

  const candidate = error as {
    readonly code?: unknown
    readonly message?: unknown
  }

  return {
    code: typeof candidate.code === 'string' ? candidate.code : null,
    message: typeof candidate.message === 'string' ? candidate.message : null,
  }
}

export function isSignedOutSupabaseAuthError(error: unknown): boolean {
  const { code, message } = readSupabaseAuthErrorFields(error)

  if (code?.toLowerCase() === 'refresh_token_not_found') {
    return true
  }

  if (!message) {
    return false
  }

  return /auth session missing|invalid refresh token|refresh token not found/i.test(
    message,
  )
}
