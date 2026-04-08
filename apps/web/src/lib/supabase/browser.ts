import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@web-vg/db'

import { getSupabasePublicEnv } from './config'

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabasePublicEnv()

  return createBrowserClient<Database>(url, publishableKey)
}
