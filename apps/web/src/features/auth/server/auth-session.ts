import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSignedOutSupabaseAuthError } from '@/lib/supabase/auth-errors'

export interface AuthUserRecord {
  readonly id: string
  readonly email: string | null
}

export type CurrentAuthState =
  | {
      readonly kind: 'signed-out'
    }
  | {
      readonly kind: 'ready'
      readonly user: AuthUserRecord
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

interface GetCurrentAuthStateOptions {
  readonly client?: Awaited<ReturnType<typeof createSupabaseServerClient>>
}

export async function getCurrentAuthState(
  options?: GetCurrentAuthStateOptions,
): Promise<CurrentAuthState> {
  const client = options?.client ?? (await createSupabaseServerClient())

  try {
    const {
      data: { user },
      error,
    } = await client.auth.getUser()

    if (!user && isSignedOutSupabaseAuthError(error)) {
      return {
        kind: 'signed-out',
      }
    }

    if (error) {
      return {
        kind: 'error',
        message: 'Failed to resolve the current authenticated session.',
      }
    }

    if (!user) {
      return {
        kind: 'signed-out',
      }
    }

    return {
      kind: 'ready',
      user: {
        id: user.id,
        email: user.email ?? null,
      },
    }
  } catch (error) {
    if (isSignedOutSupabaseAuthError(error)) {
      return {
        kind: 'signed-out',
      }
    }

    return {
      kind: 'error',
      message: 'Failed to resolve the current authenticated session.',
    }
  }
}
