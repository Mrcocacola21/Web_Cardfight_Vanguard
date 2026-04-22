import { createServerClient } from '@supabase/ssr'
import type { Database } from '@web-vg/db'
import { NextResponse, type NextRequest } from 'next/server'

import { isSignedOutSupabaseAuthError } from './auth-errors'
import { getSupabasePublicEnv } from './config'

function isSupabaseAuthCookieName(name: string): boolean {
  return /^sb-.*(?:auth-token|code-verifier)(?:\.\d+)?$/u.test(name)
}

function clearSupabaseAuthCookies(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  for (const cookie of request.cookies.getAll()) {
    if (!isSupabaseAuthCookieName(cookie.name)) {
      continue
    }

    request.cookies.delete(cookie.name)
    response.cookies.set(cookie.name, '', {
      maxAge: 0,
      path: '/',
    })
  }

  return response
}

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

  try {
    await supabase.auth.getUser()
  } catch (error) {
    if (isSignedOutSupabaseAuthError(error)) {
      return clearSupabaseAuthCookies(request, response)
    }

    throw error
  }

  return response
}
