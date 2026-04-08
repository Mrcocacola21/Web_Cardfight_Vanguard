import { createServerClient } from '@supabase/ssr'
import type { Database } from '@web-vg/db'
import { NextResponse, type NextRequest } from 'next/server'

import { getSupabasePublicEnv } from './config'

export async function updateSupabaseSession(request: NextRequest) {
  const { url, publishableKey } = getSupabasePublicEnv()
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value)
        }

        response = NextResponse.next({
          request,
        })

        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options)
        }
      },
    },
  })

  await supabase.auth.getUser()

  return response
}
