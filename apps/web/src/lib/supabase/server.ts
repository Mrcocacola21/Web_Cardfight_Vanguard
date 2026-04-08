import { createServerClient } from '@supabase/ssr'
import type { Database } from '@web-vg/db'
import { cookies } from 'next/headers'

import { getSupabasePublicEnv } from './config'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = getSupabasePublicEnv()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot always persist cookies directly.
        }
      },
    },
  })
}
