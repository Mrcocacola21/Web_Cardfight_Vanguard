import { NextResponse, type NextRequest } from 'next/server'

import {
  completeAuthCallbackFlow,
  createInitialProfileDraftFromAuthUser,
  getAuthCallbackErrorRedirectHref,
} from '@/features/auth/server/auth-callback'
import { ensureProfileForAuthUser } from '@/features/profiles/server/profile-provisioning'
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/route-handler'

export async function GET(request: NextRequest) {
  const { client, applyResponseCookies } =
    createSupabaseRouteHandlerClient(request)

  const result = await completeAuthCallbackFlow(request.nextUrl.searchParams, {
    async exchangeCodeForSession(code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code)

      if (error || !data.user) {
        return null
      }

      return {
        id: data.user.id,
        email: data.user.email ?? null,
        userMetadata: data.user.user_metadata,
      }
    },
    async verifyOtp({ tokenHash, type }) {
      const { data, error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })

      if (error || !data.user) {
        return null
      }

      return {
        id: data.user.id,
        email: data.user.email ?? null,
        userMetadata: data.user.user_metadata,
      }
    },
    async ensureProfile(user) {
      const initialProfileDraft = createInitialProfileDraftFromAuthUser(user)
      const profileResult = await ensureProfileForAuthUser({
        client,
        authUserId: user.id,
        displayName: initialProfileDraft.displayName,
        avatarUrl: initialProfileDraft.avatarUrl,
        bio: initialProfileDraft.bio,
        visibility: initialProfileDraft.visibility,
      })

      return profileResult.ok
    },
    async signOut() {
      await client.auth.signOut()
    },
  })

  if (result.kind === 'error') {
    return applyResponseCookies(
      NextResponse.redirect(
        new URL(getAuthCallbackErrorRedirectHref(result.code), request.url),
      ),
    )
  }

  return applyResponseCookies(
    NextResponse.redirect(new URL(result.href, request.url)),
  )
}
