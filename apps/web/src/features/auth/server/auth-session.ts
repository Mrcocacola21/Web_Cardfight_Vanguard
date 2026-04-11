import { createSupabaseServerClient } from '@/lib/supabase/server'

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
  const {
    data: { user },
    error,
  } = await client.auth.getUser()

  if (!user && isMissingAuthSessionError(error?.message)) {
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
}

function isMissingAuthSessionError(message: string | undefined): boolean {
  return typeof message === 'string' && /auth session missing/i.test(message)
}
