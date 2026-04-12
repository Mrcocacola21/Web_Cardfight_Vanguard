import type { DbClient } from '@web-vg/db'

import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface ReadyDeckActionContext {
  readonly client: DbClient
  readonly authUserId: string
}

export async function resolveReadyDeckActionContext(): Promise<
  | {
      readonly ok: true
      readonly data: ReadyDeckActionContext
    }
  | {
      readonly ok: false
      readonly message: string
    }
> {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'error') {
    return {
      ok: false,
      message: authState.message,
    }
  }

  if (authState.kind !== 'ready') {
    return {
      ok: false,
      message: 'You need an authenticated session before deck actions can run.',
    }
  }

  return {
    ok: true,
    data: {
      client,
      authUserId: authState.user.id,
    },
  }
}

export async function requireReadyDeckActionContext(): Promise<ReadyDeckActionContext> {
  const result = await resolveReadyDeckActionContext()

  if (!result.ok) {
    throw new Error(result.message)
  }

  return result.data
}
