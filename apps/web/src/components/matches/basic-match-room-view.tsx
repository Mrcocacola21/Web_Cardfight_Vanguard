'use client'

import { useMemo, useRef, useState } from 'react'

import * as matchSession from '@web-vg/match-session'
import type { MatchRoomCommandResult } from '@web-vg/match-session'

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  LOCAL_MATCH_PARTICIPANT_ONE_ID,
  LOCAL_MATCH_PARTICIPANT_TWO_ID,
  LOCAL_MATCH_PLAYER_ONE_ID,
  LOCAL_MATCH_PLAYER_TWO_ID,
  createLocalActionId,
  createLocalPrototypeMatchRoom,
} from '@/features/matches/play/local-match-room'
import {
  buildLocalMatchAvailableActions,
  type LocalAvailableActionIntent,
} from '@/features/matches/play/available-actions'
import {
  appendAcceptedEngineEvents,
  buildLocalMatchEventLogEntries,
  type LocalMatchEventRecord,
} from '@/features/matches/play/event-log'
import {
  buildProjectedMatchRoomClientState,
  type MatchClientActionView,
} from '@/features/matches/play/projected-client-state'

import {
  ProjectedMatchRoomView,
  type ProjectedMatchChoiceSubmission,
  type ProjectedMatchCommandFeedback,
} from './projected-match-room-view'

interface BasicMatchRoomViewProps {
  readonly roomId: string
}

type BasicMatchRoomState =
  | matchSession.InitializedMatchRoom
  | matchSession.InProgressMatchRoom
  | matchSession.CompletedMatchRoom

export function BasicMatchRoomView({ roomId }: BasicMatchRoomViewProps) {
  return <BasicMatchRoomSession key={roomId} roomId={roomId} />
}

function BasicMatchRoomSession({ roomId }: BasicMatchRoomViewProps) {
  const [room, setRoom] = useState<BasicMatchRoomState>(() =>
    createLocalPrototypeMatchRoom(roomId),
  )
  const [lastResult, setLastResult] = useState<MatchRoomCommandResult | null>(
    null,
  )
  const [eventRecords, setEventRecords] = useState<
    readonly LocalMatchEventRecord[]
  >([])
  const actionSequenceRef = useRef(0)

  const clientRoomResult = useMemo(() => {
    const projection = matchSession.projectMatchRoomForParticipant(
      room,
      LOCAL_MATCH_PARTICIPANT_ONE_ID,
    )

    if (!projection.ok) {
      return projection
    }

    return buildProjectedMatchRoomClientState({
      projection: projection.projection,
    })
  }, [room])
  const availableActionsProjection = useMemo(
    () => buildLocalMatchAvailableActions(room, LOCAL_MATCH_PLAYER_ONE_ID),
    [room],
  )

  function nextActionId(label: string) {
    actionSequenceRef.current += 1

    return createLocalActionId(room.revision, actionSequenceRef.current, label)
  }

  function submitCommand(submission: matchSession.MatchRoomCommandSubmission) {
    const result = matchSession.submitMatchRoomCommand(room, submission)

    setLastResult(result)

    if (result.status === 'accepted') {
      setRoom(result.room)
      setEventRecords((records) => appendAcceptedEngineEvents(records, result))
    }
  }

  function submitAvailableAction(action: MatchClientActionView) {
    const localAction = availableActionsProjection.actions.find(
      (candidate): candidate is LocalAvailableActionIntent =>
        candidate.id === action.id,
    )
    const submission = localAction?.createSubmission(nextActionId(action.id))

    if (submission === undefined || submission === null) {
      return
    }

    submitCommand(submission)
  }

  function submitChoiceResponse(submission: ProjectedMatchChoiceSubmission) {
    submitCommand({
      source: {
        kind: 'participant',
        participantId:
          submission.response.responderPlayerId === LOCAL_MATCH_PLAYER_TWO_ID
            ? LOCAL_MATCH_PARTICIPANT_TWO_ID
            : LOCAL_MATCH_PARTICIPANT_ONE_ID,
      },
      command: {
        kind: 'choice_response',
        submission: {
          expectedRevision: room.engineState.revision,
          response: submission.response,
        },
      },
    })
  }

  function resetRoom() {
    actionSequenceRef.current = 0
    setRoom(createLocalPrototypeMatchRoom(roomId))
    setLastResult(null)
    setEventRecords([])
  }

  if (!clientRoomResult.ok) {
    return <ProjectionFailurePanel message={clientRoomResult.message} />
  }

  const localEventLogEntries = buildLocalMatchEventLogEntries(eventRecords, {
    resolvePlayerLabel: (playerId) =>
      clientRoomResult.state.playerSummaries.find(
        (player) => player.playerId === playerId,
      )?.label ?? playerId,
  })
  const localClientRoom = {
    ...clientRoomResult.state,
    eventLogEntries: localEventLogEntries,
  }

  return (
    <ProjectedMatchRoomView
      room={localClientRoom}
      actions={availableActionsProjection}
      feedback={buildCommandFeedback(lastResult, localClientRoom)}
      resetLabel="Reset local room"
      onResetRoom={resetRoom}
      onSubmitAction={submitAvailableAction}
      onSubmitChoiceResponse={submitChoiceResponse}
    />
  )
}

function ProjectionFailurePanel({ message }: { readonly message: string }) {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Match projection unavailable</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}

function buildCommandFeedback(
  result: MatchRoomCommandResult | null,
  clientRoom: { readonly engineRevision: number },
): ProjectedMatchCommandFeedback | null {
  if (result === null) {
    return null
  }

  if (result.status === 'accepted') {
    return {
      status: 'accepted',
      transitionId: result.engineResult.transitionId,
      engineRevision: clientRoom.engineRevision,
      eventTypes: result.engineResult.events.map((event) => event.type),
    }
  }

  if (result.status === 'blocked') {
    return {
      status: 'blocked',
      code: result.code,
      message: result.message,
      blockingRequestIds: result.blockingRequests.map(
        (request) => request.requestId,
      ),
    }
  }

  return {
    status: 'invalid',
    code: result.code,
    message: result.message,
  }
}
