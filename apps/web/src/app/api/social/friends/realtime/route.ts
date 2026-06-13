import { NextResponse } from 'next/server'

import {
  createSocialFriendsDashboardSnapshot,
  SOCIAL_FRIENDS_REALTIME_TRANSPORT,
  type SocialFriendsRealtimeResponse,
} from '@/features/social/realtime/friends-dashboard-realtime'
import { getFriendsDashboardPageState } from '@/features/social/server/friends-dashboard-read'

export const dynamic = 'force-dynamic'

export async function GET() {
  const state = await getFriendsDashboardPageState()

  if (state.kind === 'ready') {
    return createJsonResponse({
      transport: SOCIAL_FRIENDS_REALTIME_TRANSPORT,
      status: 'ok',
      snapshot: createSocialFriendsDashboardSnapshot(
        state,
        new Date().toISOString(),
      ),
    })
  }

  if (state.kind === 'profile-unavailable') {
    return createJsonResponse(
      {
        transport: SOCIAL_FRIENDS_REALTIME_TRANSPORT,
        status: 'error',
        code: 'profile_required',
        message:
          'The friends dashboard requires a profile before live social updates are available.',
      },
      403,
    )
  }

  return createJsonResponse(
    {
      transport: SOCIAL_FRIENDS_REALTIME_TRANSPORT,
      status: 'error',
      code: resolveDashboardErrorCode(state.message),
      message: state.message,
    },
    state.message === 'The friends dashboard requires an authenticated session.'
      ? 401
      : 503,
  )
}

function resolveDashboardErrorCode(
  message: string,
): Exclude<SocialFriendsRealtimeResponse, { status: 'ok' }>['code'] {
  return message === 'The friends dashboard requires an authenticated session.'
    ? 'auth_required'
    : 'dashboard_unavailable'
}

function createJsonResponse(body: SocialFriendsRealtimeResponse, status = 200) {
  return NextResponse.json(body, { status })
}
