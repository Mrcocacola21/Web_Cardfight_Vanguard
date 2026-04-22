import type {
  ActionId,
  EventId,
  PieceId,
  PlayerId,
  RequestId,
  RequestOptionId,
  ZoneId,
  ZoneSlotId,
} from '../contracts'
import { assertRulesInvariant } from '../errors'
import type { TargetReference, ZoneLocationReference } from '../references'

export type RequestPurpose =
  | 'cost'
  | 'target'
  | 'effect'
  | 'turn_flow'
  | 'battle'
  | 'rule'
  | (string & {})

export type RequestVisibility = 'responder-only' | 'public' | (string & {})
export type ChoiceResponseSkipReason =
  | 'pass'
  | 'decline'
  | 'cancel'
  | (string & {})
export type RequestOptionKey = string & {}

export interface RequestContext {
  readonly sourceActionId?: ActionId
  readonly sourceEventId?: EventId
  readonly relatedPieceIds?: readonly PieceId[]
  readonly relatedZoneIds?: readonly ZoneId[]
}

interface GameChoiceRequestBase<TType extends GameChoiceRequestType> {
  readonly requestId: RequestId
  readonly type: TType
  readonly responderPlayerId: PlayerId
  readonly purpose: RequestPurpose
  readonly visibility: RequestVisibility
  readonly allowPass?: boolean
  readonly context?: RequestContext
}

interface SelectionChoiceRequestBase<
  TType extends SelectionChoiceRequestType,
> extends GameChoiceRequestBase<TType> {
  readonly minSelections: number
  readonly maxSelections: number
}

export interface ZoneChoiceOption {
  readonly zoneId: ZoneId
  readonly availableSlotIds?: readonly ZoneSlotId[]
}

export interface ChoiceOptionDefinition {
  readonly optionId: RequestOptionId
  readonly key: RequestOptionKey
}

export interface ChoosePiecesRequest extends SelectionChoiceRequestBase<'choose.pieces'> {
  readonly eligiblePieceIds: readonly PieceId[]
  readonly fromZoneIds?: readonly ZoneId[]
}

export interface ChooseTargetRequest extends SelectionChoiceRequestBase<'choose.target'> {
  readonly eligibleTargets: readonly TargetReference[]
}

export interface ChooseZoneRequest extends SelectionChoiceRequestBase<'choose.zone'> {
  readonly eligibleZones: readonly ZoneChoiceOption[]
}

export interface ChooseOptionRequest extends SelectionChoiceRequestBase<'choose.option'> {
  readonly options: readonly ChoiceOptionDefinition[]
}

export interface ConfirmBooleanRequest extends GameChoiceRequestBase<'confirm.boolean'> {
  readonly defaultAnswer?: boolean
}

export type SelectionChoiceRequestType =
  | 'choose.pieces'
  | 'choose.target'
  | 'choose.zone'
  | 'choose.option'

export type GameChoiceRequestType =
  | SelectionChoiceRequestType
  | 'confirm.boolean'

export type ChoiceRequestType = GameChoiceRequestType

export type SelectionChoiceRequest =
  | ChoosePiecesRequest
  | ChooseTargetRequest
  | ChooseZoneRequest
  | ChooseOptionRequest

export type GameChoiceRequest = SelectionChoiceRequest | ConfirmBooleanRequest

export type PendingGameChoiceRequest = GameChoiceRequest

interface GameChoiceResponseBase<TType extends GameChoiceResponseType> {
  readonly requestId: RequestId
  readonly responderPlayerId: PlayerId
  readonly type: TType
}

export interface PiecesChosenResponse extends GameChoiceResponseBase<'answer.pieces'> {
  readonly selectedPieceIds: readonly PieceId[]
}

export interface TargetChosenResponse extends GameChoiceResponseBase<'answer.target'> {
  readonly selectedTargets: readonly TargetReference[]
}

export interface ZoneChosenResponse extends GameChoiceResponseBase<'answer.zone'> {
  readonly selectedLocations: readonly ZoneLocationReference[]
}

export interface OptionChosenResponse extends GameChoiceResponseBase<'answer.option'> {
  readonly selectedOptionIds: readonly RequestOptionId[]
}

export interface BooleanChoiceResponse extends GameChoiceResponseBase<'answer.boolean'> {
  readonly accepted: boolean
}

export interface PassChoiceResponse extends GameChoiceResponseBase<'answer.pass'> {
  readonly reason: ChoiceResponseSkipReason
}

export type SelectionChoiceResponse =
  | PiecesChosenResponse
  | TargetChosenResponse
  | ZoneChosenResponse
  | OptionChosenResponse

export type GameChoiceResponseType =
  | 'answer.pieces'
  | 'answer.target'
  | 'answer.zone'
  | 'answer.option'
  | 'answer.boolean'
  | 'answer.pass'

export type ChoiceResponseType = GameChoiceResponseType

export type GameChoiceResponse =
  | SelectionChoiceResponse
  | BooleanChoiceResponse
  | PassChoiceResponse

export function isSelectionChoiceRequest(
  request: GameChoiceRequest,
): request is SelectionChoiceRequest {
  return request.type !== 'confirm.boolean'
}

export function isPassChoiceResponse(
  response: GameChoiceResponse,
): response is PassChoiceResponse {
  return response.type === 'answer.pass'
}

export function assertGameChoiceRequestInvariant(
  request: GameChoiceRequest,
): void {
  assertContextInvariant(request.context)

  switch (request.type) {
    case 'choose.pieces': {
      assertSelectionRequestBounds(request)
      assertUniqueStrings(
        request.eligiblePieceIds.map((pieceId) => pieceId as string),
        `Choice request ${request.requestId} must not repeat eligible piece ids.`,
      )
      if (request.fromZoneIds !== undefined) {
        assertUniqueStrings(
          request.fromZoneIds.map((zoneId) => zoneId as string),
          `Choice request ${request.requestId} must not repeat source zone ids.`,
        )
      }
      return
    }
    case 'choose.target': {
      assertSelectionRequestBounds(request)
      assertUniqueStrings(
        request.eligibleTargets.map(serializeTarget),
        `Choice request ${request.requestId} must not repeat eligible targets.`,
      )
      return
    }
    case 'choose.zone': {
      assertSelectionRequestBounds(request)
      assertUniqueStrings(
        request.eligibleZones.map((zone) => zone.zoneId as string),
        `Choice request ${request.requestId} must not repeat eligible zones.`,
      )
      for (const zone of request.eligibleZones) {
        if (zone.availableSlotIds !== undefined) {
          assertUniqueStrings(
            zone.availableSlotIds.map((slotId) => slotId as string),
            `Choice request ${request.requestId} must not repeat eligible slot ids for zone ${zone.zoneId}.`,
          )
        }
      }
      return
    }
    case 'choose.option': {
      assertSelectionRequestBounds(request)
      assertUniqueStrings(
        request.options.map((option) => option.optionId as string),
        `Choice request ${request.requestId} must not repeat option ids.`,
      )
      assertUniqueStrings(
        request.options.map((option) => option.key),
        `Choice request ${request.requestId} must not repeat option keys.`,
      )
      return
    }
    case 'confirm.boolean':
      return
  }
}

export function assertGameChoiceResponseInvariant(
  response: GameChoiceResponse,
): void {
  switch (response.type) {
    case 'answer.pieces':
      assertNonEmptyUniqueStrings(
        response.selectedPieceIds.map((pieceId) => pieceId as string),
        `Choice response ${response.requestId} must contain at least one unique selected piece id.`,
      )
      return
    case 'answer.target':
      assertNonEmptyUniqueStrings(
        response.selectedTargets.map(serializeTarget),
        `Choice response ${response.requestId} must contain at least one unique selected target.`,
      )
      return
    case 'answer.zone':
      assertNonEmptyUniqueStrings(
        response.selectedLocations.map(serializeLocation),
        `Choice response ${response.requestId} must contain at least one unique selected zone location.`,
      )
      return
    case 'answer.option':
      assertNonEmptyUniqueStrings(
        response.selectedOptionIds.map((optionId) => optionId as string),
        `Choice response ${response.requestId} must contain at least one unique selected option id.`,
      )
      return
    case 'answer.boolean':
    case 'answer.pass':
      return
  }
}

export function assertChoiceResponseMatchesRequest(
  request: GameChoiceRequest,
  response: GameChoiceResponse,
): void {
  assertGameChoiceRequestInvariant(request)
  assertGameChoiceResponseInvariant(response)

  assertRulesInvariant(
    response.requestId === request.requestId,
    `Choice response ${response.requestId} does not match request ${request.requestId}.`,
  )
  assertRulesInvariant(
    response.responderPlayerId === request.responderPlayerId,
    `Choice response ${response.requestId} does not match request responder ${request.responderPlayerId}.`,
  )

  if (response.type === 'answer.pass') {
    assertRulesInvariant(
      request.allowPass === true,
      `Choice request ${request.requestId} does not allow pass responses.`,
    )
    return
  }

  switch (request.type) {
    case 'choose.pieces':
      assertRulesInvariant(
        response.type === 'answer.pieces',
        `Choice request ${request.requestId} expects a piece-selection response.`,
      )
      assertSelectionCount(
        response.selectedPieceIds.length,
        request.minSelections,
        request.maxSelections,
        request.requestId,
      )
      assertAllowedValues(
        response.selectedPieceIds.map((pieceId) => pieceId as string),
        request.eligiblePieceIds.map((pieceId) => pieceId as string),
        request.requestId,
        'piece ids',
      )
      return
    case 'choose.target':
      assertRulesInvariant(
        response.type === 'answer.target',
        `Choice request ${request.requestId} expects a target-selection response.`,
      )
      assertSelectionCount(
        response.selectedTargets.length,
        request.minSelections,
        request.maxSelections,
        request.requestId,
      )
      assertAllowedValues(
        response.selectedTargets.map(serializeTarget),
        request.eligibleTargets.map(serializeTarget),
        request.requestId,
        'targets',
      )
      return
    case 'choose.zone':
      assertRulesInvariant(
        response.type === 'answer.zone',
        `Choice request ${request.requestId} expects a zone-selection response.`,
      )
      assertSelectionCount(
        response.selectedLocations.length,
        request.minSelections,
        request.maxSelections,
        request.requestId,
      )
      assertZoneResponseAllowed(request, response)
      return
    case 'choose.option':
      assertRulesInvariant(
        response.type === 'answer.option',
        `Choice request ${request.requestId} expects an option-selection response.`,
      )
      assertSelectionCount(
        response.selectedOptionIds.length,
        request.minSelections,
        request.maxSelections,
        request.requestId,
      )
      assertAllowedValues(
        response.selectedOptionIds.map((optionId) => optionId as string),
        request.options.map((option) => option.optionId as string),
        request.requestId,
        'option ids',
      )
      return
    case 'confirm.boolean':
      assertRulesInvariant(
        response.type === 'answer.boolean',
        `Choice request ${request.requestId} expects a boolean response.`,
      )
      return
  }
}

function assertContextInvariant(context: RequestContext | undefined): void {
  if (context === undefined) {
    return
  }

  if (context.relatedPieceIds !== undefined) {
    assertUniqueStrings(
      context.relatedPieceIds.map((pieceId) => pieceId as string),
      'Choice request context must not repeat related piece ids.',
    )
  }

  if (context.relatedZoneIds !== undefined) {
    assertUniqueStrings(
      context.relatedZoneIds.map((zoneId) => zoneId as string),
      'Choice request context must not repeat related zone ids.',
    )
  }
}

function assertSelectionRequestBounds(request: SelectionChoiceRequest): void {
  assertRulesInvariant(
    Number.isSafeInteger(request.minSelections) && request.minSelections >= 0,
    `Choice request ${request.requestId} must declare a non-negative safe minSelections value.`,
  )
  assertRulesInvariant(
    Number.isSafeInteger(request.maxSelections) && request.maxSelections >= 0,
    `Choice request ${request.requestId} must declare a non-negative safe maxSelections value.`,
  )
  assertRulesInvariant(
    request.maxSelections >= request.minSelections,
    `Choice request ${request.requestId} must not declare maxSelections below minSelections.`,
  )

  const optionCount = getRequestOptionCount(request)
  assertRulesInvariant(
    optionCount >= request.minSelections,
    `Choice request ${request.requestId} does not have enough eligible options for its minSelections requirement.`,
  )
  assertRulesInvariant(
    optionCount >= request.maxSelections,
    `Choice request ${request.requestId} does not have enough eligible options for its maxSelections requirement.`,
  )
}

function getRequestOptionCount(request: SelectionChoiceRequest): number {
  switch (request.type) {
    case 'choose.pieces':
      return request.eligiblePieceIds.length
    case 'choose.target':
      return request.eligibleTargets.length
    case 'choose.zone':
      return request.eligibleZones.length
    case 'choose.option':
      return request.options.length
  }
}

function assertZoneResponseAllowed(
  request: ChooseZoneRequest,
  response: ZoneChosenResponse,
): void {
  const zoneOptionsById = new Map(
    request.eligibleZones.map((zone) => [zone.zoneId as string, zone] as const),
  )

  for (const selection of response.selectedLocations) {
    const zoneOption = zoneOptionsById.get(selection.zoneId)

    assertRulesInvariant(
      zoneOption !== undefined,
      `Choice response ${response.requestId} selected zone ${selection.zoneId} that is not eligible.`,
    )

    if (selection.slotId !== undefined) {
      assertRulesInvariant(
        zoneOption.availableSlotIds !== undefined,
        `Choice response ${response.requestId} selected slot ${selection.slotId} for zone ${selection.zoneId}, but slot selection is not allowed there.`,
      )
      assertRulesInvariant(
        zoneOption.availableSlotIds.includes(selection.slotId),
        `Choice response ${response.requestId} selected slot ${selection.slotId} that is not eligible for zone ${selection.zoneId}.`,
      )
    }

    assertRulesInvariant(
      selection.position === undefined,
      `Choice response ${response.requestId} selected an ordered position for zone ${selection.zoneId}, but position selection is not part of the current request foundation.`,
    )
  }
}

function assertSelectionCount(
  selectionCount: number,
  minSelections: number,
  maxSelections: number,
  requestId: RequestId,
): void {
  assertRulesInvariant(
    selectionCount >= minSelections,
    `Choice response ${requestId} selected fewer items than required.`,
  )
  assertRulesInvariant(
    selectionCount <= maxSelections,
    `Choice response ${requestId} selected more items than allowed.`,
  )
}

function assertAllowedValues(
  selectedValues: readonly string[],
  allowedValues: readonly string[],
  requestId: RequestId,
  label: string,
): void {
  const allowedValueSet = new Set(allowedValues)

  for (const selectedValue of selectedValues) {
    assertRulesInvariant(
      allowedValueSet.has(selectedValue),
      `Choice response ${requestId} selected ${label} value ${selectedValue} that is not allowed.`,
    )
  }
}

function assertUniqueStrings(values: readonly string[], message: string): void {
  assertRulesInvariant(new Set(values).size === values.length, message)
}

function assertNonEmptyUniqueStrings(
  values: readonly string[],
  message: string,
): void {
  assertRulesInvariant(values.length > 0, message)
  assertUniqueStrings(values, message)
}

function serializeTarget(target: TargetReference): string {
  return target.kind === 'player'
    ? `player:${target.playerId}`
    : `piece:${target.pieceId}`
}

function serializeLocation(location: ZoneLocationReference): string {
  return `${location.zoneId}:${location.slotId ?? ''}:${location.position ?? ''}`
}
