import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type {
  ActionId,
  EngineDispatchResult,
  GameChoiceRequest,
  GameState,
  RequestId,
  ZoneSlotId,
} from '../../index'
import {
  STANDARD_FORMAT_GAMEPLAY_MARKERS,
  STANDARD_FORMAT_ID,
  V_PREMIUM_FORMAT_ACTION_TYPES,
  V_PREMIUM_FORMAT_GAMEPLAY_MARKERS,
  V_PREMIUM_FORMAT_ID,
  V_PREMIUM_ZONE_KINDS,
  dispatchEngineCommand,
  dispatchVPremiumCommand,
  isAcceptedEngineDispatchResult,
  isInvalidEngineDispatchResult,
  standardFormatAdapter,
  vPremiumFormatAdapter,
} from '../../index'

interface VPremiumStateOptions {
  readonly formatId?: FormatId
  readonly status?: GameState['status']
  readonly revision?: number
  readonly pendingRequests?: readonly GameChoiceRequest[]
  readonly includeGiftZone?: boolean
  readonly includeRideDeckZone?: boolean
}

function makeVPremiumState(options: VPremiumStateOptions = {}): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status =
    options.status ??
    (pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress')
  const includeGiftZone = options.includeGiftZone ?? true
  const includeRideDeckZone = options.includeRideDeckZone ?? false
  const playerOneOwnedZoneIds: GameState['zones'][number]['zoneId'][] = [
    'zone-p1-hand' as GameState['zones'][number]['zoneId'],
    'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
    'zone-p1-soul' as GameState['zones'][number]['zoneId'],
  ]
  const zones: GameState['zones'][number][] = [
    {
      zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
      kind: V_PREMIUM_ZONE_KINDS.hand,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'owner-private',
      layout: {
        ordering: 'unordered',
        occupancy: 'multi',
      },
      occupants: [
        {
          pieceId: 'piece-hand-ride' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
      kind: V_PREMIUM_ZONE_KINDS.vanguardCircle,
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
      kind: V_PREMIUM_ZONE_KINDS.soul,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'public',
      layout: {
        ordering: 'ordered',
        occupancy: 'multi',
      },
      occupants: [],
    },
  ]
  const pieces: GameState['pieces'][number][] = [
    {
      pieceId: 'piece-hand-ride' as GameState['pieces'][number]['pieceId'],
      kind: 'card',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      controllerPlayerId:
        'player-1' as GameState['players'][number]['playerId'],
      cardDefinitionId: 'card-hand-ride' as CardId,
    },
    {
      pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
      kind: 'card',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      controllerPlayerId:
        'player-1' as GameState['players'][number]['playerId'],
      cardDefinitionId: 'card-vanguard' as CardId,
    },
  ]

  if (includeGiftZone) {
    playerOneOwnedZoneIds.push(
      'zone-p1-gift' as GameState['zones'][number]['zoneId'],
    )
    zones.push({
      zoneId: 'zone-p1-gift' as GameState['zones'][number]['zoneId'],
      kind: V_PREMIUM_ZONE_KINDS.imaginaryGift,
      scope: 'player',
      ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'slotted',
        slotIds: ['gift-left' as ZoneSlotId, 'gift-right' as ZoneSlotId],
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
      kind: V_PREMIUM_ZONE_KINDS.vanguardCircle,
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
      kind: V_PREMIUM_ZONE_KINDS.soul,
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
    gameId: 'game-v-premium-1' as GameState['gameId'],
    formatId: options.formatId ?? V_PREMIUM_FORMAT_ID,
    status,
    revision: options.revision ?? 4,
    turn: {
      turnNumber: 2,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: (status === 'ready'
        ? 'pregame'
        : 'ride') as GameState['turn']['phase'],
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
    requestId: 'request-v-premium-1' as RequestId,
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

describe('@web-vg/rules-core V Premium format adapter', () => {
  it('reuses the shared adapter contract while exposing format-distinct metadata from Standard', () => {
    expect(vPremiumFormatAdapter.formatId).toBe(V_PREMIUM_FORMAT_ID)
    expect(vPremiumFormatAdapter.constructionBasis).toBe('clan-based')
    expect(vPremiumFormatAdapter.gameplayMarkers).toEqual(
      V_PREMIUM_FORMAT_GAMEPLAY_MARKERS,
    )
    expect(vPremiumFormatAdapter.supportedActionTypes).toEqual(
      V_PREMIUM_FORMAT_ACTION_TYPES,
    )

    expect(standardFormatAdapter.formatId).toBe(STANDARD_FORMAT_ID)
    expect(standardFormatAdapter.constructionBasis).toBe('nation-based')
    expect(standardFormatAdapter.gameplayMarkers).toEqual(
      STANDARD_FORMAT_GAMEPLAY_MARKERS,
    )

    expect(standardFormatAdapter.gameplayMarkers).toContain('ride-deck')
    expect(vPremiumFormatAdapter.gameplayMarkers).not.toContain('ride-deck')
    expect(vPremiumFormatAdapter.gameplayMarkers).toContain('imaginary-gift')
  })

  it('delegates generic supported actions to the core engine without changing reducer semantics', () => {
    const state = makeVPremiumState({
      status: 'ready',
      revision: 0,
      includeGiftZone: false,
    })
    const command = {
      kind: 'action' as const,
      submission: {
        action: {
          actionId: 'action-v-premium-start-1' as ActionId,
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
    const adapterResult = dispatchVPremiumCommand(state, command)

    expect(adapterResult).toEqual(coreResult)
    expectAccepted(adapterResult)
  })

  it('rejects ride deck references because V Premium has no baseline ride deck, unlike Standard', () => {
    const state = makeVPremiumState({
      includeRideDeckZone: true,
      includeGiftZone: false,
    })
    const result = dispatchVPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-v-premium-ride-deck-1' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-ride-deck' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-ride' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: state.revision,
      },
    })
    const invalidResult = expectInvalid(result)

    expect(invalidResult.code).toBe('format_rule_violation')
    expect(invalidResult.message).toMatch(/no baseline ride deck/i)
    expect(invalidResult.state).toEqual(state)
  })

  it('rides from hand to vanguard and creates an engine-owned gift continuation request when a gift zone is available', () => {
    const state = makeVPremiumState()
    const result = dispatchVPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-v-premium-ride-1' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-hand-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: state.revision,
      },
    })
    const acceptedResult = expectAccepted(result)
    const handZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-hand' as GameState['zones'][number]['zoneId']),
    )
    const vanguardZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-vanguard' as GameState['zones'][number]['zoneId']),
    )
    const soulZone = acceptedResult.state.zones.find(
      (zone) =>
        zone.zoneId ===
        ('zone-p1-soul' as GameState['zones'][number]['zoneId']),
    )
    const giftRequest = acceptedResult.pendingRequests[0]

    expect(acceptedResult.state.revision).toBe(5)
    expect(acceptedResult.state.status).toBe('awaiting_choice')
    expect(handZone?.occupants).toEqual([])
    expect(vanguardZone?.occupants).toEqual([
      {
        pieceId: 'piece-hand-ride' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(soulZone?.occupants).toEqual([
      {
        pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
      },
    ])
    expect(acceptedResult.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
    ])
    expect(giftRequest?.type).toBe('choose.zone')

    if (giftRequest?.type !== 'choose.zone') {
      throw new Error(
        'Expected a choose.zone request for the V Premium gift flow.',
      )
    }

    expect(giftRequest.eligibleZones).toEqual([
      {
        zoneId: 'zone-p1-gift' as GameState['zones'][number]['zoneId'],
        availableSlotIds: [
          'gift-left' as ZoneSlotId,
          'gift-right' as ZoneSlotId,
        ],
      },
    ])
  })

  it('continues V Premium gift resolution through the shared choice-response path without custom engine duplication', () => {
    const state = makeVPremiumState()
    const rideResult = dispatchVPremiumCommand(state, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-v-premium-ride-continue-1' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-hand-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: state.revision,
      },
    })
    const acceptedRideResult = expectAccepted(rideResult)
    const pendingRequest = acceptedRideResult.pendingRequests[0]

    if (pendingRequest?.type !== 'choose.zone') {
      throw new Error(
        'Expected a choose.zone gift request after a V Premium ride.',
      )
    }

    const resolutionResult = dispatchVPremiumCommand(acceptedRideResult.state, {
      kind: 'choice_response',
      submission: {
        response: {
          requestId: pendingRequest.requestId,
          responderPlayerId:
            'player-1' as GameState['players'][number]['playerId'],
          type: 'answer.zone',
          selectedLocations: [
            {
              zoneId: 'zone-p1-gift' as GameState['zones'][number]['zoneId'],
              slotId: 'gift-left' as ZoneSlotId,
            },
          ],
        },
        expectedRevision: acceptedRideResult.state.revision,
      },
    })
    const acceptedResolutionResult = expectAccepted(resolutionResult)

    expect(acceptedResolutionResult.state.status).toBe('in_progress')
    expect(acceptedResolutionResult.pendingRequests).toEqual([])
    expect(acceptedResolutionResult.events.map((event) => event.type)).toEqual([
      'choice.response_resolved',
    ])
  })

  it('preserves core pending-request blocking and format mismatch semantics', () => {
    const pendingRequest = makePendingRequest()
    const blockedState = makeVPremiumState({
      pendingRequests: [pendingRequest],
      includeGiftZone: false,
    })
    const blockedResult = dispatchVPremiumCommand(blockedState, {
      kind: 'action',
      submission: {
        action: {
          actionId: 'action-v-premium-ride-blocked-1' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-hand-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-p1-hand' as GameState['zones'][number]['zoneId'],
          },
          to: {
            zoneId: 'zone-p1-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: blockedState.revision,
      },
    })

    expect(blockedResult.status).toBe('blocked')

    const mismatchedFormatState = makeVPremiumState({
      formatId: 'standard' as FormatId,
      includeGiftZone: false,
    })
    const mismatchedFormatResult = dispatchVPremiumCommand(
      mismatchedFormatState,
      {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-v-premium-format-mismatch-1' as ActionId,
            type: 'match.ready',
            actor: {
              kind: 'player',
              playerId: 'player-1' as GameState['players'][number]['playerId'],
            },
          },
        },
      },
    )

    expectInvalid(mismatchedFormatResult)
    expect(mismatchedFormatResult.status).toBe('invalid')
    if (mismatchedFormatResult.status === 'invalid') {
      expect(mismatchedFormatResult.code).toBe('format_mismatch')
    }
  })
})
