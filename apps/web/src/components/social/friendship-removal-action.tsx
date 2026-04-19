'use client'

import { useActionState, useState } from 'react'
import { UserMinus } from 'lucide-react'

import { ErrorState, SuccessState } from '@/components/feedback'
import { Button } from '@/components/ui/button'
import {
  initialFriendRemovalFormState,
  type FriendRemovalFormState,
} from '@/features/social/server/friend-removal-form-state'
import { removeFriendAction } from '@/features/social/server/friendship-actions'

interface FriendshipRemovalActionProps {
  readonly targetProfileId: string
  readonly targetDisplayName: string
  readonly compact?: boolean
}

export function FriendshipRemovalAction({
  targetProfileId,
  targetDisplayName,
  compact = false,
}: FriendshipRemovalActionProps) {
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false)
  const [state, formAction, isPending] = useActionState<
    FriendRemovalFormState,
    FormData
  >(removeFriendAction, initialFriendRemovalFormState)

  const actionBlocked = isPending || state.status === 'success'

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {isConfirmingRemoval ? (
        <div className="space-y-3 rounded-2xl border border-border/70 bg-background-elevated/60 p-4">
          <p className="text-sm text-muted-foreground">
            Remove {targetDisplayName} from your friends? This disconnects the
            active friendship for both sides.
          </p>
          <form action={formAction} className="flex flex-wrap gap-2">
            <input
              type="hidden"
              name="targetProfileId"
              value={targetProfileId}
            />
            <Button
              type="submit"
              variant="destructive"
              size={compact ? 'sm' : 'default'}
              disabled={actionBlocked}
            >
              <UserMinus className="size-4" />
              {isPending ? 'Removing...' : 'Confirm removal'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size={compact ? 'sm' : 'default'}
              disabled={actionBlocked}
              onClick={() => setIsConfirmingRemoval(false)}
            >
              Keep friend
            </Button>
          </form>
        </div>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size={compact ? 'sm' : 'default'}
          disabled={actionBlocked}
          onClick={() => setIsConfirmingRemoval(true)}
        >
          <UserMinus className="size-4" />
          Remove friend
        </Button>
      )}

      {state.message ? (
        state.status === 'success' ? (
          <SuccessState
            compact
            title="Friend removed"
            description={state.message}
          />
        ) : (
          <ErrorState
            compact
            title="Friend removal unavailable"
            description={state.message}
          />
        )
      ) : null}
    </div>
  )
}
