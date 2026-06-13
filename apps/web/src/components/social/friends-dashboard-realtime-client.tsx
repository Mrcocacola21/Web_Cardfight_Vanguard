'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createSocialFriendsDashboardFingerprint,
  type SocialFriendsDashboardSnapshot,
  type SocialFriendsRealtimeResponse,
} from '@/features/social/realtime/friends-dashboard-realtime'

import {
  FriendsDashboardView,
  type FriendsDashboardSyncStatus,
} from './friends-dashboard-view'

const DEFAULT_SOCIAL_POLL_INTERVAL_MS = 2_500

interface FriendsDashboardRealtimeClientProps {
  readonly initialSnapshot: SocialFriendsDashboardSnapshot
  readonly pollIntervalMs?: number
}

export function FriendsDashboardRealtimeClient({
  initialSnapshot,
  pollIntervalMs = DEFAULT_SOCIAL_POLL_INTERVAL_MS,
}: FriendsDashboardRealtimeClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [syncStatus, setSyncStatus] = useState<FriendsDashboardSyncStatus>({
    status: 'synced',
    label: 'Live',
  })
  const inFlightRef = useRef(false)

  const applySnapshot = useCallback(
    (nextSnapshot: SocialFriendsDashboardSnapshot) => {
      const nextFingerprint =
        createSocialFriendsDashboardFingerprint(nextSnapshot)

      setSnapshot((current) => {
        const currentFingerprint =
          createSocialFriendsDashboardFingerprint(current)

        if (nextFingerprint === currentFingerprint) {
          return {
            ...current,
            refreshedAt: nextSnapshot.refreshedAt,
          }
        }

        return nextSnapshot
      })
    },
    [],
  )

  useEffect(() => {
    let cancelled = false

    async function loadSnapshot() {
      if (inFlightRef.current) {
        return
      }

      inFlightRef.current = true
      setSyncStatus({
        status: 'syncing',
        label: 'Refreshing',
      })

      try {
        const response = await fetch('/api/social/friends/realtime', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        })
        const body = parseRealtimeResponse(await response.json())

        if (!response.ok || body.status === 'error') {
          throw new Error(
            body.status === 'error'
              ? body.message
              : `Social realtime failed with HTTP ${response.status}.`,
          )
        }

        if (!cancelled) {
          applySnapshot(body.snapshot)
          setSyncStatus({
            status: 'synced',
            label: 'Live',
          })
        }
      } catch (error) {
        if (!cancelled) {
          setSyncStatus({
            status: 'error',
            label: 'Sync issue',
            message: error instanceof Error ? error.message : 'Unknown error.',
          })
        }
      } finally {
        inFlightRef.current = false
      }
    }

    void loadSnapshot()

    const intervalId = window.setInterval(
      () => void loadSnapshot(),
      pollIntervalMs,
    )

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [applySnapshot, pollIntervalMs])

  return (
    <FriendsDashboardView
      viewerDisplayName={snapshot.viewerDisplayName}
      friends={snapshot.friends}
      incomingRequests={snapshot.incomingRequests}
      outgoingRequests={snapshot.outgoingRequests}
      syncStatus={syncStatus}
    />
  )
}

function parseRealtimeResponse(value: unknown): SocialFriendsRealtimeResponse {
  if (!isRecord(value)) {
    throw new Error('Social realtime route returned a non-object payload.')
  }

  if (value.status === 'ok' && isRecord(value.snapshot)) {
    return value as unknown as SocialFriendsRealtimeResponse
  }

  if (
    value.status === 'error' &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  ) {
    return value as unknown as SocialFriendsRealtimeResponse
  }

  throw new Error('Social realtime response did not match the route contract.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
