import { assertRulesInvariant } from '../errors'
import {
  assertEngineCardStatsSnapshotInvariant,
  resolveEngineCardStats,
} from '../cards'
import type { GameChoiceRequest, ZoneChoiceOption } from '../requests'
import { assertGameChoiceRequestInvariant } from '../requests'
import type { TargetReference } from '../references'

import type {
  BattleCheckState,
  BattleState,
  GamePieceStatusState,
  GameState,
  PlayerState,
  ZoneLayoutState,
  ZoneState,
} from './state'

function assertSafeInteger(
  value: number,
  message: string,
  options: { readonly nonNegative?: boolean } = {},
): void {
  assertRulesInvariant(Number.isSafeInteger(value), message)

  if (options.nonNegative === true) {
    assertRulesInvariant(value >= 0, message)
  }
}

function assertUniqueValues(values: readonly string[], message: string): void {
  assertRulesInvariant(new Set(values).size === values.length, message)
}

function assertZoneLayoutInvariant(layout: ZoneLayoutState): void {
  if (layout.capacity !== undefined) {
    assertSafeInteger(
      layout.capacity,
      'Zone capacity must be a non-negative safe integer.',
      {
        nonNegative: true,
      },
    )
  }

  const slotIds = layout.slotIds?.map((slotId) => slotId as string) ?? []

  if (layout.occupancy === 'single') {
    assertRulesInvariant(
      layout.slotIds === undefined,
      'Single-occupancy zones must not define explicit slot ids.',
    )
    if (layout.capacity !== undefined) {
      assertRulesInvariant(
        layout.capacity === 1,
        'Single-occupancy zones must have capacity 1 when capacity is declared.',
      )
    }
    return
  }

  if (layout.occupancy === 'multi') {
    assertRulesInvariant(
      layout.slotIds === undefined,
      'Multi-occupancy zones must not define explicit slot ids.',
    )
    return
  }

  assertRulesInvariant(
    layout.slotIds !== undefined && layout.slotIds.length > 0,
    'Slotted zones must declare at least one slot id.',
  )
  assertUniqueValues(
    slotIds,
    'Slotted zones must not declare duplicate slot ids.',
  )

  if (layout.capacity !== undefined) {
    assertRulesInvariant(
      layout.capacity === layout.slotIds.length,
      'Slotted zone capacity must match the declared slot count.',
    )
  }
}

export function assertPlayerStateInvariant(player: PlayerState): void {
  assertSafeInteger(
    player.seat,
    'Player seats must be non-negative safe integers.',
    {
      nonNegative: true,
    },
  )
  assertUniqueValues(
    player.ownedZoneIds.map((zoneId) => zoneId as string),
    `Player ${player.playerId} must not reference duplicate owned zones.`,
  )
  assertUniqueValues(
    player.counters.map((counter) => counter.key),
    `Player ${player.playerId} must not declare duplicate counter keys.`,
  )
  assertUniqueValues(
    player.flags.map((flag) => flag.key),
    `Player ${player.playerId} must not declare duplicate flag keys.`,
  )

  for (const counter of player.counters) {
    assertSafeInteger(
      counter.amount,
      `Player counter ${counter.key} must be a safe integer.`,
    )
  }
}

export function assertZoneStateInvariant(zone: ZoneState): void {
  assertZoneLayoutInvariant(zone.layout)

  if (zone.scope === 'player') {
    assertRulesInvariant(
      zone.ownerPlayerId !== undefined,
      `Player-scoped zone ${zone.zoneId} must declare an owner player id.`,
    )
  }

  assertUniqueValues(
    zone.occupants.map((occupant) => occupant.pieceId as string),
    `Zone ${zone.zoneId} must not contain the same piece more than once.`,
  )

  const capacity = zone.layout.capacity
  if (capacity !== undefined) {
    assertRulesInvariant(
      zone.occupants.length <= capacity,
      `Zone ${zone.zoneId} exceeds its declared capacity.`,
    )
  }

  assertZoneOccupantLayoutInvariant(zone)
}

function assertZoneOccupantLayoutInvariant(zone: ZoneState): void {
  const occupancy = zone.layout.occupancy

  if (occupancy === 'single') {
    assertRulesInvariant(
      zone.occupants.length <= 1,
      `Single-occupancy zone ${zone.zoneId} cannot hold more than one piece.`,
    )
    for (const occupant of zone.occupants) {
      assertRulesInvariant(
        occupant.slotId === undefined,
        `Single-occupancy zone ${zone.zoneId} must not attach slot ids to occupants.`,
      )
    }
    return
  }

  if (occupancy === 'multi') {
    for (const occupant of zone.occupants) {
      assertRulesInvariant(
        occupant.slotId === undefined,
        `Multi-occupancy zone ${zone.zoneId} must not attach slot ids to occupants.`,
      )
    }
    return
  }

  const slotIds = new Set(
    (zone.layout.slotIds ?? []).map((slotId) => slotId as string),
  )
  const occupiedSlotIds = zone.occupants.map(
    (occupant) => occupant.slotId as string | undefined,
  )

  assertUniqueValues(
    occupiedSlotIds.filter((slotId): slotId is string => slotId !== undefined),
    `Slotted zone ${zone.zoneId} must not assign multiple occupants to the same slot.`,
  )

  for (const occupant of zone.occupants) {
    assertRulesInvariant(
      occupant.slotId !== undefined,
      `Slotted zone ${zone.zoneId} must assign a slot id to every occupant.`,
    )
    assertRulesInvariant(
      slotIds.has(occupant.slotId),
      `Slotted zone ${zone.zoneId} references an unknown slot id.`,
    )
  }
}

export function assertGameStateInvariant(state: GameState): void {
  assertSafeInteger(
    state.revision,
    'Game state revision must be a non-negative safe integer.',
    {
      nonNegative: true,
    },
  )
  assertSafeInteger(
    state.turn.turnNumber,
    'Turn number must be a non-negative safe integer.',
    {
      nonNegative: true,
    },
  )
  assertUniqueValues(
    state.flags.map((flag) => flag.key),
    'Game state must not declare duplicate global flag keys.',
  )

  const playerIds = state.players.map((player) => player.playerId as string)
  const zoneIds = state.zones.map((zone) => zone.zoneId as string)
  const pieceIds = state.pieces.map((piece) => piece.pieceId as string)
  const requestIds = state.pendingRequests.map(
    (request) => request.requestId as string,
  )
  const pieceStatePieceIds = state.pieceStates.map(
    (pieceState) => pieceState.pieceId as string,
  )

  assertUniqueValues(
    playerIds,
    'Game state must not declare duplicate players.',
  )
  assertUniqueValues(
    state.players.map((player) => String(player.seat)),
    'Game state must not declare duplicate player seats.',
  )
  assertUniqueValues(zoneIds, 'Game state must not declare duplicate zones.')
  assertUniqueValues(pieceIds, 'Game state must not declare duplicate pieces.')
  assertUniqueValues(
    pieceStatePieceIds,
    'Game state must not declare duplicate runtime piece state entries.',
  )
  assertUniqueValues(
    requestIds,
    'Game state must not declare duplicate pending request ids.',
  )

  const playerIdSet = new Set(playerIds)
  const zoneIdSet = new Set(zoneIds)
  const pieceIdSet = new Set(pieceIds)

  assertRulesInvariant(
    playerIdSet.has(state.turn.turnPlayerId),
    'Turn player id must reference a player inside the game state.',
  )

  if (state.turn.priorityPlayerId !== undefined) {
    assertRulesInvariant(
      playerIdSet.has(state.turn.priorityPlayerId),
      'Priority player id must reference a player inside the game state.',
    )
  }

  for (const player of state.players) {
    assertPlayerStateInvariant(player)

    for (const ownedZoneId of player.ownedZoneIds) {
      assertRulesInvariant(
        zoneIdSet.has(ownedZoneId),
        `Player ${player.playerId} references an unknown zone ${ownedZoneId}.`,
      )
      const ownedZone = state.zones.find((zone) => zone.zoneId === ownedZoneId)
      assertRulesInvariant(
        ownedZone?.ownerPlayerId === player.playerId,
        `Player ${player.playerId} references zone ${ownedZoneId} without matching ownership.`,
      )
    }
  }

  const playerOwnedZoneIds = new Set(
    state.players.flatMap((player) =>
      player.ownedZoneIds.map((zoneId) => zoneId as string),
    ),
  )

  for (const zone of state.zones) {
    assertZoneStateInvariant(zone)

    if (zone.ownerPlayerId !== undefined) {
      assertRulesInvariant(
        playerIdSet.has(zone.ownerPlayerId),
        `Zone ${zone.zoneId} references an unknown owner player.`,
      )
      assertRulesInvariant(
        playerOwnedZoneIds.has(zone.zoneId),
        `Owned zone ${zone.zoneId} must appear in its owner's zone collection.`,
      )
    }

    for (const occupant of zone.occupants) {
      assertRulesInvariant(
        pieceIdSet.has(occupant.pieceId),
        `Zone ${zone.zoneId} references an unknown piece ${occupant.pieceId}.`,
      )
    }
  }

  const locatedPieceIds = state.zones.flatMap((zone) =>
    zone.occupants.map((occupant) => occupant.pieceId as string),
  )

  assertUniqueValues(
    locatedPieceIds,
    'A piece cannot occupy more than one zone at the same time.',
  )
  assertRulesInvariant(
    locatedPieceIds.length === state.pieces.length,
    'Every piece in game state must appear in exactly one zone.',
  )

  for (const piece of state.pieces) {
    if (piece.ownerPlayerId !== undefined) {
      assertRulesInvariant(
        playerIdSet.has(piece.ownerPlayerId),
        `Piece ${piece.pieceId} references an unknown owner player.`,
      )
    }

    if (piece.controllerPlayerId !== undefined) {
      assertRulesInvariant(
        playerIdSet.has(piece.controllerPlayerId),
        `Piece ${piece.pieceId} references an unknown controller player.`,
      )
    }

    if (piece.kind === 'card') {
      assertRulesInvariant(
        piece.cardDefinitionId !== undefined,
        `Card piece ${piece.pieceId} must reference a canonical card definition id.`,
      )
    }

    if (piece.keywords !== undefined) {
      assertUniqueValues(
        piece.keywords.map((keyword) => keyword as string),
        `Piece ${piece.pieceId} must not repeat gameplay keywords.`,
      )
    }
  }

  if (state.cardStats !== undefined) {
    assertEngineCardStatsSnapshotInvariant(state.cardStats)
    assertCardPiecesHaveStats(state)
  }

  if (state.status === 'completed') {
    assertRulesInvariant(
      state.pendingRequests.length === 0,
      'Completed game states must not keep pending requests.',
    )
    assertRulesInvariant(
      state.battle === undefined,
      'Completed game states must not keep an active battle.',
    )
  }

  for (const pieceState of state.pieceStates) {
    assertGamePieceStatusStateInvariant(pieceState, pieceIdSet)
  }

  for (const request of state.pendingRequests) {
    assertGameChoiceRequestInvariant(request)
    assertRulesInvariant(
      playerIdSet.has(request.responderPlayerId),
      `Pending request ${request.requestId} references an unknown responder player.`,
    )

    if (request.context?.relatedPieceIds !== undefined) {
      for (const pieceId of request.context.relatedPieceIds) {
        assertRulesInvariant(
          pieceIdSet.has(pieceId),
          `Pending request ${request.requestId} references an unknown related piece ${pieceId}.`,
        )
      }
    }

    if (request.context?.relatedZoneIds !== undefined) {
      for (const zoneId of request.context.relatedZoneIds) {
        assertRulesInvariant(
          zoneIdSet.has(zoneId),
          `Pending request ${request.requestId} references an unknown related zone ${zoneId}.`,
        )
      }
    }

    assertRequestStateReferences(request, pieceIdSet, playerIdSet, state.zones)
  }

  if (state.battle !== undefined) {
    assertBattleStateInvariant(state.battle, state)
  }
}

export function assertGameStateCardStatsComplete(state: GameState): void {
  const hasCardPieces = state.pieces.some((piece) => piece.kind === 'card')

  if (!hasCardPieces) {
    if (state.cardStats !== undefined) {
      assertEngineCardStatsSnapshotInvariant(state.cardStats)
    }
    return
  }

  assertRulesInvariant(
    state.cardStats !== undefined,
    `Game state ${state.gameId} with card pieces must include an engine card stats snapshot.`,
  )
  assertEngineCardStatsSnapshotInvariant(state.cardStats)
  assertCardPiecesHaveStats(state)
}

function assertGamePieceStatusStateInvariant(
  pieceState: GamePieceStatusState,
  pieceIdSet: ReadonlySet<string>,
): void {
  assertRulesInvariant(
    pieceIdSet.has(pieceState.pieceId),
    `Runtime piece state ${pieceState.pieceId} must reference an existing game piece.`,
  )
  assertUniqueValues(
    pieceState.flags.map((flag) => flag as string),
    `Runtime piece state ${pieceState.pieceId} must not repeat flag keys.`,
  )
  if (pieceState.powerModifier !== undefined) {
    assertSafeInteger(
      pieceState.powerModifier,
      `Runtime piece state ${pieceState.pieceId} power modifier must be a safe integer.`,
    )
  }
  if (pieceState.criticalModifier !== undefined) {
    assertSafeInteger(
      pieceState.criticalModifier,
      `Runtime piece state ${pieceState.pieceId} critical modifier must be a safe integer.`,
    )
  }
}

function assertCardPiecesHaveStats(state: GameState): void {
  assertRulesInvariant(
    state.cardStats !== undefined,
    `Game state ${state.gameId} with card pieces must include an engine card stats snapshot.`,
  )

  for (const piece of state.pieces) {
    if (piece.kind !== 'card') {
      continue
    }

    assertRulesInvariant(
      piece.cardDefinitionId !== undefined,
      `Card piece ${piece.pieceId} must reference a canonical card definition id before card stats can be resolved.`,
    )
    assertRulesInvariant(
      resolveEngineCardStats(state.cardStats, piece.cardDefinitionId) !==
        undefined,
      `Game state ${state.gameId} is missing engine card stats for card definition ${piece.cardDefinitionId}.`,
    )
  }
}

function assertRequestStateReferences(
  request: GameChoiceRequest,
  pieceIdSet: ReadonlySet<string>,
  playerIdSet: ReadonlySet<string>,
  zones: readonly ZoneState[],
): void {
  switch (request.type) {
    case 'choose.pieces':
      for (const pieceId of request.eligiblePieceIds) {
        assertRulesInvariant(
          pieceIdSet.has(pieceId),
          `Pending request ${request.requestId} references an unknown selectable piece ${pieceId}.`,
        )
      }
      return
    case 'choose.target':
      for (const target of request.eligibleTargets) {
        if (target.kind === 'piece') {
          assertRulesInvariant(
            pieceIdSet.has(target.pieceId),
            `Pending request ${request.requestId} references an unknown selectable piece target ${target.pieceId}.`,
          )
          continue
        }

        assertRulesInvariant(
          playerIdSet.has(target.playerId),
          `Pending request ${request.requestId} references an unknown selectable player target ${target.playerId}.`,
        )
      }
      return
    case 'choose.zone':
      for (const zone of request.eligibleZones) {
        assertZoneChoiceOptionReferences(request.requestId, zone, zones)
      }
      return
    case 'mulligan.select_cards':
      for (const pieceId of request.eligiblePieceIds) {
        assertRulesInvariant(
          pieceIdSet.has(pieceId),
          `Pending request ${request.requestId} references an unknown selectable mulligan piece ${pieceId}.`,
        )
      }
      for (const pieceId of request.currentDeckPieceIds) {
        assertRulesInvariant(
          pieceIdSet.has(pieceId),
          `Pending request ${request.requestId} references an unknown current deck piece ${pieceId}.`,
        )
      }
      assertRulesInvariant(
        zones.some((zone) => zone.zoneId === request.handZoneId),
        `Pending request ${request.requestId} references an unknown mulligan hand zone ${request.handZoneId}.`,
      )
      assertRulesInvariant(
        zones.some((zone) => zone.zoneId === request.deckZoneId),
        `Pending request ${request.requestId} references an unknown mulligan deck zone ${request.deckZoneId}.`,
      )
      return
    case 'battle.guard_select':
      for (const pieceId of request.eligiblePieceIds) {
        assertRulesInvariant(
          pieceIdSet.has(pieceId),
          `Pending request ${request.requestId} references an unknown selectable guard piece ${pieceId}.`,
        )
      }
      for (const pieceId of request.handPieceIds ?? []) {
        assertRulesInvariant(
          pieceIdSet.has(pieceId),
          `Pending request ${request.requestId} references an unknown hand guard piece ${pieceId}.`,
        )
      }
      for (const pieceId of request.interceptPieceIds ?? []) {
        assertRulesInvariant(
          pieceIdSet.has(pieceId),
          `Pending request ${request.requestId} references an unknown intercept piece ${pieceId}.`,
        )
      }
      assertRulesInvariant(
        zones.some((zone) => zone.zoneId === request.handZoneId),
        `Pending request ${request.requestId} references an unknown guard hand zone ${request.handZoneId}.`,
      )
      assertRulesInvariant(
        zones.some((zone) => zone.zoneId === request.guardZoneId),
        `Pending request ${request.requestId} references an unknown guard zone ${request.guardZoneId}.`,
      )
      assertRulesInvariant(
        pieceIdSet.has(request.attackerPieceId),
        `Pending request ${request.requestId} references an unknown battle attacker ${request.attackerPieceId}.`,
      )
      return
    case 'choose.option':
    case 'confirm.boolean':
      return
  }
}

function assertZoneChoiceOptionReferences(
  requestId: GameChoiceRequest['requestId'],
  option: ZoneChoiceOption,
  zones: readonly ZoneState[],
): void {
  const zoneState = zones.find((zone) => zone.zoneId === option.zoneId)

  assertRulesInvariant(
    zoneState !== undefined,
    `Pending request ${requestId} references an unknown selectable zone ${option.zoneId}.`,
  )

  if (option.availableSlotIds === undefined) {
    return
  }

  const slotIds = new Set(
    (zoneState.layout.slotIds ?? []).map((slotId) => slotId as string),
  )

  for (const slotId of option.availableSlotIds) {
    assertRulesInvariant(
      slotIds.has(slotId),
      `Pending request ${requestId} references an unknown selectable slot ${slotId} for zone ${option.zoneId}.`,
    )
  }
}

function assertBattleStateInvariant(
  battle: BattleState,
  state: GameState,
): void {
  const playerIdSet = new Set(
    state.players.map((player) => player.playerId as string),
  )
  const pieceIdSet = new Set(
    state.pieces.map((piece) => piece.pieceId as string),
  )
  const zoneIdSet = new Set(state.zones.map((zone) => zone.zoneId as string))
  const pendingRequestIds = new Set(
    state.pendingRequests.map((request) => request.requestId as string),
  )

  assertRulesInvariant(
    playerIdSet.has(battle.attackingPlayerId),
    `Battle ${battle.battleId} references an unknown attacking player ${battle.attackingPlayerId}.`,
  )
  assertRulesInvariant(
    playerIdSet.has(battle.defendingPlayerId),
    `Battle ${battle.battleId} references an unknown defending player ${battle.defendingPlayerId}.`,
  )
  assertRulesInvariant(
    battle.attackingPlayerId !== battle.defendingPlayerId,
    `Battle ${battle.battleId} must not target the attacking player as its own defender.`,
  )
  assertRulesInvariant(
    pieceIdSet.has(battle.attackerPieceId),
    `Battle ${battle.battleId} references an unknown attacker piece ${battle.attackerPieceId}.`,
  )
  assertRulesInvariant(
    zoneIdSet.has(battle.attackerZoneId),
    `Battle ${battle.battleId} references an unknown attacker zone ${battle.attackerZoneId}.`,
  )

  if (battle.boostingPieceId !== undefined) {
    assertRulesInvariant(
      pieceIdSet.has(battle.boostingPieceId),
      `Battle ${battle.battleId} references an unknown boosting piece ${battle.boostingPieceId}.`,
    )
    assertRulesInvariant(
      battle.boostingZoneId !== undefined,
      `Battle ${battle.battleId} must reference a boosting zone when a boosting piece is committed.`,
    )
  }

  if (battle.boostingZoneId !== undefined) {
    assertRulesInvariant(
      zoneIdSet.has(battle.boostingZoneId),
      `Battle ${battle.battleId} references an unknown boosting zone ${battle.boostingZoneId}.`,
    )
    assertRulesInvariant(
      battle.boostingPieceId !== undefined,
      `Battle ${battle.battleId} must reference a boosting piece when a boosting zone is committed.`,
    )
  }

  if (battle.guardZoneId !== undefined) {
    assertRulesInvariant(
      zoneIdSet.has(battle.guardZoneId),
      `Battle ${battle.battleId} references an unknown guard zone ${battle.guardZoneId}.`,
    )
  }

  if (battle.guardRequestId !== undefined) {
    assertRulesInvariant(
      pendingRequestIds.has(battle.guardRequestId),
      `Battle ${battle.battleId} references a missing pending guard request ${battle.guardRequestId}.`,
    )
  }

  assertUniqueValues(
    battle.guardPieceIds.map((pieceId) => pieceId as string),
    `Battle ${battle.battleId} must not repeat committed guard pieces.`,
  )

  for (const pieceId of battle.guardPieceIds) {
    assertRulesInvariant(
      pieceIdSet.has(pieceId),
      `Battle ${battle.battleId} references an unknown guard piece ${pieceId}.`,
    )
  }

  assertTargetReferenceInvariant(
    battle.battleId,
    battle.target,
    playerIdSet,
    pieceIdSet,
  )

  const attackerZone = state.zones.find(
    (zone) => zone.zoneId === battle.attackerZoneId,
  )

  assertRulesInvariant(
    attackerZone?.occupants.some(
      (occupant) => occupant.pieceId === battle.attackerPieceId,
    ) === true,
    `Battle ${battle.battleId} attacker piece ${battle.attackerPieceId} must remain in attacker zone ${battle.attackerZoneId}.`,
  )

  if (
    battle.boostingPieceId !== undefined &&
    battle.boostingZoneId !== undefined
  ) {
    const boostingZone = state.zones.find(
      (zone) => zone.zoneId === battle.boostingZoneId,
    )

    assertRulesInvariant(
      boostingZone?.occupants.some(
        (occupant) => occupant.pieceId === battle.boostingPieceId,
      ) === true,
      `Battle ${battle.battleId} boosting piece ${battle.boostingPieceId} must remain in boosting zone ${battle.boostingZoneId}.`,
    )
  }

  if (battle.guardZoneId !== undefined && battle.guardPieceIds.length > 0) {
    const guardZone = state.zones.find(
      (zone) => zone.zoneId === battle.guardZoneId,
    )

    assertRulesInvariant(
      guardZone !== undefined,
      `Battle ${battle.battleId} guard zone ${battle.guardZoneId} must exist when guard pieces are committed.`,
    )

    for (const pieceId of battle.guardPieceIds) {
      assertRulesInvariant(
        guardZone?.occupants.some(
          (occupant) => occupant.pieceId === pieceId,
        ) === true,
        `Battle ${battle.battleId} guard piece ${pieceId} must be present in guard zone ${battle.guardZoneId}.`,
      )
    }
  }

  if (battle.status === 'guard_requested') {
    assertRulesInvariant(
      battle.guardRequestId !== undefined,
      `Battle ${battle.battleId} must reference a pending request while guard selection is active.`,
    )
  }

  if (battle.lastCheck !== undefined) {
    assertBattleCheckStateInvariant(
      battle.battleId,
      battle.lastCheck,
      playerIdSet,
      pieceIdSet,
      zoneIdSet,
      state,
    )
  }

  if (battle.combat !== undefined) {
    assertBattleCombatStateInvariant(battle.battleId, battle.combat, pieceIdSet)
  }

  if (battle.damage !== undefined) {
    assertBattleDamageStateInvariant(
      battle.battleId,
      battle.damage,
      playerIdSet,
      zoneIdSet,
    )
  }

  if (battle.status === 'drive_checked') {
    assertRulesInvariant(
      battle.lastCheck?.kind === 'drive',
      `Battle ${battle.battleId} must keep a drive check record while in drive_checked status.`,
    )
  }

  if (battle.status === 'damage_checked') {
    assertRulesInvariant(
      battle.lastCheck?.kind === 'damage',
      `Battle ${battle.battleId} must keep a damage check record while in damage_checked status.`,
    )
    assertRulesInvariant(
      battle.combat?.result === 'hit',
      `Battle ${battle.battleId} must keep a hit combat result while in damage_checked status.`,
    )
    assertRulesInvariant(
      battle.damage !== undefined,
      `Battle ${battle.battleId} must keep damage outcome while in damage_checked status.`,
    )
  }

  if (battle.status === 'combat_resolved') {
    assertRulesInvariant(
      battle.combat !== undefined,
      `Battle ${battle.battleId} must keep combat comparison while in combat_resolved status.`,
    )
  }
}

function assertBattleDamageStateInvariant(
  battleId: BattleState['battleId'],
  damage: NonNullable<BattleState['damage']>,
  playerIdSet: ReadonlySet<string>,
  zoneIdSet: ReadonlySet<string>,
): void {
  assertRulesInvariant(
    playerIdSet.has(damage.playerId),
    `Battle ${battleId} damage outcome references unknown player ${damage.playerId}.`,
  )
  assertRulesInvariant(
    zoneIdSet.has(damage.damageZoneId),
    `Battle ${battleId} damage outcome references unknown damage zone ${damage.damageZoneId}.`,
  )
  assertSafeInteger(
    damage.damageBefore,
    `Battle ${battleId} damage-before count must be a non-negative safe integer.`,
    { nonNegative: true },
  )
  assertSafeInteger(
    damage.damageAfter,
    `Battle ${battleId} damage-after count must be a non-negative safe integer.`,
    { nonNegative: true },
  )
  assertSafeInteger(
    damage.defeatThreshold,
    `Battle ${battleId} damage defeat threshold must be a positive safe integer.`,
  )
  assertRulesInvariant(
    damage.defeatThreshold > 0,
    `Battle ${battleId} damage defeat threshold must be positive.`,
  )
  assertRulesInvariant(
    damage.damageAfter >= 0,
    `Battle ${battleId} damage-after count must be non-negative.`,
  )
  assertRulesInvariant(
    damage.outcome === 'lethal'
      ? damage.damageAfter >= damage.defeatThreshold
      : damage.damageAfter < damage.defeatThreshold,
    `Battle ${battleId} damage outcome must match the damage count and defeat threshold.`,
  )
}

function assertBattleCombatStateInvariant(
  battleId: BattleState['battleId'],
  combat: NonNullable<BattleState['combat']>,
  pieceIdSet: ReadonlySet<string>,
): void {
  assertSafeInteger(
    combat.attackPower,
    `Battle ${battleId} attack power must be a non-negative safe integer.`,
    { nonNegative: true },
  )
  assertSafeInteger(
    combat.defensePower,
    `Battle ${battleId} defense power must be a non-negative safe integer.`,
    { nonNegative: true },
  )
  assertSafeInteger(
    combat.shieldPower,
    `Battle ${battleId} shield power must be a non-negative safe integer.`,
    { nonNegative: true },
  )
  assertSafeInteger(
    combat.totalDefensePower,
    `Battle ${battleId} total defense power must be a non-negative safe integer.`,
    { nonNegative: true },
  )
  assertRulesInvariant(
    combat.totalDefensePower === combat.defensePower + combat.shieldPower,
    `Battle ${battleId} total defense power must equal defense plus shield.`,
  )
  assertRulesInvariant(
    combat.result === 'hit'
      ? combat.attackPower >= combat.totalDefensePower
      : combat.attackPower < combat.totalDefensePower,
    `Battle ${battleId} combat result must match attack and defense totals.`,
  )

  for (const component of [
    ...combat.attackerPowerComponents,
    ...combat.defensePowerComponents,
    ...combat.shieldComponents,
  ]) {
    assertSafeInteger(
      component.amount,
      `Battle ${battleId} combat component amount must be a non-negative safe integer.`,
      { nonNegative: true },
    )

    if (component.pieceId !== undefined) {
      assertRulesInvariant(
        pieceIdSet.has(component.pieceId),
        `Battle ${battleId} combat component references unknown piece ${component.pieceId}.`,
      )
    }
  }
}

function assertBattleCheckStateInvariant(
  battleId: BattleState['battleId'],
  check: BattleCheckState,
  playerIdSet: ReadonlySet<string>,
  pieceIdSet: ReadonlySet<string>,
  zoneIdSet: ReadonlySet<string>,
  state: GameState,
): void {
  assertRulesInvariant(
    playerIdSet.has(check.playerId),
    `Battle ${battleId} references an unknown check player ${check.playerId}.`,
  )
  assertRulesInvariant(
    zoneIdSet.has(check.fromZoneId),
    `Battle ${battleId} references an unknown check source zone ${check.fromZoneId}.`,
  )
  assertRulesInvariant(
    zoneIdSet.has(check.toZoneId),
    `Battle ${battleId} references an unknown check destination zone ${check.toZoneId}.`,
  )

  for (const revealedCard of check.revealedCards) {
    assertRulesInvariant(
      pieceIdSet.has(revealedCard.pieceId),
      `Battle ${battleId} references an unknown revealed check piece ${revealedCard.pieceId}.`,
    )

    const piece = state.pieces.find(
      (candidate) => candidate.pieceId === revealedCard.pieceId,
    )

    if (revealedCard.cardDefinitionId !== undefined) {
      assertRulesInvariant(
        piece?.cardDefinitionId === revealedCard.cardDefinitionId,
        `Battle ${battleId} revealed check piece ${revealedCard.pieceId} must keep a matching canonical card definition id.`,
      )
    }
  }
}

function assertTargetReferenceInvariant(
  battleId: BattleState['battleId'],
  target: TargetReference,
  playerIdSet: ReadonlySet<string>,
  pieceIdSet: ReadonlySet<string>,
): void {
  if (target.kind === 'player') {
    assertRulesInvariant(
      playerIdSet.has(target.playerId),
      `Battle ${battleId} references an unknown player target ${target.playerId}.`,
    )
    return
  }

  assertRulesInvariant(
    pieceIdSet.has(target.pieceId),
    `Battle ${battleId} references an unknown piece target ${target.pieceId}.`,
  )
}
