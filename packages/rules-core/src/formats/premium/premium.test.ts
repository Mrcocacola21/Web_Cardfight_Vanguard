import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  EngineDispatchResult,
  GameChoiceRequest,
  GameState,
  RequestId,
} from '../../index'
import {
  PREMIUM_FORMAT_ACTION_TYPES,
  PREMIUM_FORMAT_GAMEPLAY_MARKERS,
  PREMIUM_FORMAT_ID,
  PREMIUM_ZONE_KINDS,
  STANDARD_FORMAT_GAMEPLAY_MARKERS,
  STANDARD_FORMAT_ID,
  V_PREMIUM_FORMAT_GAMEPLAY_MARKERS,
  V_PREMIUM_FORMAT_ID,
  dispatchEngineCommand,
  dispatchPremiumCommand,
  isAcceptedEngineDispatchResult,
  isBlockedEngineDispatchResult,
  isInvalidEngineDispatchResult,
  premiumFormatAdapter,
  standardFormatAdapter,
  vPremiumFormatAdapter,
} from '../../index'

interface PremiumStateOptions {
  readonly formatId?: FormatId
  readonly status?: GameState['status']
  readonly revision?: number
  readonly pendingRequests?: readonly GameChoiceRequest[]
  readonly includeGiftZone?: boolean
  readonly includeRideDeckZone?: boolean
  readonly occupiedHeart?: boolean
}

function makePremiumState(options: PremiumStateOptions = {}): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status =
    options.status ??
    (pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress')
  const includeGiftZone = options.includeGiftZone ?? true
  const includeRideDeckZone = options.includeRideDeckZone ?? false
  const occupiedHeart = options.occupiedHeart ?? false
  const playerOneOwnedZoneIds: GameState['zones'][number]['zoneId'][] = [
    'zone-p1-hand' as GameState['zones'][number]['zoneId'],
    'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
    'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
    'zone-p1-soul' as GameState['zones'][number]['zoneId'],
    'zone-p1-g' as GameState['zones'][number]['zoneId'],
    'zone-p1-heart' as GameState['zones'][number]['zoneId'],
  ]
  const zones: GameState['zones'][number][] = [
    {
      zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.hand,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'owner-private',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: 'piece-hand-call' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-p1-rearguard' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.rearGuardCircle,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants: [],
    },
    {
      zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.vanguardCircle,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants: [
        {
          pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-p1-soul' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.soul,
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
      zoneId: 'zone-p1-g' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.gZone,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: 'piece-g-unit' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-p1-heart' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.heart,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'controller-private',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants: occupiedHeart
        ? [
            {
              pieceId:
                'piece-heart-existing' as GameState['pieces'][number]['pieceId'],
            },
          ]
        : [],
    },
  ]
  const pieces: GameState['pieces'][number][] = [
    {
      pieceId: 'piece-hand-call' as GameState['pieces'][number]['pieceId'],
      kind: 'card',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      controllerPlayerId:
        'player-1' as GameState['players'][number]['playerId'],
      cardDefinitionId: 'card-hand-call' as CardId,
    },
    {
      pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
      kind: 'card',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      controllerPlayerId:
        'player-1' as GameState['players'][number]['playerId'],
      cardDefinitionId: 'card-vanguard' as CardId,
    },
    {
      pieceId: 'piece-g-unit' as GameState['pieces'][number]['pieceId'],
      kind: 'card',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      controllerPlayerId:
        'player-1' as GameState['players'][number]['playerId'],
      cardDefinitionId: 'card-g-unit' as CardId,
    },
  ]

  if (occupiedHeart) {
    pieces.push({
      pieceId: 'piece-heart-existing' as GameState['pieces'][number]['pieceId'],
      kind: 'card',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      controllerPlayerId:
        'player-1' as GameState['players'][number]['playerId'],
      cardDefinitionId: 'card-heart-existing' as CardId,
    })
  }

  if (includeGiftZone) {
    playerOneOwnedZoneIds.push(
      'zone-p1-gift' as GameState['zones'][number]['zoneId'],
    )
    zones.push({
      zoneId: 'zone-p1-gift' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.imaginaryGift,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: [],
    })
  }

  if (includeRideDeckZone) {
    playerOneOwnedZoneIds.push(
      'zone-p1-ride' as GameState['zones'][number]['zoneId'],
    )
    zones.push({
      zoneId: 'zone-p1-ride' as GameState['zones'][number]['zoneId'],
      kind: 'ride_deck',
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: 'piece-ride-deck' as GameState['pieces'][number]['pieceId'],
        },
      ],
    })
    pieces.push({
      pieceId: 'piece-ride-deck' as GameState['pieces'][number]['pieceId'],
      kind: 'card',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      controllerPlayerId:
        'player-1' as GameState['players'][number]['playerId'],
      cardDefinitionId: 'card-ride-deck' as CardId,
    })
  }

  zones.push(
    {
      zoneId: 'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.vanguardCircle,
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
            'piece-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-p2-soul' as GameState['zones'][number]['zoneId'],
      kind: PREMIUM_ZONE_KINDS.soul,
      scope: 'player',
      ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [],
    },
  )
  pieces.push({
    pieceId:
      'piece-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
    kind: 'card',
    ownerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
    controllerPlayerId: 'player-2' as GameState['players'][number]['playerId'],
    cardDefinitionId: 'card-opponent-vanguard' as CardId,
  })

  return {
    gameId: 'game-premium-1' as GameState['gameId'],
    formatId: options.formatId ?? PREMIUM_FORMAT_ID,
    status,
    revision: options.revision ?? 5,
    turn: {
      turnNumber: 3,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: (status === 'ready'
        ? 'pregame'
        : 'stride') as GameState['turn']['phase'],
      step: (status === 'ready' ? 'opening' : 'main') as NonNullable<
        GameState['turn']['step']
      >,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: (status === 'ready'
          ? 'ready'
          : 'active') as GameState['players'][number]['status'],
        ownedZoneIds: playerOneOwnedZoneIds,
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: (status === 'ready'
          ? 'ready'
          : 'waiting') as GameState['players'][number]['status'],
        ownedZoneIds: [
          'zone-p2-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-p2-soul' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones,
    pieces,
    pieceStates: [],
    flags: [],
    pendingRequests,
  }
}

function makePendingRequest(): GameChoiceRequest {
  return {
    requestId: 'request-premium-1' as RequestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

function expectAccepted(result: EngineDispatchResult) {
  expect(isAcceptedEngineDispatchResult(result)).toBe(true)

  if (!isAcceptedEngineDispatchResult(result)) {
    throw new Error(`Expected an accepted result, received ${result.status}.`)
  }

  return result
}

function expectInvalid(result: EngineDispatchResult) {
  expect(isInvalidEngineDispatchResult(result)).toBe(true)

  if (!isInvalidEngineDispatchResult(result)) {
    throw new Error(`Expected an invalid result, received ${result.status}.`)
  }

  return result
}

function expectBlocked(result: EngineDispatchResult) {
  expect(isBlockedEngineDispatchResult(result)).toBe(true)

  if (!isBlockedEngineDispatchResult(result)) {
    throw new Error(`Expected a blocked result, received ${result.status}.`)
  }

  return result
}

describe('@web-vg/rules-core Premium format adapter', () => {
  it('reuses the shared adapter contract while exposing the most demanding format metadata so far', () => {
    expect(premiumFormatAdapter.formatId).toBe(PREMIUM_FORMAT_ID)
    expect(premiumFormatAdapter.constructionBasis).toBe('clan-based')
    expect(premiumFormatAdapter.gameplayMarkers).toEqual(
      PREMIUM_FORMAT_GAMEPLAY_MARKERS,
    )
    expect(premiumFormatAdapter.supportedActionTypes).toEqual(
      PREMIUM_FORMAT_ACTION_TYPES,
    )

    expect(standardFormatAdapter.formatId).toBe(STANDARD_FORMAT_ID)
    expect(vPremiumFormatAdapter.formatId).toBe(V_PREMIUM_FORMAT_ID)
    expect(standardFormatAdapter.gameplayMarkers).toEqual(
      STANDARD_FORMAT_GAMEPLAY_MARKERS,
    )
    expect(vPremiumFormatAdapter.gameplayMarkers).toEqual(
      V_PREMIUM_FORMAT_GAMEPLAY_MARKERS,
    )

    expect(PREMIUM_FORMAT_GAMEPLAY_MARKERS).toContain('g-zone')
    expect(PREMIUM_FORMAT_GAMEPLAY_MARKERS).toContain('stride')
    expect(PREMIUM_FORMAT_GAMEPLAY_MARKERS).toContain('imaginary-gift')
    expect(PREMIUM_FORMAT_GAMEPLAY_MARKERS).not.toContain('ride-deck')
  })

  it('delegates unchanged supported actions back to the core reducer boundary', () => {
    const state = makePremiumState({
      status: 'ready',
      revision: 0,
      includeGiftZone: false,
    })
    const command = {
      kind: 'action' as const,
      submission: {
        action: {
          actionId: 'action-premium-start-1' as ActionId,
          type: 'match.start' as const,
          actor: {
            kind: 'system' as const,
            system: 'match-setup' as const,
          },
        },
        expectedRevision: 0,
      },
    }

    const coreResult = dispatchEngineCommand(state, command)
    const adapterResult = dispatchPremiumCommand(state, command)

    expect(adapterResult).toEqual(coreResult)
    expectAccepted(adapterResult)
  })

  it('rejects generic ride deck references because Premium keeps mixed-era runtime structure inside the adapter', () => {
    const state = makePremiumState({
      includeGiftZone: false,
      includeRideDeckZone: true,
    })
    const result = dispatchPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-premium-ride-deck-1' as ActionId,
          type: 'zone.move_piece',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          pieceId: 'piece-ride-deck' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-ride' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-soul' as GameState['zones'][number]['zoneId'],
          },
          reason: 'generic',
        },
        expectedRevision: state.revision,
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('format_rule_violation')
    expect(invalidResult.message).toMatch(/no baseline ride deck/i)
    expect(invalidResult.state).toEqual(state)
  })

  it('rejects generic movement that tries to treat the Premium G zone like a normal movement surface', () => {
    const state = makePremiumState({
      includeGiftZone: false,
    })
    const result = dispatchPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-premium-g-zone-move-1' as ActionId,
          type: 'zone.move_piece',
          actor: {
            kind: 'system',
            system: 'automatic-flow',
          },
          pieceId: 'piece-g-unit' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-g' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-soul' as GameState['zones'][number]['zoneId'],
          },
          reason: 'generic',
        },
        expectedRevision: state.revision,
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('format_rule_violation')
    expect(invalidResult.message).toMatch(/Premium-specific transitions/i)
    expect(invalidResult.state).toEqual(state)
  })

  it('applies a Premium stride-like play by moving the current vanguard into heart and a G unit onto vanguard', () => {
    const state = makePremiumState()
    const result = dispatchPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-premium-play-1' as ActionId,
          type: 'card.play',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-g-unit' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-g' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
        },
        expectedRevision: state.revision,
      },
    })
    const acceptedResult = expectAccepted(result)
    const gZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId === ('zone-p1-g' as GameState['zones'][number]['zoneId']),
    )
    const vanguardZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-vanguard' as GameState['zones'][number]['zoneId']),
    )
    const heartZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-heart' as GameState['zones'][number]['zoneId']),
    )

    expect(acceptedResult.state.revision).toBe(6)
    expect(acceptedResult.state.status).toBe('in_progress')
    expect(gZone?.occupants).toEqual([])
    expect(vanguardZone?.occupants).toEqual([
      {
        pieceId: 'piece-g-unit' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(heartZone?.occupants).toEqual([
      {
        pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(acceptedResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.played',
    ])
    expect(acceptedResult.pendingRequests).toEqual([])
  })

  it('keeps Premium structural constraints inside the adapter by rejecting stride-like play when the heart zone is occupied', () => {
    const state = makePremiumState({
      occupiedHeart: true,
    })
    const result = dispatchPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-premium-play-heart-occupied-1' as ActionId,
          type: 'card.play',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-g-unit' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-g' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
        },
        expectedRevision: state.revision,
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('format_rule_violation')
    expect(invalidResult.message).toMatch(/heart zone/i)
    expect(invalidResult.state).toEqual(state)
  })

  it('rejects Premium-owned stride-like play during an active battle as a structured transition result', () => {
    const state: GameState = {
      ...makePremiumState({
        includeGiftZone: false,
      }),
      battle: {
        battleId: 'battle-premium-active-1' as NonNullable<
          GameState['battle']
        >['battleId'],
        status: 'attack_declared',
        attackingPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        defendingPlayerId:
          'player-2' as GameState['players'][number]['playerId'],
        attackerPieceId:
          'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        attackerZoneId:
          'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
        target: {
          kind: 'player',
          playerId: 'player-2' as GameState['players'][number]['playerId'],
        },
        guardPieceIds: [],
      },
    }
    const result = dispatchPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-premium-play-active-battle-1' as ActionId,
          type: 'card.play',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-g-unit' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-g' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
        },
        expectedRevision: state.revision,
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('invalid_action')
    expect(invalidResult.message).toMatch(/active/i)
    expect(invalidResult.state).toEqual(state)
    expect(invalidResult.events).toEqual([])
  })

  it('preserves core pending-request blocking semantics for Premium-owned transitions', () => {
    const pendingRequest = makePendingRequest()
    const state = makePremiumState({
      pendingRequests: [pendingRequest],
      includeGiftZone: false,
    })
    const result = dispatchPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-premium-play-blocked-1' as ActionId,
          type: 'card.play',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-g-unit' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-g' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
        },
        expectedRevision: state.revision,
      },
    })
    const blockedResult = expectBlocked(result)

    expect(blockedResult.code).toBe('pending_request')
    expect(blockedResult.blockingRequests).toEqual([pendingRequest])
    expect(blockedResult.state).toEqual(state)
  })

  it('rejects non-premium states before dispatching Premium-owned commands', () => {
    const state = makePremiumState({
      formatId: 'v-premium' as FormatId,
      includeGiftZone: false,
    })
    const result = dispatchPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-premium-format-mismatch-1' as ActionId,
          type: 'match.ready',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
        },
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('format_mismatch')
    expect(invalidResult.state).toEqual(state)
  })
})
