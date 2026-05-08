import { describe, expect, it } from 'vitest'

import type {
  ActionId,
  EngineDispatchResult,
  GameState,
  RequestId,
  ZoneSlotId,
} from '../index'
import {
  PREMIUM_FORMAT_ID,
  PREMIUM_ZONE_KINDS,
  STANDARD_FORMAT_ID,
  V_PREMIUM_FORMAT_ID,
  isAcceptedEngineDispatchResult,
  isBlockedEngineDispatchResult,
  isInvalidEngineDispatchResult,
  premiumFormatAdapter,
  standardFormatAdapter,
  vPremiumFormatAdapter,
} from '../index'

import { rejectZoneKindReferences } from './shared'
import {
  makePremiumSmokeState,
  makeSmokeBlockingRequest,
  makeStandardSmokeState,
  makeVPremiumSmokeState,
} from './smoke-fixtures'

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

describe('@web-vg/rules-core format adapter smoke checkpoint', () => {
  it('loads all three adapters over the same contract and delegates generic start flow through the core transition boundary', () => {
    expect(standardFormatAdapter.formatId).toBe(STANDARD_FORMAT_ID)
    expect(vPremiumFormatAdapter.formatId).toBe(V_PREMIUM_FORMAT_ID)
    expect(premiumFormatAdapter.formatId).toBe(PREMIUM_FORMAT_ID)

    const standardStart = expectAccepted(
      standardFormatAdapter.dispatch(
        makeStandardSmokeState({ status: 'ready' }),
        {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-standard-smoke-start-1' as ActionId,
              type: 'match.start',
              actor: {
                kind: 'system',
                system: 'match-setup',
              },
            },
            expectedRevision: 0,
          },
        },
      ),
    )
    const vPremiumStart = expectAccepted(
      vPremiumFormatAdapter.dispatch(
        makeVPremiumSmokeState({ status: 'ready' }),
        {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-v-premium-smoke-start-1' as ActionId,
              type: 'match.start',
              actor: {
                kind: 'system',
                system: 'match-setup',
              },
            },
            expectedRevision: 0,
          },
        },
      ),
    )
    const premiumStart = expectAccepted(
      premiumFormatAdapter.dispatch(
        makePremiumSmokeState({ status: 'ready' }),
        {
          kind: 'action',
          submission: {
            action: {
              actionId: 'action-premium-smoke-start-1' as ActionId,
              type: 'match.start',
              actor: {
                kind: 'system',
                system: 'match-setup',
              },
            },
            expectedRevision: 0,
          },
        },
      ),
    )

    expect(standardStart.state.status).toBe('in_progress')
    expect(vPremiumStart.state.status).toBe('in_progress')
    expect(premiumStart.state.status).toBe('in_progress')
    expect(standardStart.events.map((event) => event.type)).toEqual([
      'match.started',
      'turn.started',
    ])
    expect(vPremiumStart.events.map((event) => event.type)).toEqual([
      'match.started',
      'turn.started',
    ])
    expect(premiumStart.events.map((event) => event.type)).toEqual([
      'match.started',
      'turn.started',
    ])
  })

  it('runs one representative format-owned happy path per adapter without flattening their behavior', () => {
    const standardRide = expectAccepted(
      standardFormatAdapter.dispatch(makeStandardSmokeState(), {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-standard-smoke-ride-1' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: 'player-1' as GameState['players'][number]['playerId'],
            },
            pieceId:
              'piece-standard-ride' as GameState['pieces'][number]['pieceId'],
            from: {
              zoneId:
                'zone-standard-p1-ride' as GameState['zones'][number]['zoneId'],
              position: 0,
            },
            to: {
              zoneId:
                'zone-standard-p1-vanguard' as GameState['zones'][number]['zoneId'],
            },
            ridingOverPieceId:
              'piece-standard-vanguard' as GameState['pieces'][number]['pieceId'],
          },
          expectedRevision: 3,
        },
      }),
    )
    const vPremiumRide = expectAccepted(
      vPremiumFormatAdapter.dispatch(makeVPremiumSmokeState(), {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-v-premium-smoke-ride-1' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: 'player-1' as GameState['players'][number]['playerId'],
            },
            pieceId:
              'piece-vp-hand-ride' as GameState['pieces'][number]['pieceId'],
            from: {
              zoneId: 'zone-vp-p1-hand' as GameState['zones'][number]['zoneId'],
            },
            to: {
              zoneId:
                'zone-vp-p1-vanguard' as GameState['zones'][number]['zoneId'],
            },
            ridingOverPieceId:
              'piece-vp-vanguard' as GameState['pieces'][number]['pieceId'],
          },
          expectedRevision: 4,
        },
      }),
    )
    const premiumPlay = expectAccepted(
      premiumFormatAdapter.dispatch(makePremiumSmokeState(), {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-premium-smoke-play-1' as ActionId,
            type: 'card.play',
            actor: {
              kind: 'player',
              playerId: 'player-1' as GameState['players'][number]['playerId'],
            },
            pieceId:
              'piece-premium-g-unit' as GameState['pieces'][number]['pieceId'],
            from: {
              zoneId:
                'zone-premium-p1-g' as GameState['zones'][number]['zoneId'],
              position: 0,
            },
            to: {
              zoneId:
                'zone-premium-p1-vanguard' as GameState['zones'][number]['zoneId'],
            },
          },
          expectedRevision: 5,
        },
      }),
    )

    expect(standardRide.pendingRequests).toEqual([])
    expect(standardRide.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
    ])
    expect(
      standardRide.state.zones.find(
        (zone) =>
          zone.zoneId ===
          ('zone-standard-p1-soul' as GameState['zones'][number]['zoneId']),
      )?.occupants,
    ).toEqual([
      {
        pieceId:
          'piece-standard-vanguard' as GameState['pieces'][number]['pieceId'],
      },
    ])

    expect(vPremiumRide.state.status).toBe('awaiting_choice')
    expect(vPremiumRide.pendingRequests).toHaveLength(1)
    expect(vPremiumRide.pendingRequests[0]?.type).toBe('choose.zone')
    expect(vPremiumRide.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.rode',
    ])

    expect(premiumPlay.pendingRequests).toEqual([])
    expect(premiumPlay.events.map((event) => event.type)).toEqual([
      'piece.moved',
      'piece.moved',
      'card.played',
    ])
    expect(
      premiumPlay.state.zones.find(
        (zone) =>
          zone.zoneId ===
          ('zone-premium-p1-heart' as GameState['zones'][number]['zoneId']),
      )?.occupants,
    ).toEqual([
      {
        pieceId:
          'piece-premium-vanguard' as GameState['pieces'][number]['pieceId'],
      },
    ])
  })

  it('keeps valid, invalid, and blocked result paths structured under adapter composition', () => {
    const blockingRequest = makeSmokeBlockingRequest(
      'request-format-smoke-blocked-1' as RequestId,
    )
    const blockedStandardState = makeStandardSmokeState({
      pendingRequests: [blockingRequest],
    })
    const blockedStandardResult = expectBlocked(
      standardFormatAdapter.dispatch(blockedStandardState, {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-standard-smoke-blocked-1' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: 'player-1' as GameState['players'][number]['playerId'],
            },
            pieceId:
              'piece-standard-ride' as GameState['pieces'][number]['pieceId'],
            from: {
              zoneId:
                'zone-standard-p1-ride' as GameState['zones'][number]['zoneId'],
              position: 0,
            },
            to: {
              zoneId:
                'zone-standard-p1-vanguard' as GameState['zones'][number]['zoneId'],
            },
            ridingOverPieceId:
              'piece-standard-vanguard' as GameState['pieces'][number]['pieceId'],
          },
          expectedRevision: blockedStandardState.revision,
        },
      }),
    )

    const invalidVPremiumState = makeVPremiumSmokeState({
      includeGiftZone: false,
      includeRideDeckZone: true,
    })
    const invalidVPremiumResult = expectInvalid(
      vPremiumFormatAdapter.dispatch(invalidVPremiumState, {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-v-premium-smoke-invalid-1' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: 'player-1' as GameState['players'][number]['playerId'],
            },
            pieceId:
              'piece-vp-ride-deck' as GameState['pieces'][number]['pieceId'],
            from: {
              zoneId: 'zone-vp-p1-ride' as GameState['zones'][number]['zoneId'],
              position: 0,
            },
            to: {
              zoneId:
                'zone-vp-p1-vanguard' as GameState['zones'][number]['zoneId'],
            },
            ridingOverPieceId:
              'piece-vp-vanguard' as GameState['pieces'][number]['pieceId'],
          },
          expectedRevision: invalidVPremiumState.revision,
        },
      }),
    )

    const invalidPremiumState = makePremiumSmokeState({
      occupiedHeart: true,
    })
    const invalidPremiumResult = expectInvalid(
      premiumFormatAdapter.dispatch(invalidPremiumState, {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-premium-smoke-invalid-1' as ActionId,
            type: 'card.play',
            actor: {
              kind: 'player',
              playerId: 'player-1' as GameState['players'][number]['playerId'],
            },
            pieceId:
              'piece-premium-g-unit' as GameState['pieces'][number]['pieceId'],
            from: {
              zoneId:
                'zone-premium-p1-g' as GameState['zones'][number]['zoneId'],
              position: 0,
            },
            to: {
              zoneId:
                'zone-premium-p1-vanguard' as GameState['zones'][number]['zoneId'],
            },
          },
          expectedRevision: invalidPremiumState.revision,
        },
      }),
    )

    expect(blockedStandardResult.code).toBe('pending_request')
    expect(blockedStandardResult.blockingRequests).toEqual([blockingRequest])
    expect(blockedStandardResult.state).toEqual(blockedStandardState)

    expect(invalidVPremiumResult.code).toBe('format_rule_violation')
    expect(invalidVPremiumResult.events).toEqual([])
    expect(invalidVPremiumResult.state).toEqual(invalidVPremiumState)

    expect(invalidPremiumResult.code).toBe('format_rule_violation')
    expect(invalidPremiumResult.events).toEqual([])
    expect(invalidPremiumResult.state).toEqual(invalidPremiumState)
  })

  it('verifies that shared hooks stay reusable while format policies remain distinct', () => {
    const standardState = makeStandardSmokeState()
    const premiumState = makePremiumSmokeState()
    const rideDeckMoveAction = {
      actionId: 'action-format-hook-smoke-ride-deck-1' as ActionId,
      type: 'zone.move_piece' as const,
      actor: {
        kind: 'system' as const,
        system: 'automatic-flow' as const,
      },
      pieceId: 'piece-standard-ride' as GameState['pieces'][number]['pieceId'],
      from: {
        zoneId: 'zone-standard-p1-ride' as GameState['zones'][number]['zoneId'],
        position: 0,
      },
      to: {
        zoneId: 'zone-standard-p1-soul' as GameState['zones'][number]['zoneId'],
      },
      reason: 'generic',
    }
    const gZoneMoveAction = {
      actionId: 'action-format-hook-smoke-g-zone-1' as ActionId,
      type: 'zone.move_piece' as const,
      actor: {
        kind: 'system' as const,
        system: 'automatic-flow' as const,
      },
      pieceId: 'piece-premium-g-unit' as GameState['pieces'][number]['pieceId'],
      from: {
        zoneId: 'zone-premium-p1-g' as GameState['zones'][number]['zoneId'],
        position: 0,
      },
      to: {
        zoneId: 'zone-premium-p1-soul' as GameState['zones'][number]['zoneId'],
      },
      reason: 'generic',
    }

    const standardRideDeckDecision = rejectZoneKindReferences(
      standardState,
      rideDeckMoveAction,
      {
        rejectedZoneKinds: ['ride_deck'],
        message: () => 'ride deck references stay format-owned',
      },
    )
    const standardGZoneDecision = rejectZoneKindReferences(
      standardState,
      rideDeckMoveAction,
      {
        rejectedZoneKinds: [PREMIUM_ZONE_KINDS.gZone],
        message: () => 'g zone references stay format-owned',
      },
    )
    const premiumGZoneDecision = rejectZoneKindReferences(
      premiumState,
      gZoneMoveAction,
      {
        rejectedZoneKinds: [PREMIUM_ZONE_KINDS.gZone],
        message: () => 'g zone references stay format-owned',
      },
    )

    expect(standardRideDeckDecision).toMatchObject({
      status: 'invalid',
      code: 'format_rule_violation',
      message: 'ride deck references stay format-owned',
    })
    expect(standardGZoneDecision).toBeUndefined()
    expect(premiumGZoneDecision).toMatchObject({
      status: 'invalid',
      code: 'format_rule_violation',
      message: 'g zone references stay format-owned',
    })
  })

  it('continues an adapter-owned request through the shared choice-response contract without breaking the engine surface', () => {
    const rideResult = expectAccepted(
      vPremiumFormatAdapter.dispatch(makeVPremiumSmokeState(), {
        kind: 'action',
        submission: {
          action: {
            actionId: 'action-v-premium-smoke-choice-1' as ActionId,
            type: 'card.ride',
            actor: {
              kind: 'player',
              playerId: 'player-1' as GameState['players'][number]['playerId'],
            },
            pieceId:
              'piece-vp-hand-ride' as GameState['pieces'][number]['pieceId'],
            from: {
              zoneId: 'zone-vp-p1-hand' as GameState['zones'][number]['zoneId'],
            },
            to: {
              zoneId:
                'zone-vp-p1-vanguard' as GameState['zones'][number]['zoneId'],
            },
            ridingOverPieceId:
              'piece-vp-vanguard' as GameState['pieces'][number]['pieceId'],
          },
          expectedRevision: 4,
        },
      }),
    )
    const request = rideResult.pendingRequests[0]

    expect(request?.type).toBe('choose.zone')

    if (request?.type !== 'choose.zone') {
      throw new Error(
        'Expected a V Premium choose.zone request for the smoke checkpoint.',
      )
    }

    const resolutionResult = expectAccepted(
      vPremiumFormatAdapter.dispatch(rideResult.state, {
        kind: 'choice_response',
        submission: {
          response: {
            requestId: request.requestId,
            responderPlayerId:
              'player-1' as GameState['players'][number]['playerId'],
            type: 'answer.zone',
            selectedLocations: [
              {
                zoneId:
                  'zone-vp-p1-gift' as GameState['zones'][number]['zoneId'],
                slotId: 'gift-left' as ZoneSlotId,
              },
            ],
          },
          expectedRevision: rideResult.state.revision,
        },
      }),
    )

    expect(resolutionResult.state.status).toBe('in_progress')
    expect(resolutionResult.pendingRequests).toEqual([])
    expect(resolutionResult.events.map((event) => event.type)).toEqual([
      'choice.response_resolved',
    ])
  })
})
