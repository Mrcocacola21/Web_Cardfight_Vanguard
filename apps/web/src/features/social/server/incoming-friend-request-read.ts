import { createSocialRepository } from '@web-vg/db'
import type { IncomingFriendRequestRecord } from '@web-vg/db/repositories/social'

import { createSupabaseServerClient } from '@/lib/supabase/server'

const defaultIncomingFriendRequestLimit = 20

export type IncomingFriendRequestsState =
  | {
      readonly kind: 'ready'
      readonly requests: readonly IncomingFriendRequestRecord[]
    }
  | {
      readonly kind: 'error'
      readonly message: string
    }

export async function getIncomingFriendRequestsState(
  recipientProfileId: string | null,
): Promise<IncomingFriendRequestsState> {
  if (!recipientProfileId) {
    return {
      kind: 'ready',
      requests: [],
    }
  }

  const client = await createSupabaseServerClient()
  const repository = createSocialRepository(client)
  const result = await repository.listIncomingPendingFriendRequests(
    recipientProfileId,
    defaultIncomingFriendRequestLimit,
  )

  if (!result.ok) {
    return {
      kind: 'error',
      message: result.error.message,
    }
  }

  return {
    kind: 'ready',
    requests: result.data,
  }
}
