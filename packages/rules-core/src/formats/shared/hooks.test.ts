import { describe, expect, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import type { ActionId, GameState } from '../../index'
import { isInvalidTransitionResult } from '../../index'

import {
  prepareFormatOverlayCardAction,
  rejectZoneKindReferences,
} from './hooks'

function makeHookState(
  options: { readonly occupiedHeart?: boolean } = {},
): GameState {
  const occupiedHeart = options.occupiedHeart ?? false

  return {
    gameId: 'game-format-hooks-1' as GameState['gameId'],
    formatId: 'premium' as FormatId,
    status: 'in_progress',
    revision: 2,
    turn: {
      turnNumber: 2,
      turnPlayerId: 'player-1' as GameState['turn']['turnPlayerId'],
      priorityPlayerId: 'player-1' as NonNullable<
        GameState['turn']['priorityPlayerId']
      >,
      phase: 'main' as GameState['turn']['phase'],
      step: 'main' as NonNullable<GameState['turn']['step']>,
    },
    players: [
      {
        playerId: 'player-1' as GameState['players'][number]['playerId'],
        seat: 0,
        status: 'active',
        ownedZoneIds: [
          'zone-hand' as GameState['zones'][number]['zoneId'],
          'zone-ride' as GameState['zones'][number]['zoneId'],
          'zone-g' as GameState['zones'][number]['zoneId'],
          'zone-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-soul' as GameState['zones'][number]['zoneId'],
          'zone-heart' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-hand' as GameState['zones'][number]['zoneId'],
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [],
      },
      {
        zoneId: 'zone-ride' as GameState['zones'][number]['zoneId'],
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
            pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-g' as GameState['zones'][number]['zoneId'],
        kind: 'g_zone',
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: 'piece-g' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-vanguard' as GameState['zones'][number]['zoneId'],
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
            pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-soul' as GameState['zones'][number]['zoneId'],
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
        zoneId: 'zone-heart' as GameState['zones'][number]['zoneId'],
        kind: 'heart',
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
    ],
    pieces: [
      {
        pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-ride' as CardId,
      },
      {
        pieceId: 'piece-g' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-g' as CardId,
      },
      {
        pieceId: 'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        kind: 'card',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        controllerPlayerId:
          'player-1' as GameState['players'][number]['playerId'],
        cardDefinitionId: 'card-vanguard' as CardId,
      },
      ...(occupiedHeart
        ? [
            {
              pieceId:
                'piece-heart-existing' as GameState['pieces'][number]['pieceId'],
              kind: 'card' as const,
              ownerPlayerId:
                'player-1' as GameState['players'][number]['playerId'],
              controllerPlayerId:
                'player-1' as GameState['players'][number]['playerId'],
              cardDefinitionId: 'card-heart-existing' as CardId,
            },
          ]
        : []),
    ],
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }
}

describe('@web-vg/rules-core shared format hooks', () => {
  it('lets adapters reuse the same zone-kind reference guard with different policies', () => {
    const state = makeHookState()
    const action = {
      actionId: 'action-hook-move-1' as ActionId,
      type: 'zone.move_piece' as const,
      actor: {
        kind: 'system' as const,
        system: 'automatic-flow' as const,
      },
      pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
      from: {
        zoneId: 'zone-ride' as GameState['zones'][number]['zoneId'],
        position: 0,
      },
      to: {
        zoneId: 'zone-soul' as GameState['zones'][number]['zoneId'],
      },
      reason: 'format',
    }

    const rideDeckDecision = rejectZoneKindReferences(state, action, {
      rejectedZoneKinds: ['ride_deck'],
      message: () => 'ride deck references are blocked here',
    })
    const gZoneDecision = rejectZoneKindReferences(state, action, {
      rejectedZoneKinds: ['g_zone'],
      message: () => 'g zone references are blocked here',
    })

    expect(rideDeckDecision).toMatchObject({
      status: 'invalid',
      code: 'format_rule_violation',
      message: 'ride deck references are blocked here',
    })
    expect(gZoneDecision).toBeUndefined()
  })

  it('supports shared overlay transition preparation with different adapter policies', () => {
    const standardLikeState = makeHookState()
    const standardLikeResult = prepareFormatOverlayCardAction({
      formatId: 'standard' as FormatId,
      formatLabel: 'Standard',
      currentState: standardLikeState,
      submission: {
        action: {
          actionId: 'action-hook-ride-1' as ActionId,
          type: 'card.ride',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-ride' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-ride' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-vanguard' as GameState['zones'][number]['zoneId'],
          },
          ridingOverPieceId:
            'piece-vanguard' as GameState['pieces'][number]['pieceId'],
        },
        expectedRevision: 2,
      },
      sourceKind: 'ride_deck',
      sourceLabel: 'ride deck',
      destinationKind: 'vanguard_circle',
      destinationLabel: 'vanguard circle',
      displacedZoneKind: 'soul',
      displacedLabel: 'soul',
      getExpectedDestinationPieceId: (action) => action.ridingOverPieceId,
    })

    expect(standardLikeResult.ok).toBe(true)

    if (!standardLikeResult.ok) {
      throw new Error(
        'Expected the standard-like overlay preparation to succeed.',
      )
    }

    expect(standardLikeResult.value.displacedOccupant.pieceId).toBe(
      'piece-vanguard',
    )
    expect(standardLikeResult.value.primaryRelocation.transfer.to).toEqual({
      zoneId: 'zone-vanguard' as GameState['zones'][number]['zoneId'],
    })

    const premiumBlockedResult = prepareFormatOverlayCardAction({
      formatId: 'premium' as FormatId,
      formatLabel: 'Premium',
      currentState: makeHookState({ occupiedHeart: true }),
      submission: {
        action: {
          actionId: 'action-hook-play-1' as ActionId,
          type: 'card.play',
          actor: {
            kind: 'player',
            playerId: 'player-1' as GameState['players'][number]['playerId'],
          },
          pieceId: 'piece-g' as GameState['pieces'][number]['pieceId'],
          from: {
            zoneId: 'zone-g' as GameState['zones'][number]['zoneId'],
            position: 0,
          },
          to: {
            zoneId: 'zone-vanguard' as GameState['zones'][number]['zoneId'],
          },
        },
        expectedRevision: 2,
      },
      sourceKind: 'g_zone',
      sourceLabel: 'G zone',
      destinationKind: 'vanguard_circle',
      destinationLabel: 'vanguard circle',
      displacedZoneKind: 'heart',
      displacedLabel: 'heart zone',
      displacedZoneMustBeEmpty: true,
    })

    expect(premiumBlockedResult.ok).toBe(false)

    if (premiumBlockedResult.ok) {
      throw new Error('Expected the premium-like overlay preparation to fail.')
    }

    expect(isInvalidTransitionResult(premiumBlockedResult.result)).toBe(true)
    if (isInvalidTransitionResult(premiumBlockedResult.result)) {
      expect(premiumBlockedResult.result.message).toMatch(/heart zone/i)
    }
  })
})
