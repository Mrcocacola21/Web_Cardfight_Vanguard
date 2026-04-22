import { describe, expect, expectTypeOf, it } from 'vitest'

import type { CardId, FormatId } from '@web-vg/shared'

import { RulesInvariantError } from '../errors'
import type {
  ChoiceRequestType,
  ChoiceResponseType,
  ChoosePiecesRequest,
  ChooseTargetRequest,
  ChooseZoneRequest,
  ConfirmBooleanRequest,
  GameChoiceRequest,
  GameChoiceResponse,
  GameState,
  PassChoiceResponse,
  PieceId,
  PlayerId,
  RequestId,
  RequestOptionId,
  TargetChosenResponse,
  TargetReference,
  ZoneChosenResponse,
  ZoneId,
  ZoneLocationReference,
  ZoneSlotId,
} from '../index'
import {
  assertChoiceResponseMatchesRequest,
  assertGameChoiceRequestInvariant,
  assertGameChoiceResponseInvariant,
  assertGameStateInvariant,
  isPassChoiceResponse,
  isSelectionChoiceRequest,
} from '../index'

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue
  ? true
  : false

type ExpectedRequestTypes =
  | 'choose.pieces'
  | 'choose.target'
  | 'choose.zone'
  | 'choose.option'
  | 'confirm.boolean'

type ExpectedResponseTypes =
  | 'answer.pieces'
  | 'answer.target'
  | 'answer.zone'
  | 'answer.option'
  | 'answer.boolean'
  | 'answer.pass'

function makeChoosePiecesRequest(): ChoosePiecesRequest {
  return {
    requestId: 'request-pieces-1' as RequestId,
    type: 'choose.pieces',
    responderPlayerId: 'player-1' as PlayerId,
    purpose: 'cost',
    visibility: 'responder-only',
    minSelections: 1,
    maxSelections: 2,
    eligiblePieceIds: ['piece-1' as PieceId, 'piece-2' as PieceId],
    fromZoneIds: ['zone-hand' as ZoneId],
    context: {
      relatedPieceIds: ['piece-1' as PieceId],
      relatedZoneIds: ['zone-hand' as ZoneId],
    },
  }
}

function makeChooseTargetRequest(): ChooseTargetRequest {
  return {
    requestId: 'request-target-1' as RequestId,
    type: 'choose.target',
    responderPlayerId: 'player-1' as PlayerId,
    purpose: 'target',
    visibility: 'public',
    minSelections: 1,
    maxSelections: 1,
    eligibleTargets: [
      {
        kind: 'piece',
        pieceId: 'piece-2' as PieceId,
      },
      {
        kind: 'player',
        playerId: 'player-2' as PlayerId,
      },
    ],
  }
}

function makeChooseZoneRequest(): ChooseZoneRequest {
  return {
    requestId: 'request-zone-1' as RequestId,
    type: 'choose.zone',
    responderPlayerId: 'player-1' as PlayerId,
    purpose: 'effect',
    visibility: 'responder-only',
    minSelections: 1,
    maxSelections: 1,
    eligibleZones: [
      {
        zoneId: 'zone-field' as ZoneId,
        availableSlotIds: [
          'slot-left' as ZoneSlotId,
          'slot-right' as ZoneSlotId,
        ],
      },
    ],
  }
}

function makePendingRequestState(
  pendingRequests: readonly GameChoiceRequest[],
): GameState {
  return {
    gameId: 'game-1' as GameState['gameId'],
    formatId: 'standard' as FormatId,
    status: 'awaiting_choice',
    revision: 0,
    turn: {
      turnNumber: 1,
      turnPlayerId: 'player-1' as PlayerId,
      priorityPlayerId: 'player-1' as PlayerId,
      phase: 'main',
      step: 'action-window',
    },
    players: [
      {
        playerId: 'player-1' as PlayerId,
        seat: 0,
        status: 'active',
        ownedZoneIds: ['zone-hand' as ZoneId, 'zone-field' as ZoneId],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as PlayerId,
        seat: 1,
        status: 'waiting',
        ownedZoneIds: ['zone-opponent-field' as ZoneId],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-hand' as ZoneId,
        kind: 'hand',
        scope: 'player',
        ownerPlayerId: 'player-1' as PlayerId,
        visibility: 'owner-private',
        layout: {
          ordering: 'unordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId: 'piece-1' as PieceId,
          },
        ],
      },
      {
        zoneId: 'zone-field' as ZoneId,
        kind: 'field',
        scope: 'player',
        ownerPlayerId: 'player-1' as PlayerId,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'slotted',
          slotIds: ['slot-left' as ZoneSlotId, 'slot-right' as ZoneSlotId],
        },
        occupants: [],
      },
      {
        zoneId: 'zone-opponent-field' as ZoneId,
        kind: 'field',
        scope: 'player',
        ownerPlayerId: 'player-2' as PlayerId,
        visibility: 'public',
        layout: {
          ordering: 'unordered',
          occupancy: 'single',
        },
        occupants: [
          {
            pieceId: 'piece-2' as PieceId,
          },
        ],
      },
    ],
    pieces: [
      {
        pieceId: 'piece-1' as PieceId,
        kind: 'card',
        cardDefinitionId: 'card-1' as CardId,
        ownerPlayerId: 'player-1' as PlayerId,
        controllerPlayerId: 'player-1' as PlayerId,
      },
      {
        pieceId: 'piece-2' as PieceId,
        kind: 'card',
        cardDefinitionId: 'card-2' as CardId,
        ownerPlayerId: 'player-2' as PlayerId,
        controllerPlayerId: 'player-2' as PlayerId,
      },
    ],
    flags: [],
    pendingRequests,
  }
}

describe('@web-vg/rules-core choice/request model', () => {
  it('publishes a stable request and response vocabulary', () => {
    expectTypeOf<ChoiceRequestType>().toEqualTypeOf<ExpectedRequestTypes>()
    expectTypeOf<
      GameChoiceRequest['type']
    >().toEqualTypeOf<ExpectedRequestTypes>()
    expectTypeOf<ChoiceResponseType>().toEqualTypeOf<ExpectedResponseTypes>()
    expectTypeOf<
      GameChoiceResponse['type']
    >().toEqualTypeOf<ExpectedResponseTypes>()
  })

  it('keeps request responders and selectable references aligned with gameplay ids', () => {
    expectTypeOf<
      ChoosePiecesRequest['eligiblePieceIds'][number]
    >().toEqualTypeOf<PieceId>()
    expectTypeOf<
      ChooseTargetRequest['eligibleTargets'][number]
    >().toEqualTypeOf<TargetReference>()
    expectTypeOf<
      ChooseZoneRequest['eligibleZones'][number]['zoneId']
    >().toEqualTypeOf<ZoneId>()
    expectTypeOf<
      TargetChosenResponse['selectedTargets'][number]
    >().toEqualTypeOf<TargetReference>()
    expectTypeOf<
      ZoneChosenResponse['selectedLocations'][number]
    >().toEqualTypeOf<ZoneLocationReference>()
    expectTypeOf<
      ConfirmBooleanRequest['responderPlayerId']
    >().toEqualTypeOf<PlayerId>()
    expectTypeOf<RequestOptionId>().toMatchTypeOf<string>()
  })

  it('stays separate from actions, events, UI, and persistence concerns', () => {
    expectTypeOf<HasKey<GameChoiceRequest, 'actionId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameChoiceRequest, 'eventId'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameChoiceRequest, 'sequence'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameChoiceRequest, 'payload'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameChoiceRequest, 'onClick'>>().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameChoiceRequest, 'clientX'>>().toEqualTypeOf<false>()
    expectTypeOf<
      HasKey<GameChoiceRequest, 'cardPrintingId'>
    >().toEqualTypeOf<false>()
    expectTypeOf<HasKey<GameChoiceResponse, 'action'>>().toEqualTypeOf<false>()
    expectTypeOf<
      HasKey<GameChoiceResponse, 'sourceEventId'>
    >().toEqualTypeOf<false>()
  })

  it('validates a coherent request-response pair and exposes response helpers', () => {
    const request = makeChoosePiecesRequest()
    const response: GameChoiceResponse = {
      requestId: request.requestId,
      responderPlayerId: request.responderPlayerId,
      type: 'answer.pieces',
      selectedPieceIds: ['piece-1' as PieceId],
    }
    const passResponse: PassChoiceResponse = {
      requestId: 'request-yes-no-1' as RequestId,
      responderPlayerId: 'player-1' as PlayerId,
      type: 'answer.pass',
      reason: 'decline',
    }

    expect(isSelectionChoiceRequest(request)).toBe(true)
    expect(isPassChoiceResponse(passResponse)).toBe(true)
    expect(() => assertGameChoiceRequestInvariant(request)).not.toThrow()
    expect(() => assertGameChoiceResponseInvariant(response)).not.toThrow()
    expect(() =>
      assertChoiceResponseMatchesRequest(request, response),
    ).not.toThrow()
  })

  it('rejects responses that do not satisfy request constraints', () => {
    const request = makeChooseZoneRequest()
    const invalidSlotResponse: GameChoiceResponse = {
      requestId: request.requestId,
      responderPlayerId: request.responderPlayerId,
      type: 'answer.zone',
      selectedLocations: [
        {
          zoneId: 'zone-field' as ZoneId,
          slotId: 'slot-vanguard' as ZoneSlotId,
        },
      ],
    }
    const invalidPositionResponse: GameChoiceResponse = {
      requestId: request.requestId,
      responderPlayerId: request.responderPlayerId,
      type: 'answer.zone',
      selectedLocations: [
        {
          zoneId: 'zone-field' as ZoneId,
          position: 0,
        },
      ],
    }

    expect(() =>
      assertChoiceResponseMatchesRequest(request, invalidSlotResponse),
    ).toThrow(RulesInvariantError)
    expect(() =>
      assertChoiceResponseMatchesRequest(request, invalidPositionResponse),
    ).toThrow(RulesInvariantError)
  })

  it('allows pending requests to live inside game state and validates their state references', () => {
    const request = makeChooseTargetRequest()
    const validState = makePendingRequestState([request])
    const invalidState = makePendingRequestState([
      {
        ...request,
        eligibleTargets: [
          {
            kind: 'piece',
            pieceId: 'piece-missing' as PieceId,
          },
        ],
      },
    ])

    expect(() => assertGameStateInvariant(validState)).not.toThrow()
    expect(() => assertGameStateInvariant(invalidState)).toThrow(
      RulesInvariantError,
    )
  })
})
