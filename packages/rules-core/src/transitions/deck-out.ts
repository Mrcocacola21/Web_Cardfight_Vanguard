import type {
  ActionId,
  EventId,
  PlayerId,
  TransitionId,
  ZoneId,
} from '../contracts'
import type { GameEvent, SystemEventSource } from '../events'
import type { GameState, ZoneState } from '../state'
import type { ZoneTransferReason } from '../transfers'

import { resolveBattleCleanup } from './battle-completion'
import { createPieceMovedEvents } from './zone-transfer'

const AUTOMATIC_FLOW_SYSTEM = 'automatic-flow' as const

export type DeckOutLossResult =
  | {
      readonly ok: true
      readonly state: GameState
      readonly events: readonly GameEvent[]
    }
  | {
      readonly ok: false
      readonly code: 'invalid_action' | 'invalid_action_reference'
      readonly message: string
    }

export interface DeckOutLossInput {
  readonly transitionId: TransitionId
  readonly currentState: GameState
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly requiredCount: number
  readonly availableCount: number
  readonly reason: ZoneTransferReason
  readonly sourceActionId?: ActionId
  readonly system?: SystemEventSource
  readonly startingSequence?: number
}

export function shouldResolveDeckOutLoss(
  sourceZone: ZoneState,
  requiredCount: number,
): boolean {
  return (
    sourceZone.kind === 'deck' &&
    sourceZone.layout.ordering === 'ordered' &&
    sourceZone.layout.occupancy === 'multi' &&
    Number.isSafeInteger(requiredCount) &&
    requiredCount > 0 &&
    sourceZone.occupants.length < requiredCount
  )
}

export function resolveDeckOutLoss(input: DeckOutLossInput): DeckOutLossResult {
  const battle = input.currentState.battle
  const cleanupResult =
    battle === undefined
      ? {
          ok: true as const,
          zones: input.currentState.zones,
          pieceStates: input.currentState.pieceStates,
          movedPieces: [],
        }
      : resolveBattleCleanup(input.currentState, battle)

  if (!cleanupResult.ok) {
    return cleanupResult
  }

  const stateAfterCleanup: GameState = {
    ...input.currentState,
    zones: cleanupResult.zones,
    pieceStates: cleanupResult.pieceStates,
  }
  const { battle: _completedBattle, ...stateWithoutBattle } = stateAfterCleanup
  const winner = stateWithoutBattle.players.find(
    (player) =>
      player.playerId !== input.playerId && player.status !== 'defeated',
  )
  const terminalState: GameState = {
    ...stateWithoutBattle,
    status: 'completed',
    pendingRequests: [],
    players: stateWithoutBattle.players.map((player) =>
      player.playerId === input.playerId
        ? {
            ...player,
            status: 'defeated',
          }
        : player,
    ),
  }
  const system = input.system ?? AUTOMATIC_FLOW_SYSTEM
  const origin = {
    kind: 'system' as const,
    system,
  }
  const events: GameEvent[] = []
  const startingSequence = input.startingSequence ?? 0

  events.push({
    eventId: createEventId(input.transitionId, startingSequence),
    type: 'cards.deck_out',
    sequence: startingSequence,
    ...(input.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: input.sourceActionId,
        }),
    origin,
    playerId: input.playerId,
    fromZoneId: input.fromZoneId,
    requiredCount: input.requiredCount,
    availableCount: input.availableCount,
    reason: input.reason,
    ...(battle === undefined ? {} : { battleId: battle.battleId }),
  })

  let nextSequence = startingSequence + events.length
  const cleanupMovedEvents = createPieceMovedEvents(
    input.transitionId,
    cleanupResult.movedPieces,
    origin,
    {
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      startingSequence: nextSequence,
    },
  )
  events.push(...cleanupMovedEvents)
  nextSequence += cleanupMovedEvents.length

  if (
    battle !== undefined &&
    cleanupResult.cleanupFromZoneId !== undefined &&
    cleanupResult.cleanupToZoneId !== undefined &&
    cleanupResult.movedPieces.length > 0
  ) {
    events.push({
      eventId: createEventId(input.transitionId, nextSequence),
      type: 'battle.guardians_cleaned_up',
      sequence: nextSequence,
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      origin,
      battleId: battle.battleId,
      defendingPlayerId: battle.defendingPlayerId,
      guardPieceIds: cleanupResult.movedPieces.map(
        (movement) => movement.pieceId,
      ),
      fromZoneId: cleanupResult.cleanupFromZoneId,
      toZoneId: cleanupResult.cleanupToZoneId,
    })
    nextSequence += 1
  }

  if (battle !== undefined) {
    events.push({
      eventId: createEventId(input.transitionId, nextSequence),
      type: 'battle.completed',
      sequence: nextSequence,
      ...(input.sourceActionId === undefined
        ? {}
        : {
            sourceActionId: input.sourceActionId,
          }),
      origin,
      battleId: battle.battleId,
      reason: 'deck_out',
      attackingPlayerId: battle.attackingPlayerId,
      defendingPlayerId: battle.defendingPlayerId,
      attackerPieceId: battle.attackerPieceId,
      attackerZoneId: battle.attackerZoneId,
      target: battle.target,
      ...(battle.boostingPieceId === undefined
        ? {}
        : {
            boostingPieceId: battle.boostingPieceId,
          }),
      ...(battle.boostingZoneId === undefined
        ? {}
        : {
            boostingZoneId: battle.boostingZoneId,
          }),
      guardPieceIds: battle.guardPieceIds,
      ...(battle.guardZoneId === undefined
        ? {}
        : {
            guardZoneId: battle.guardZoneId,
          }),
      ...(battle.lastCheck === undefined
        ? {}
        : {
            lastCheck: battle.lastCheck,
          }),
      ...(battle.combat === undefined
        ? {}
        : {
            combat: battle.combat,
          }),
      ...(battle.damage === undefined
        ? {}
        : {
            damage: battle.damage,
          }),
      cleanupMovedPieceIds: cleanupResult.movedPieces.map(
        (movement) => movement.pieceId,
      ),
      ...(cleanupResult.cleanupFromZoneId === undefined
        ? {}
        : {
            cleanupFromZoneId: cleanupResult.cleanupFromZoneId,
          }),
      ...(cleanupResult.cleanupToZoneId === undefined
        ? {}
        : {
            cleanupToZoneId: cleanupResult.cleanupToZoneId,
          }),
    })
    nextSequence += 1
  }

  events.push({
    eventId: createEventId(input.transitionId, nextSequence),
    type: 'player.defeated',
    sequence: nextSequence,
    ...(input.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: input.sourceActionId,
        }),
    origin,
    playerId: input.playerId,
    reason: 'deck_out',
  })
  nextSequence += 1

  events.push({
    eventId: createEventId(input.transitionId, nextSequence),
    type: 'match.ended',
    sequence: nextSequence,
    ...(input.sourceActionId === undefined
      ? {}
      : {
          sourceActionId: input.sourceActionId,
        }),
    origin,
    reason: 'deck_out',
    loserPlayerId: input.playerId,
    ...(winner === undefined
      ? {}
      : {
          winnerPlayerId: winner.playerId,
        }),
  })

  return {
    ok: true,
    state: terminalState,
    events,
  }
}

function createEventId(transitionId: TransitionId, sequence: number): EventId {
  return `${transitionId}:event:${sequence}` as EventId
}
