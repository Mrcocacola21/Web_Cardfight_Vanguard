import { randomUUID } from 'node:crypto'

import type { MatchRoomId, MatchRoomParticipantId } from '@web-vg/match-session'
import type { ActionId, PlayerId } from '@web-vg/rules-core'

import type { DeckToMatchRoomIdFactory } from '@/features/matches/application/deck-to-match-room-use-cases'

/**
 * Room and participant ids for persisted match rooms. Lives outside the
 * 'use server' action files: those may only export async functions, and
 * exporting this object there breaks every action in the file at runtime.
 */
export const cryptoRoomIdFactory: DeckToMatchRoomIdFactory = {
  createRoomId() {
    return randomUUID() as MatchRoomId
  },
  createParticipantId(input) {
    return `${input.roomId}:participant:${input.seat + 1}` as MatchRoomParticipantId
  },
  createPlayerId(input) {
    return `${input.roomId}:player:${input.seat + 1}` as PlayerId
  },
  createActionId(input) {
    return `${input.roomId}:action:${input.label}:${input.revision}` as ActionId
  },
}
