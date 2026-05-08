import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import { RulesInvariantError } from '../errors'
import type {
  ActionId,
  GameChoiceRequest,
  GameState,
  RequestId,
  TransitionResult,
  ZoneSlotId,
} from '../index'
import {
  applyGameAction,
  assertGameStateInvariant,
  isAppliedTransitionResult,
  isBlockedTransitionResult,
  isInvalidTransitionResult,
} from '../index'

function makeFlagState(
  options: {
    readonly pieceStates?: GameState['pieceStates']
    readonly pendingRequests?: readonly GameChoiceRequest[]
  } = {},
): GameState {
  const pendingRequests = options.pendingRequests ?? []

  return {
    gameId: 'game-flags-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress',
    revision: 6,
    turn: {
      turnNumber: 2,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'battle' as GameState['turn']['phase'],
      step: 'action-window' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          'zone-p1-soul' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: 'waiting',
        ownedZoneIds: [
          'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: 'piece-p1-hand' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId:
              'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
        kind: 'rear_guard_circle',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: ['slot-left' as ZoneSlotId, 'slot-right' as ZoneSlotId],
        },
        occupants: [
          {
            pieceId:
              'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
            slotId: 'slot-left' as ZoneSlotId,
          },
        ],
      },
      {
        zoneId: 'zone-p1-soul' as GameState['zones'][number]['zoneId'],
        kind: 'soul',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
      {
        zoneId: 'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
        kind: 'vanguard_circle',
        scope: 'player',
        ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId:
              'piece-p2-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
    ],
    pieces: [
      makeCardPiece('piece-p1-hand', 'card-p1-hand', 'player-1'),
      makeCardPiece('piece-p1-vanguard', 'card-p1-vanguard', 'player-1'),
      makeCardPiece('piece-p1-booster', 'card-p1-booster', 'player-1'),
      makeCardPiece('piece-p2-vanguard', 'card-p2-vanguard', 'player-2'),
    ],
    pieceStates: options.pieceStates ?? [],
    flags: [],
    pendingRequests,
  }
}

function makeCardPiece(
  pieceId: string,
  cardDefinitionId: string,
  ownerPlayerId: string,
): GameState['pieces'][number] {
  return {
    pieceId: pieceId as GameState['pieces'][number]['pieceId'],
    kind: 'card',
    ownerPlayerId: ownerPlayerId as GameState['players'][number]['playerId'],
    controllerPlayerId:
      ownerPlayerId as GameState['players'][number]['playerId'],
    cardDefinitionId: cardDefinitionId as CardId,
  }
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-flag-block-1' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

function expectApplied(result: TransitionResult) {
  expect(isAppliedTransitionResult(result)).toBe(true)

  if (!isAppliedTransitionResult(result)) {
    throw new Error(`Expected applied transition, received ${result.status}.`)
  }

  return result
}

function expectInvalid(result: TransitionResult) {
  expect(isInvalidTransitionResult(result)).toBe(true)

  if (!isInvalidTransitionResult(result)) {
    throw new Error(`Expected invalid transition, received ${result.status}.`)
  }

  return result
}

function expectBlocked(result: TransitionResult) {
  expect(isBlockedTransitionResult(result)).toBe(true)

  if (!isBlockedTransitionResult(result)) {
    throw new Error(`Expected blocked transition, received ${result.status}.`)
  }

  return result
}

describe('@web-vg/rules-core state flags foundation', () => {
  it('rejects duplicate sparse piece-state entries and duplicate flags in invariants', () => {
    const duplicatePieceState = makeFlagState({
      pieceStates: [
        {
          pieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          orientation: 'rest',
          flags: [],
        },
        {
          pieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          orientation: 'stand',
          flags: [],
        },
      ],
    })
    const duplicateFlagState = makeFlagState({
      pieceStates: [
        {
          pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
          orientation: 'stand',
          flags: ['locked', 'locked'],
        },
      ],
    })

    expect(() => assertGameStateInvariant(duplicatePieceState)).toThrow(
      RulesInvariantError,
    )
    expect(() => assertGameStateInvariant(duplicateFlagState)).toThrow(
      RulesInvariantError,
    )
  })

  it('applies stand/rest transitions through the reducer and normalizes sparse default state', () => {
    const state = makeFlagState()
    const restedResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-piece-rest-1' as ActionId,
          type: 'piece.rest',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          pieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: state.revision,
      }),
    )

    expect(restedResult.nextState.pieceStates).toEqual([
      {
        pieceId: 'piece-p1-vanguard',
        orientation: 'rest',
        flags: [],
      },
    ])
    expect(restedResult.events.map((event) => event.type)).toEqual([
      'piece.rested',
    ])

    const stoodResult = expectApplied(
      applyGameAction(restedResult.nextState, {
        action: {
          actionId: 'action-piece-stand-1' as ActionId,
          type: 'piece.stand',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          pieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: restedResult.nextState.revision,
      }),
    )

    expect(stoodResult.nextState.pieceStates).toEqual([])
    expect(stoodResult.events.map((event) => event.type)).toEqual([
      'piece.stood',
    ])
  })

  it('applies lock/unlock transitions without collapsing orientation semantics into ad hoc booleans', () => {
    const state = makeFlagState()
    const lockedResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-piece-lock-1' as ActionId,
          type: 'piece.lock',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: state.revision,
      }),
    )

    expect(lockedResult.nextState.pieceStates).toEqual([
      {
        pieceId: 'piece-p1-booster',
        orientation: 'stand',
        flags: ['locked'],
      },
    ])
    expect(lockedResult.events.map((event) => event.type)).toEqual([
      'piece.locked',
    ])

    const unlockedResult = expectApplied(
      applyGameAction(lockedResult.nextState, {
        action: {
          actionId: 'action-piece-unlock-1' as ActionId,
          type: 'piece.unlock',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: lockedResult.nextState.revision,
      }),
    )

    expect(unlockedResult.nextState.pieceStates).toEqual([])
    expect(unlockedResult.events.map((event) => event.type)).toEqual([
      'piece.unlocked',
    ])
  })

  it('rejects incompatible flag transitions structurally', () => {
    const state = makeFlagState({
      pieceStates: [
        {
          pieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          orientation: 'stand',
          flags: ['locked'],
        },
      ],
    })
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-piece-rest-invalid-1' as ActionId,
        type: 'piece.rest',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId: 'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
      },
      expectedRevision: state.revision,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.message).toMatch(/locked/i)
  })

  it('keeps piece-state actions blocked while the engine owns a pending request', () => {
    const pendingRequest = makePendingRequest()
    const state = makeFlagState({
      pendingRequests: [pendingRequest],
    })
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-piece-rest-blocked-1' as ActionId,
        type: 'piece.rest',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId: 'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
      },
      expectedRevision: state.revision,
    })
    const blockedResult = expectBlocked(result)

    expect(blockedResult.blockingRequests).toEqual([pendingRequest])
  })

  it('makes current battle mechanics consume standing state and rest participating units', () => {
    const state = makeFlagState()
    const attackResult = expectApplied(
      applyGameAction(state, {
        action: {
          actionId: 'action-attack-flag-1' as ActionId,
          type: 'battle.declare_attack',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          attackerPieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          target: {
            kind: 'player',
            playerId: 'player-2' as GameState['players'][number]['playerId'],
          },
        },
        expectedRevision: state.revision,
      }),
    )

    expect(attackResult.nextState.pieceStates).toEqual([
      {
        pieceId: 'piece-p1-vanguard',
        orientation: 'rest',
        flags: [],
      },
    ])
    expect(attackResult.events.map((event) => event.type)).toEqual([
      'piece.rested',
      'battle.attack_declared',
    ])

    const boostResult = expectApplied(
      applyGameAction(attackResult.nextState, {
        action: {
          actionId: 'action-boost-flag-1' as ActionId,
          type: 'battle.commit_boost',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          attackerPieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          boosterPieceId:
            'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: attackResult.nextState.revision,
      }),
    )

    expect(boostResult.nextState.pieceStates).toEqual([
      {
        pieceId: 'piece-p1-vanguard',
        orientation: 'rest',
        flags: [],
      },
      {
        pieceId: 'piece-p1-booster',
        orientation: 'rest',
        flags: [],
      },
    ])
    expect(boostResult.events.map((event) => event.type)).toEqual([
      'piece.rested',
      'battle.boost_declared',
    ])
  })

  it('rejects attacks from already-rested attackers under the new flag semantics', () => {
    const state = makeFlagState({
      pieceStates: [
        {
          pieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          orientation: 'rest',
          flags: [],
        },
      ],
    })
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-attack-rested-1' as ActionId,
        type: 'battle.declare_attack',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        attackerPieceId:
          'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        target: {
          kind: 'player',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
        },
      },
      expectedRevision: state.revision,
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.message).toMatch(/already rested/i)
  })

  it('resets board-state flags when a unit leaves main circles', () => {
    const state = makeFlagState({
      pieceStates: [
        {
          pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
          orientation: 'rest',
          flags: ['locked'],
        },
      ],
    })
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-zone-transfer-flags-1' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-left' as ZoneSlotId,
        },
        to: {
          zoneId: 'zone-p1-soul' as GameState['zones'][number]['zoneId'],
        },
        reason: 'soul',
      },
      expectedRevision: state.revision,
    })
    const appliedResult = expectApplied(result)
    const soulZone = appliedResult.nextState.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-soul' as GameState['zones'][number]['zoneId']),
    )

    expect(appliedResult.nextState.pieceStates).toEqual([])
    expect(soulZone?.occupants).toContainEqual({
      pieceId: 'piece-p1-booster' as GameState['pieces'][number]['pieceId'],
    })
  })

  it('resets stale runtime flags when a card enters a main circle from a non-board zone', () => {
    const state = makeFlagState({
      pieceStates: [
        {
          pieceId: 'piece-p1-hand' as GameState['pieces'][number]['pieceId'],
          orientation: 'rest',
          flags: ['locked'],
        },
      ],
    })
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-zone-transfer-enter-board-flags-1' as ActionId,
        type: 'card.call',
        actor: {
          kind: 'player',
          playerId: 'player-1' as GameState['players'][number]['playerId'],
        },
        pieceId: 'piece-p1-hand' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-right' as ZoneSlotId,
        },
      },
      expectedRevision: state.revision,
    })
    const appliedResult = expectApplied(result)

    expect(appliedResult.nextState.pieceStates).toEqual([])
  })

  it('preserves orientation and locked state across main-circle transfers', () => {
    const state = makeFlagState({
      pieceStates: [
        {
          pieceId:
            'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
          orientation: 'rest',
          flags: ['locked'],
        },
      ],
    })
    const result = applyGameAction(state, {
      action: {
        actionId: 'action-zone-transfer-main-to-main-flags-1' as ActionId,
        type: 'zone.move_piece',
        actor: {
          kind: 'system',
          system: 'automatic-flow',
        },
        pieceId: 'piece-p1-vanguard' as GameState['pieces'][number]['pieceId'],
        from: {
          zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        },
        to: {
          zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
          slotId: 'slot-right' as ZoneSlotId,
        },
        reason: 'format',
      },
      expectedRevision: state.revision,
    })
    const appliedResult = expectApplied(result)

    expect(appliedResult.nextState.pieceStates).toEqual([
      {
        pieceId: 'piece-p1-vanguard',
        orientation: 'rest',
        flags: ['locked'],
      },
    ])
  })
})
