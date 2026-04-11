import { createClient } from '@supabase/supabase-js'

import type { Database } from './generated/database.types'

export interface CreateDbClientInput {
  readonly url: string
  readonly serviceRoleKey: string
}

export function createDbClient(input: CreateDbClientInput) {
  return createClient<Database>(input.url, input.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
