import { createServerClient } from '@supabase/ssr'
import type { Database } from '@web-vg/db'
import type { NextRequest, NextResponse } from 'next/server'

import { getSupabasePublicEnv } from './config'

interface CookieWrite {
  readonly name: string
  readonly value: string
  readonly options?: Parameters<NextResponse['cookies']['set']>[2]
}

export function createSupabaseRouteHandlerClient(request: NextRequest) {
  const { url, publishableKey } = getSupabasePublicEnv()
  const pendingCookies: CookieWrite[] = []

  const client = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          pendingCookies.push({
            name: cookie.name,
            value: cookie.value,
            options: cookie.options,
          })
        }
      },
    },
  })

  function applyResponseCookies(response: NextResponse) {
    for (const cookie of pendingCookies) {
      if (cookie.options) {
        response.cookies.set(cookie.name, cookie.value, cookie.options)
        continue
      }

      response.cookies.set(cookie.name, cookie.value)
    }

    return response
  }

  return {
    client,
    applyResponseCookies,
  }
}
