import type { GameEvent, PlayerId } from '@web-vg/rules-core'
import type { AcceptedMatchRoomCommandResult } from '@web-vg/match-session'

export type LocalMatchEventLogCategory =
  | 'match'
  | 'turn'
  | 'mulligan'
  | 'choice'
  | 'card'
  | 'piece'
  | 'zone'
  | 'battle'
  | 'resource'
  | 'effect'
  | 'trigger'
  | 'other'

export interface LocalMatchEventRecord {
  readonly recordId: string
  readonly ordinal: number
  readonly roomRevision: number
  readonly engineRevision: number
  readonly transitionId: string
  readonly event: GameEvent
}

export interface LocalMatchEventLogEntry {
  readonly recordId: string
  readonly ordinal: number
  readonly roomRevision: number
  readonly engineRevision: number
  readonly transitionId: string
  readonly eventId: string
  readonly sequence: number
  readonly type: GameEvent['type']
  readonly category: LocalMatchEventLogCategory
  readonly source: string
  readonly summary: string
  readonly details: readonly LocalMatchEventLogDetail[]
}

export interface LocalMatchEventLogDetail {
  readonly label: string
  readonly value: string
}

export interface BuildLocalMatchEventLogOptions {
  readonly resolvePlayerLabel?: (playerId: PlayerId) => string
}

export function appendAcceptedEngineEvents(
  records: readonly LocalMatchEventRecord[],
  result: AcceptedMatchRoomCommandResult,
): readonly LocalMatchEventRecord[] {
  if (result.engineResult.events.length === 0) {
    return records
  }

  const appendedRecords = result.engineResult.events.map((event, index) => ({
    recordId: `${result.engineResult.transitionId}:${event.eventId}`,
    ordinal: records.length + index + 1,
    roomRevision: result.room.revision,
    engineRevision: result.room.engineState.revision,
    transitionId: result.engineResult.transitionId,
    event,
  }))

  return [...records, ...appendedRecords]
}

export function buildLocalMatchEventLogEntries(
  records: readonly LocalMatchEventRecord[],
  options: BuildLocalMatchEventLogOptions = {},
): readonly LocalMatchEventLogEntry[] {
  return records.map((record) => {
    const category = getEventCategory(record.event)

    return {
      recordId: record.recordId,
      ordinal: record.ordinal,
      roomRevision: record.roomRevision,
      engineRevision: record.engineRevision,
      transitionId: record.transitionId,
      eventId: record.event.eventId,
      sequence: record.event.sequence,
      type: record.event.type,
      category,
      source: formatEventOrigin(record.event, options),
      summary: formatEventSummary(record.event, options),
      details: buildEventDetails(record.event),
    }
  })
}

function getEventCategory(event: GameEvent): LocalMatchEventLogCategory {
  if (event.type.startsWith('match.')) {
    return 'match'
  }
  if (event.type.startsWith('turn.')) {
    return 'turn'
  }
  if (event.type.startsWith('mulligan.')) {
    return 'mulligan'
  }
  if (event.type.startsWith('choice.')) {
    return 'choice'
  }
  if (event.type.startsWith('card') || event.type.startsWith('cards.')) {
    return 'card'
  }
  if (event.type.startsWith('piece.')) {
    return 'piece'
  }
  if (event.type.startsWith('zone.')) {
    return 'zone'
  }
  if (event.type.startsWith('battle.')) {
    return 'battle'
  }
  if (event.type.startsWith('resource.')) {
    return 'resource'
  }
  if (event.type.startsWith('effect.')) {
    return 'effect'
  }
  if (event.type.startsWith('trigger.')) {
    return 'trigger'
  }
  if (event.type.startsWith('player.')) {
    return 'resource'
  }

  return 'other'
}

function formatEventSummary(
  event: GameEvent,
  options: BuildLocalMatchEventLogOptions,
): string {
  switch (event.type) {
    case 'match.started':
      return `Match started. Starting player: ${formatPlayer(event.startingPlayerId, options)}.`
    case 'match.ended':
      return `Match ended by ${event.reason}${event.winnerPlayerId ? `; winner: ${formatPlayer(event.winnerPlayerId, options)}` : ''}.`
    case 'turn.started':
      return `Turn ${event.turnNumber} started for ${formatPlayer(event.turnPlayerId, options)}.`
    case 'turn.ended':
      return `Turn ${event.turnNumber} ended for ${formatPlayer(event.turnPlayerId, options)}.`
    case 'turn.cleanup_applied':
      return `Turn cleanup cleared ${event.cleanedPieceIds.length} piece states.`
    case 'turn.phase_advanced':
      return `Phase advanced from ${event.previousPhase ?? 'none'} to ${event.nextPhase}.`
    case 'turn.step_advanced':
      return `Step advanced in ${event.phase} to ${event.nextStep}.`
    case 'mulligan.started':
      return `${formatPlayer(event.playerId, options)} started mulligan.`
    case 'mulligan.completed':
      return `${formatPlayer(event.playerId, options)} completed mulligan.`
    case 'choice.response_resolved':
      return `${formatPlayer(event.responderPlayerId, options)} resolved ${event.requestType} with ${event.responseType}.`
    case 'piece.moved':
      return `${event.pieceId} moved from ${formatLocation(event.from)} to ${formatLocation(event.to)}.`
    case 'piece.rested':
      return `${event.pieceId} rested.`
    case 'piece.stood':
      return `${event.pieceId} stood.`
    case 'piece.locked':
      return `${event.pieceId} locked.`
    case 'piece.unlocked':
      return `${event.pieceId} unlocked.`
    case 'zone.shuffled':
      return `${event.zoneId} shuffled ${event.orderedPieceIds.length} cards.`
    case 'cards.drawn':
      return `${formatPlayer(event.playerId, options)} drew ${event.pieceIds.length} cards.`
    case 'card.played':
      return `${event.pieceId} was played.`
    case 'card.rode':
      return `${event.pieceId} rode onto the vanguard circle.`
    case 'card.called':
      return `${event.pieceId} was called to rear-guard.`
    case 'battle.attack_declared':
      return `${event.attackerPieceId} declared an attack.`
    case 'battle.boost_declared':
      return `${event.boosterPieceId} boosted ${event.attackerPieceId}.`
    case 'battle.guard_requested':
      return `Guard requested from ${formatPlayer(event.defendingPlayerId, options)}.`
    case 'battle.guard_declared':
      return `${event.guardianPieceIds.length} guardians declared.`
    case 'battle.intercept_declared':
      return `${event.interceptPieceIds.length} interceptors declared.`
    case 'battle.guard_passed':
      return `Guard passed against ${event.attackerPieceId}.`
    case 'battle.drive_checked':
      return `${formatPlayer(event.playerId, options)} performed a drive check.`
    case 'battle.combat_resolved':
      return `Combat resolved as ${event.combat.result}: ${event.combat.attackPower} vs ${event.combat.totalDefensePower}.`
    case 'battle.attack_hit':
      return `${event.attackerPieceId} hit its target.`
    case 'battle.attack_missed':
      return `${event.attackerPieceId} missed its target.`
    case 'battle.damage_checked':
      return `${formatPlayer(event.playerId, options)} performed a damage check (${event.damage.damageBefore} to ${event.damage.damageAfter}).`
    case 'battle.guardians_cleaned_up':
      return `${event.guardPieceIds.length} guardians cleaned up.`
    case 'battle.completed':
      return `Battle ${event.battleId} completed by ${event.reason}.`
    case 'player.counter_changed':
      return `${formatPlayer(event.playerId, options)} ${event.counterKey} changed from ${event.previousAmount} to ${event.nextAmount}.`
    case 'player.flag_changed':
      return `${formatPlayer(event.playerId, options)} flag ${event.flagKey} changed.`
    case 'player.damage_changed':
      return `${formatPlayer(event.playerId, options)} damage changed from ${event.previousDamage} to ${event.nextDamage}.`
    case 'player.defeated':
      return `${formatPlayer(event.playerId, options)} was defeated by ${event.reason}.`
    case 'resource.counter_blasted':
      return `${formatPlayer(event.playerId, options)} counter blasted ${event.count}.`
    case 'resource.counter_charged':
      return `${formatPlayer(event.playerId, options)} counter charged ${event.count}.`
    case 'resource.soul_blasted':
      return `${formatPlayer(event.playerId, options)} soul blasted ${event.count}.`
    case 'resource.soul_charged':
      return `${formatPlayer(event.playerId, options)} soul charged ${event.count}.`
    case 'effect.resolved':
      return `Effect ${event.effectDefinitionId} resolved.`
    case 'trigger.revealed':
      return `${formatPlayer(event.playerId, options)} revealed a ${event.triggerType} trigger.`
    case 'trigger.resolved':
      return `${event.triggerType} trigger resolved with ${event.outcome}.`
  }
}

function buildEventDetails(
  event: GameEvent,
): readonly LocalMatchEventLogDetail[] {
  const baseDetails: LocalMatchEventLogDetail[] = [
    { label: 'Event id', value: event.eventId },
    { label: 'Sequence', value: event.sequence.toString() },
  ]

  if (event.sourceActionId !== undefined) {
    baseDetails.push({ label: 'Action', value: event.sourceActionId })
  }

  switch (event.type) {
    case 'piece.moved':
      return [
        ...baseDetails,
        { label: 'Reason', value: event.reason },
        { label: 'From', value: formatLocation(event.from) },
        { label: 'To', value: formatLocation(event.to) },
      ]
    case 'mulligan.started':
      return [
        ...baseDetails,
        { label: 'Request', value: event.requestId },
        { label: 'Hand', value: event.handZoneId },
        { label: 'Deck', value: event.deckZoneId },
      ]
    case 'mulligan.completed':
      return [
        ...baseDetails,
        { label: 'Request', value: event.requestId },
        { label: 'Returned', value: event.returnedPieceIds.length.toString() },
        { label: 'Drawn', value: event.drawnPieceIds.length.toString() },
      ]
    case 'choice.response_resolved':
      return [
        ...baseDetails,
        { label: 'Request', value: event.requestId },
        { label: 'Outcome', value: event.outcome },
        { label: 'Visibility', value: event.visibility },
      ]
    case 'card.rode':
    case 'card.called':
    case 'card.played':
      return [
        ...baseDetails,
        { label: 'Piece', value: event.pieceId },
        { label: 'From', value: formatLocation(event.from) },
        { label: 'To', value: formatLocation(event.to) },
      ]
    case 'cards.drawn':
      return [
        ...baseDetails,
        { label: 'From', value: event.fromZoneId },
        { label: 'To', value: event.toZoneId },
        { label: 'Cards', value: event.pieceIds.length.toString() },
      ]
    case 'battle.attack_declared':
      return [
        ...baseDetails,
        { label: 'Battle', value: event.battleId },
        { label: 'Attacker', value: event.attackerPieceId },
        { label: 'Target', value: formatTarget(event.target) },
      ]
    case 'battle.combat_resolved':
      return [
        ...baseDetails,
        { label: 'Battle', value: event.battleId },
        { label: 'Result', value: event.combat.result },
        { label: 'Attack', value: event.combat.attackPower.toString() },
        {
          label: 'Defense',
          value: event.combat.totalDefensePower.toString(),
        },
      ]
    case 'battle.attack_hit':
    case 'battle.attack_missed':
      return [
        ...baseDetails,
        { label: 'Battle', value: event.battleId },
        { label: 'Attacker', value: event.attackerPieceId },
        { label: 'Attack', value: event.attackPower.toString() },
        { label: 'Defense', value: event.totalDefensePower.toString() },
      ]
    case 'battle.damage_checked':
      return [
        ...baseDetails,
        { label: 'Battle', value: event.battleId },
        { label: 'Player', value: event.playerId },
        { label: 'Damage', value: event.damage.damageAfter.toString() },
        { label: 'Outcome', value: event.damage.outcome },
      ]
    case 'battle.guardians_cleaned_up':
      return [
        ...baseDetails,
        { label: 'Battle', value: event.battleId },
        { label: 'Guardians', value: event.guardPieceIds.length.toString() },
        { label: 'From', value: event.fromZoneId },
        { label: 'To', value: event.toZoneId },
      ]
    case 'player.damage_changed':
      return [
        ...baseDetails,
        { label: 'Player', value: event.playerId },
        { label: 'Previous', value: event.previousDamage.toString() },
        { label: 'Next', value: event.nextDamage.toString() },
        { label: 'Outcome', value: event.outcome },
      ]
    case 'player.defeated':
      return [
        ...baseDetails,
        { label: 'Player', value: event.playerId },
        { label: 'Reason', value: event.reason },
        {
          label: 'Damage',
          value: event.damageCount?.toString() ?? 'unknown',
        },
      ]
    case 'effect.resolved':
      return [
        ...baseDetails,
        { label: 'Effect', value: event.effectDefinitionId },
        {
          label: 'Operations',
          value: event.operationKinds.join(', ') || 'none',
        },
      ]
    case 'trigger.revealed':
      return [
        ...baseDetails,
        { label: 'Battle', value: event.battleId },
        { label: 'Check', value: event.checkKind },
        { label: 'Piece', value: event.revealedPieceId },
        { label: 'Trigger', value: event.triggerType },
      ]
    case 'trigger.resolved':
      return [
        ...baseDetails,
        { label: 'Battle', value: event.battleId },
        { label: 'Check', value: event.checkKind },
        { label: 'Piece', value: event.revealedPieceId },
        { label: 'Trigger', value: event.triggerType },
        { label: 'Outcome', value: event.outcome },
      ]
    default:
      return baseDetails
  }
}

function formatEventOrigin(
  event: GameEvent,
  options: BuildLocalMatchEventLogOptions,
): string {
  return event.origin.kind === 'player'
    ? formatPlayer(event.origin.playerId, options)
    : event.origin.system
}

function formatPlayer(
  playerId: PlayerId,
  options: BuildLocalMatchEventLogOptions,
): string {
  return options.resolvePlayerLabel?.(playerId) ?? playerId
}

function formatLocation(location: {
  readonly zoneId: string
  readonly slotId?: string
  readonly position?: number
}) {
  const slot = location.slotId ? `:${location.slotId}` : ''
  const position =
    location.position === undefined ? '' : `#${location.position}`

  return `${location.zoneId}${slot}${position}`
}

function formatTarget(target: {
  readonly kind: string
  readonly playerId?: string
  readonly pieceId?: string
}) {
  if (target.kind === 'player') {
    return target.playerId ?? 'unknown player'
  }

  return target.pieceId ?? 'unknown piece'
}
