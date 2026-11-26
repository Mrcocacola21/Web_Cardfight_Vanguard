import type {
  ActionId,
  EffectDefinitionId,
  EngineCommand,
  GameState,
  PieceId,
  PlayerGameAction,
  PlayerId,
  ZoneSlotId,
  ZoneState,
} from '@web-vg/rules-core'

import type { MatchRoomEngineAdapter } from './match-room'

export type ParticipantLegalActionKind =
  | 'ride'
  | 'call'
  | 'play'
  | 'activate'
  | 'attack'
  | 'boost'
  | 'guard_step'
  | 'end_phase'

/**
 * One action the viewer can take right now, already checked by the engine.
 * `command` is submitted as-is; it only names the viewer's own cards and
 * public board cards, so it reveals nothing the viewer cannot already see.
 */
export interface ParticipantLegalAction {
  readonly id: string
  readonly kind: ParticipantLegalActionKind
  readonly label: string
  readonly pieceId?: PieceId
  readonly targetPieceId?: PieceId
  readonly slotId?: ZoneSlotId
  readonly effectDefinitionId?: EffectDefinitionId
  readonly command: EngineCommand
}

interface Candidate {
  readonly id: string
  readonly kind: ParticipantLegalActionKind
  readonly label: string
  readonly pieceId?: PieceId
  readonly targetPieceId?: PieceId
  readonly slotId?: ZoneSlotId
  readonly effectDefinitionId?: EffectDefinitionId
  readonly action: PlayerGameAction
}

/** Safety cap so a pathological board cannot make projections slow. */
const MAX_CANDIDATES = 200

/**
 * Lists the viewer's legal player actions by building every plausible
 * command from the canonical state and keeping the ones the engine accepts.
 * The engine stays the only judge of legality; this never re-implements
 * rules. Returns [] while a choice request or a battle step is pending for
 * someone else.
 */
export function listParticipantLegalActions(
  state: GameState,
  playerId: PlayerId,
  adapter: MatchRoomEngineAdapter,
): readonly ParticipantLegalAction[] {
  if (state.status !== 'in_progress' || state.pendingRequests.length > 0) {
    return []
  }

  return buildCandidates(state, playerId)
    .slice(0, MAX_CANDIDATES)
    .flatMap((candidate) => {
      const command: EngineCommand = {
        kind: 'action',
        submission: {
          expectedRevision: state.revision,
          action: candidate.action,
        },
      }
      const result = adapter.dispatch(state, command)

      if (result.status !== 'accepted') {
        return []
      }

      const { action: _action, ...rest } = candidate
      return [{ ...rest, command }]
    })
}

function buildCandidates(
  state: GameState,
  playerId: PlayerId,
): readonly Candidate[] {
  const opponentId = state.players.find(
    (player) => player.playerId !== playerId,
  )?.playerId
  const own = (kind: string) => ownedZones(state, playerId, kind)
  const actor = { kind: 'player' as const, playerId }
  const actionId = (id: string) => `legal:${id}:r${state.revision}` as ActionId
  const candidates: Candidate[] = []
  const battle = state.battle

  if (battle !== undefined) {
    // During a battle only boost (attacker) and opening guard (defender).
    if (
      battle.attackingPlayerId === playerId &&
      battle.status === 'attack_declared'
    ) {
      for (const booster of occupants(own('rear_guard_circle'))) {
        candidates.push({
          id: `boost:${booster.pieceId}`,
          kind: 'boost',
          label: `Boost with ${cardName(state, booster.pieceId)}`,
          pieceId: booster.pieceId,
          action: {
            actionId: actionId(`boost:${booster.pieceId}`),
            type: 'battle.commit_boost',
            actor,
            attackerPieceId: battle.attackerPieceId,
            boosterPieceId: booster.pieceId,
          },
        })
      }
    }

    if (
      battle.defendingPlayerId === playerId &&
      (battle.status === 'attack_declared' ||
        battle.status === 'boost_declared')
    ) {
      candidates.push({
        id: 'guard-step',
        kind: 'guard_step',
        label: 'Guard step',
        action: {
          actionId: actionId('guard-step'),
          type: 'battle.guard',
          actor,
          againstAttackerPieceId: battle.attackerPieceId,
        },
      })
    }

    return candidates
  }

  if (state.turn.turnPlayerId !== playerId) {
    return candidates
  }

  const vanguard = own('vanguard_circle')[0]
  const rearGuard = own('rear_guard_circle')[0]
  const orderZone = own('order_zone')[0]

  if (vanguard !== undefined) {
    for (const zone of [...own('ride_deck'), ...own('hand')]) {
      for (const { pieceId } of zone.occupants) {
        candidates.push({
          id: `ride:${pieceId}`,
          kind: 'ride',
          label: `Ride ${cardName(state, pieceId)}`,
          pieceId,
          action: {
            actionId: actionId(`ride:${pieceId}`),
            type: 'card.ride',
            actor,
            pieceId,
            from: { zoneId: zone.zoneId },
            to: { zoneId: vanguard.zoneId },
          },
        })
      }
    }
  }

  for (const zone of own('hand')) {
    for (const { pieceId } of zone.occupants) {
      for (const slotId of rearGuard === undefined
        ? []
        : openSlots(rearGuard)) {
        candidates.push({
          id: `call:${pieceId}:${slotId}`,
          kind: 'call',
          label: `Call ${cardName(state, pieceId)} to ${formatSlot(slotId)}`,
          pieceId,
          slotId,
          action: {
            actionId: actionId(`call:${pieceId}:${slotId}`),
            type: 'card.call',
            actor,
            pieceId,
            from: { zoneId: zone.zoneId },
            to: { zoneId: rearGuard!.zoneId, slotId },
          },
        })
      }

      if (orderZone !== undefined) {
        candidates.push({
          id: `play:${pieceId}`,
          kind: 'play',
          label: `Play ${cardName(state, pieceId)}`,
          pieceId,
          action: {
            actionId: actionId(`play:${pieceId}`),
            type: 'card.play',
            actor,
            pieceId,
            from: { zoneId: zone.zoneId },
            to: { zoneId: orderZone.zoneId },
          },
        })
      }
    }
  }

  const hiddenZoneIds = new Set(
    [...own('deck'), ...own('ride_deck')].flatMap((zone) =>
      zone.occupants.map((occupant) => occupant.pieceId),
    ),
  )

  for (const piece of state.pieces) {
    if (
      (piece.controllerPlayerId ?? piece.ownerPlayerId) !== playerId ||
      // Cards still in the deck cannot use abilities.
      hiddenZoneIds.has(piece.pieceId)
    ) {
      continue
    }

    for (const effectDefinitionId of piece.effectDefinitionIds ?? []) {
      candidates.push({
        id: `activate:${piece.pieceId}:${effectDefinitionId}`,
        kind: 'activate',
        label: `Activate ${cardName(state, piece.pieceId)}`,
        pieceId: piece.pieceId,
        effectDefinitionId,
        action: {
          actionId: actionId(`activate:${piece.pieceId}`),
          type: 'card.activate_effect',
          actor,
          sourcePieceId: piece.pieceId,
          effectDefinitionId,
        },
      })
    }
  }

  const attackers = [
    ...occupants(own('vanguard_circle')),
    ...occupants(own('rear_guard_circle')),
  ]
  const targets =
    opponentId === undefined
      ? []
      : [
          ...occupants(ownedZones(state, opponentId, 'vanguard_circle')),
          ...occupants(ownedZones(state, opponentId, 'rear_guard_circle')),
        ]

  for (const attacker of attackers) {
    for (const target of targets) {
      candidates.push({
        id: `attack:${attacker.pieceId}:${target.pieceId}`,
        kind: 'attack',
        label: `Attack ${cardName(state, target.pieceId)} with ${cardName(state, attacker.pieceId)}`,
        pieceId: attacker.pieceId,
        targetPieceId: target.pieceId,
        action: {
          actionId: actionId(`attack:${attacker.pieceId}:${target.pieceId}`),
          type: 'battle.declare_attack',
          actor,
          attackerPieceId: attacker.pieceId,
          target: { kind: 'piece', pieceId: target.pieceId },
        },
      })
    }
  }

  candidates.push({
    id: 'end-phase',
    kind: 'end_phase',
    label: `End ${state.turn.phase} phase`,
    action: {
      actionId: actionId('end-phase'),
      type: 'turn.end_phase',
      actor,
    },
  })

  // Essentials first, so the candidate cap can never hide them.
  return [...candidates].sort(
    (left, right) => KIND_PRIORITY[left.kind] - KIND_PRIORITY[right.kind],
  )
}

const KIND_PRIORITY: Readonly<Record<ParticipantLegalActionKind, number>> = {
  guard_step: 0,
  boost: 1,
  end_phase: 2,
  attack: 3,
  ride: 4,
  call: 5,
  play: 6,
  activate: 7,
}

function ownedZones(
  state: GameState,
  playerId: PlayerId,
  kind: string,
): readonly ZoneState[] {
  return state.zones.filter(
    (zone) => zone.ownerPlayerId === playerId && zone.kind === kind,
  )
}

function occupants(
  zones: readonly ZoneState[],
): readonly ZoneState['occupants'][number][] {
  return zones.flatMap((zone) => zone.occupants)
}

function openSlots(zone: ZoneState): readonly ZoneSlotId[] {
  const used = new Set(zone.occupants.map((occupant) => occupant.slotId))
  return (zone.layout.slotIds ?? []).filter((slotId) => !used.has(slotId))
}

function cardName(state: GameState, pieceId: PieceId): string {
  const cardId = state.pieces.find(
    (piece) => piece.pieceId === pieceId,
  )?.cardDefinitionId
  const stats = state.cardStats?.cards.find(
    (card) => card.cardDefinitionId === cardId,
  )

  return stats?.name ?? cardId ?? pieceId
}

function formatSlot(slotId: string): string {
  const match = /(front|back)[-_ ]?(left|center|right)/i.exec(slotId)
  return match === null
    ? slotId
    : `${match[1]!.toLowerCase()} ${match[2]!.toLowerCase()}`
}
