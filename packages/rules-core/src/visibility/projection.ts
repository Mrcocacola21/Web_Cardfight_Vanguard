import type { CardId, TriggerType } from '@web-vg/shared'

import type { GameEvent } from '../events'
import type {
  ChoiceOptionDefinition,
  GameChoiceRequest,
  ZoneChoiceOption,
} from '../requests'
import type {
  BattleState,
  GamePieceFlagKey,
  GamePieceKind,
  GamePieceOrientation,
  GameState,
  PlayerCounterKey,
  PlayerFlagKey,
  PlayerState,
  VisibilityPolicy,
  ZoneKind,
  ZoneLayoutState,
  ZoneScope,
} from '../state'
import type { PieceId, PlayerId, ZoneId, ZoneSlotId } from '../contracts'
import type { AttackTarget, TargetReference } from '../references'
import type { EngineCardStatsSnapshot } from '../cards'

export type GameStateProjectionMode = 'player' | 'omniscient'
export type VisiblePieceVisibility = 'visible' | 'masked'
export type VisibleZoneContentsVisibility = 'full' | 'masked'
export type VisibleRequestVisibility = 'full' | 'redacted'
export type VisibleEventVisibility = 'public' | 'viewer-private' | 'redacted'

export interface VisibleGameState {
  readonly gameId: GameState['gameId']
  readonly formatId: GameState['formatId']
  readonly status: GameState['status']
  readonly revision: GameState['revision']
  readonly viewerPlayerId?: PlayerId
  readonly projectionMode: GameStateProjectionMode
  readonly turn: GameState['turn']
  readonly players: readonly VisiblePlayerState[]
  readonly zones: readonly VisibleZoneState[]
  readonly pieces: readonly VisibleGamePieceState[]
  readonly cardStats?: EngineCardStatsSnapshot
  readonly flags: GameState['flags']
  readonly battle?: VisibleBattleState
  readonly pendingRequests: readonly VisibleGameChoiceRequest[]
}

export interface VisiblePlayerState {
  readonly playerId: PlayerId
  readonly seat: number
  readonly status: PlayerState['status']
  readonly ownedZoneIds: readonly ZoneId[]
  readonly counters: readonly VisiblePlayerCounterState[]
  readonly flags: readonly VisiblePlayerFlagState[]
}

export interface VisiblePlayerCounterState {
  readonly key: PlayerCounterKey
  readonly amount: number
  readonly visibility: VisibilityPolicy
}

export interface VisiblePlayerFlagState {
  readonly key: PlayerFlagKey
  readonly enabled: boolean
  readonly visibility: VisibilityPolicy
}

export interface VisibleZoneState {
  readonly zoneId: ZoneId
  readonly kind: ZoneKind
  readonly scope: ZoneScope
  readonly ownerPlayerId?: PlayerId
  readonly visibility: VisibilityPolicy
  readonly contentsVisibility: VisibleZoneContentsVisibility
  readonly layout: ZoneLayoutState
  readonly occupantCount: number
  readonly occupants: readonly VisibleZoneOccupantState[]
}

export interface VisibleZoneOccupantState {
  readonly refId: string
  readonly visibility: VisiblePieceVisibility
  readonly pieceId?: PieceId
  readonly slotId?: ZoneSlotId
  readonly position: number
}

export interface VisibleGamePieceState {
  readonly refId: string
  readonly visibility: VisiblePieceVisibility
  readonly pieceId?: PieceId
  readonly kind?: GamePieceKind
  readonly cardDefinitionId?: CardId
  readonly ownerPlayerId?: PlayerId
  readonly controllerPlayerId?: PlayerId
  readonly orientation?: GamePieceOrientation
  readonly flags: readonly GamePieceFlagKey[]
  readonly powerModifier?: number
  readonly criticalModifier?: number
}

export interface VisiblePieceReference {
  readonly refId: string
  readonly visibility: VisiblePieceVisibility
  readonly pieceId?: PieceId
}

export interface VisibleRevealedCheckCardState {
  readonly piece: VisiblePieceReference
  readonly cardDefinitionId?: CardId
}

export interface VisibleBattleCheckState {
  readonly kind: NonNullable<BattleState['lastCheck']>['kind']
  readonly playerId: PlayerId
  readonly fromZoneId: ZoneId
  readonly toZoneId: ZoneId
  readonly revealedCards: readonly VisibleRevealedCheckCardState[]
  readonly triggerResolutionState: NonNullable<
    BattleState['lastCheck']
  >['triggerResolutionState']
}

export interface VisibleBattleState {
  readonly battleId: BattleState['battleId']
  readonly status: BattleState['status']
  readonly attackingPlayerId: PlayerId
  readonly defendingPlayerId: PlayerId
  readonly attacker: VisiblePieceReference
  readonly attackerZoneId: ZoneId
  readonly target: AttackTarget
  readonly boostingPiece?: VisiblePieceReference
  readonly boostingZoneId?: ZoneId
  readonly guardPieces: readonly VisiblePieceReference[]
  readonly guardZoneId?: ZoneId
  readonly guardRequestId?: BattleState['guardRequestId']
  readonly lastCheck?: VisibleBattleCheckState
  readonly combat?: BattleState['combat']
  readonly damage?: BattleState['damage']
}

export type VisibleGameChoiceRequest =
  | VisibleFullGameChoiceRequest
  | VisibleRedactedGameChoiceRequest

export interface VisibleGameChoiceRequestBase {
  readonly requestId: GameChoiceRequest['requestId']
  readonly type: GameChoiceRequest['type']
  readonly responderPlayerId: PlayerId
  readonly purpose: GameChoiceRequest['purpose']
  readonly visibility: GameChoiceRequest['visibility']
}

export interface VisibleFullGameChoiceRequest extends VisibleGameChoiceRequestBase {
  readonly visibilityToViewer: 'full'
  readonly allowPass?: boolean
  readonly minSelections?: number
  readonly maxSelections?: number
  readonly eligiblePieces?: readonly VisiblePieceReference[]
  readonly eligibleTargets?: readonly TargetReference[]
  readonly eligibleZones?: readonly ZoneChoiceOption[]
  readonly options?: readonly ChoiceOptionDefinition[]
  readonly handZoneId?: ZoneId
  readonly deckZoneId?: ZoneId
  readonly guardZoneId?: ZoneId
  readonly battleId?: BattleState['battleId']
  readonly attackerPiece?: VisiblePieceReference
  readonly checkKind?: 'drive' | 'damage'
  readonly revealedPiece?: VisiblePieceReference
  readonly triggerType?: TriggerType
  readonly powerAmount?: number
  readonly criticalAmount?: number
  readonly powerEligiblePieces?: readonly VisiblePieceReference[]
  readonly criticalEligiblePieces?: readonly VisiblePieceReference[]
  readonly standEligiblePieces?: readonly VisiblePieceReference[]
  readonly healEligiblePieces?: readonly VisiblePieceReference[]
  readonly currentDeckCount?: number
  readonly handPieces?: readonly VisiblePieceReference[]
  readonly interceptPieces?: readonly VisiblePieceReference[]
  readonly defaultAnswer?: boolean
}

export interface VisibleRedactedGameChoiceRequest extends VisibleGameChoiceRequestBase {
  readonly visibilityToViewer: 'redacted'
}

export interface VisibleGameEventDetail {
  readonly label: string
  readonly value: string
}

export interface VisibleGameEvent {
  readonly eventId: GameEvent['eventId']
  readonly sequence: GameEvent['sequence']
  readonly type: GameEvent['type']
  readonly origin: GameEvent['origin']
  readonly visibility: VisibleEventVisibility
  readonly details: readonly VisibleGameEventDetail[]
  readonly redactedFields: readonly string[]
}

export type GameStateProjectionIssueCode = 'unknown_viewer'

export type GameStateProjectionResult =
  | {
      readonly ok: true
      readonly state: VisibleGameState
    }
  | {
      readonly ok: false
      readonly code: GameStateProjectionIssueCode
      readonly message: string
    }

export type GameEventProjectionResult =
  | {
      readonly ok: true
      readonly events: readonly VisibleGameEvent[]
    }
  | {
      readonly ok: false
      readonly code: GameStateProjectionIssueCode
      readonly message: string
    }

interface PieceProjectionRecord {
  readonly ref: VisiblePieceReference
  readonly piece: VisibleGamePieceState
  readonly cardDefinitionId?: CardId
}

interface ProjectStateOptions {
  readonly mode: GameStateProjectionMode
  readonly viewerPlayerId?: PlayerId
}

export function projectGameStateForPlayer(
  state: GameState,
  viewerPlayerId: PlayerId,
): GameStateProjectionResult {
  if (!state.players.some((player) => player.playerId === viewerPlayerId)) {
    return {
      ok: false,
      code: 'unknown_viewer',
      message: `Cannot project game ${state.gameId} for unknown viewer ${viewerPlayerId}.`,
    }
  }

  return {
    ok: true,
    state: projectGameState(state, {
      mode: 'player',
      viewerPlayerId,
    }),
  }
}

export function projectGameStateForOmniscientViewer(
  state: GameState,
): VisibleGameState {
  return projectGameState(state, {
    mode: 'omniscient',
  })
}

export function projectGameEventsForPlayer(
  state: GameState,
  viewerPlayerId: PlayerId,
  events: readonly GameEvent[],
): GameEventProjectionResult {
  if (!state.players.some((player) => player.playerId === viewerPlayerId)) {
    return {
      ok: false,
      code: 'unknown_viewer',
      message: `Cannot project events for game ${state.gameId} and unknown viewer ${viewerPlayerId}.`,
    }
  }

  const projectedState = projectGameState(state, {
    mode: 'player',
    viewerPlayerId,
  })

  return {
    ok: true,
    events: events.map((event) =>
      projectGameEvent(event, projectedState, viewerPlayerId),
    ),
  }
}

export function projectGameEventsForOmniscientViewer(
  state: GameState,
  events: readonly GameEvent[],
): readonly VisibleGameEvent[] {
  const projectedState = projectGameStateForOmniscientViewer(state)

  return events.map((event) =>
    projectGameEvent(event, projectedState, undefined),
  )
}

function projectGameState(
  state: GameState,
  options: ProjectStateOptions,
): VisibleGameState {
  const canonicalPiecesById = new Map(
    state.pieces.map((piece) => [piece.pieceId as string, piece] as const),
  )
  const pieceStatusById = new Map(
    state.pieceStates.map(
      (pieceStatus) => [pieceStatus.pieceId as string, pieceStatus] as const,
    ),
  )
  const pieceProjectionByCanonicalId = new Map<string, PieceProjectionRecord>()
  const visibleCardDefinitionIds = new Set<string>()

  const zones = state.zones.map((zone) => {
    const projectedOccupants = zone.occupants.map((occupant, position) => {
      const canonicalPiece = canonicalPiecesById.get(occupant.pieceId as string)
      const pieceStatus = pieceStatusById.get(occupant.pieceId as string)
      const canSee = canViewerSeeZoneOccupant(zone, canonicalPiece, options)
      const refId = canSee
        ? (occupant.pieceId as string)
        : createMaskedPieceRefId(options.viewerPlayerId, zone.zoneId, position)
      const ref: VisiblePieceReference = {
        refId,
        visibility: canSee ? 'visible' : 'masked',
        ...(canSee ? { pieceId: occupant.pieceId } : {}),
      }
      const projectedPiece = createVisiblePiece({
        ref,
        canSee,
        ...(canonicalPiece === undefined ? {} : { canonicalPiece }),
        ...(pieceStatus === undefined ? {} : { pieceStatus }),
      })

      if (canSee && canonicalPiece?.cardDefinitionId !== undefined) {
        visibleCardDefinitionIds.add(canonicalPiece.cardDefinitionId as string)
      }

      pieceProjectionByCanonicalId.set(occupant.pieceId as string, {
        ref,
        piece: projectedPiece,
        ...(canonicalPiece?.cardDefinitionId === undefined
          ? {}
          : { cardDefinitionId: canonicalPiece.cardDefinitionId }),
      })

      return {
        refId,
        visibility: canSee ? 'visible' : 'masked',
        ...(canSee ? { pieceId: occupant.pieceId } : {}),
        ...(occupant.slotId === undefined ? {} : { slotId: occupant.slotId }),
        position,
      } satisfies VisibleZoneOccupantState
    })

    return {
      zoneId: zone.zoneId,
      kind: zone.kind,
      scope: zone.scope,
      ...(zone.ownerPlayerId === undefined
        ? {}
        : { ownerPlayerId: zone.ownerPlayerId }),
      visibility: zone.visibility,
      contentsVisibility: projectedOccupants.every(
        (occupant) => occupant.visibility === 'visible',
      )
        ? 'full'
        : 'masked',
      layout: zone.layout,
      occupantCount: zone.occupants.length,
      occupants: projectedOccupants,
    } satisfies VisibleZoneState
  })
  const pieces = Array.from(
    pieceProjectionByCanonicalId.values(),
    (record) => record.piece,
  )
  const cardStats = projectCardStats(state.cardStats, visibleCardDefinitionIds)

  return {
    gameId: state.gameId,
    formatId: state.formatId,
    status: state.status,
    revision: state.revision,
    ...(options.viewerPlayerId === undefined
      ? {}
      : { viewerPlayerId: options.viewerPlayerId }),
    projectionMode: options.mode,
    turn: state.turn,
    players: state.players.map((player) => projectPlayer(player, options)),
    zones,
    pieces,
    ...(cardStats === undefined ? {} : { cardStats }),
    flags: state.flags,
    ...(state.battle === undefined
      ? {}
      : {
          battle: projectBattleState(
            state.battle,
            pieceProjectionByCanonicalId,
          ),
        }),
    pendingRequests: state.pendingRequests.map((request) =>
      projectChoiceRequest(request, options, pieceProjectionByCanonicalId),
    ),
  }
}

function projectPlayer(
  player: PlayerState,
  options: ProjectStateOptions,
): VisiblePlayerState {
  return {
    playerId: player.playerId,
    seat: player.seat,
    status: player.status,
    ownedZoneIds: player.ownedZoneIds,
    counters: player.counters.filter((counter) =>
      canViewerSeePlayerPrivateSurface(
        counter.visibility,
        player.playerId,
        options,
      ),
    ),
    flags: player.flags.filter((flag) =>
      canViewerSeePlayerPrivateSurface(
        flag.visibility,
        player.playerId,
        options,
      ),
    ),
  }
}

function createVisiblePiece(input: {
  readonly ref: VisiblePieceReference
  readonly canSee: boolean
  readonly canonicalPiece?: GameState['pieces'][number]
  readonly pieceStatus?: GameState['pieceStates'][number]
}): VisibleGamePieceState {
  if (!input.canSee) {
    return {
      refId: input.ref.refId,
      visibility: 'masked',
      flags: [],
    }
  }

  return {
    refId: input.ref.refId,
    visibility: 'visible',
    ...(input.ref.pieceId === undefined ? {} : { pieceId: input.ref.pieceId }),
    ...(input.canonicalPiece?.kind === undefined
      ? {}
      : { kind: input.canonicalPiece.kind }),
    ...(input.canonicalPiece?.cardDefinitionId === undefined
      ? {}
      : { cardDefinitionId: input.canonicalPiece.cardDefinitionId }),
    ...(input.canonicalPiece?.ownerPlayerId === undefined
      ? {}
      : { ownerPlayerId: input.canonicalPiece.ownerPlayerId }),
    ...(input.canonicalPiece?.controllerPlayerId === undefined
      ? {}
      : { controllerPlayerId: input.canonicalPiece.controllerPlayerId }),
    ...(input.pieceStatus?.orientation === undefined
      ? {}
      : { orientation: input.pieceStatus.orientation }),
    flags: input.pieceStatus?.flags ?? [],
    ...(input.pieceStatus?.powerModifier === undefined
      ? {}
      : { powerModifier: input.pieceStatus.powerModifier }),
    ...(input.pieceStatus?.criticalModifier === undefined
      ? {}
      : { criticalModifier: input.pieceStatus.criticalModifier }),
  }
}

function projectBattleState(
  battle: BattleState,
  pieceProjectionByCanonicalId: ReadonlyMap<string, PieceProjectionRecord>,
): VisibleBattleState {
  const boostingRecord =
    battle.boostingPieceId === undefined
      ? undefined
      : pieceProjectionByCanonicalId.get(battle.boostingPieceId as string)

  return {
    battleId: battle.battleId,
    status: battle.status,
    attackingPlayerId: battle.attackingPlayerId,
    defendingPlayerId: battle.defendingPlayerId,
    attacker: resolveProjectedPieceReference(
      battle.attackerPieceId,
      pieceProjectionByCanonicalId,
    ),
    attackerZoneId: battle.attackerZoneId,
    target: battle.target,
    ...(boostingRecord === undefined
      ? {}
      : { boostingPiece: boostingRecord.ref }),
    ...(battle.boostingZoneId === undefined
      ? {}
      : { boostingZoneId: battle.boostingZoneId }),
    guardPieces: battle.guardPieceIds.map((pieceId) =>
      resolveProjectedPieceReference(pieceId, pieceProjectionByCanonicalId),
    ),
    ...(battle.guardZoneId === undefined
      ? {}
      : { guardZoneId: battle.guardZoneId }),
    ...(battle.guardRequestId === undefined
      ? {}
      : { guardRequestId: battle.guardRequestId }),
    ...(battle.lastCheck === undefined
      ? {}
      : {
          lastCheck: {
            kind: battle.lastCheck.kind,
            playerId: battle.lastCheck.playerId,
            fromZoneId: battle.lastCheck.fromZoneId,
            toZoneId: battle.lastCheck.toZoneId,
            revealedCards: battle.lastCheck.revealedCards.map((card) => ({
              piece: resolveProjectedPieceReference(
                card.pieceId,
                pieceProjectionByCanonicalId,
              ),
              ...(card.cardDefinitionId === undefined
                ? {}
                : { cardDefinitionId: card.cardDefinitionId }),
            })),
            triggerResolutionState: battle.lastCheck.triggerResolutionState,
          },
        }),
    ...(battle.combat === undefined ? {} : { combat: battle.combat }),
    ...(battle.damage === undefined ? {} : { damage: battle.damage }),
  }
}

function projectChoiceRequest(
  request: GameChoiceRequest,
  options: ProjectStateOptions,
  pieceProjectionByCanonicalId: ReadonlyMap<string, PieceProjectionRecord>,
): VisibleGameChoiceRequest {
  const canSee =
    options.mode === 'omniscient' ||
    request.visibility === 'public' ||
    request.responderPlayerId === options.viewerPlayerId

  if (canSee) {
    return {
      requestId: request.requestId,
      type: request.type,
      responderPlayerId: request.responderPlayerId,
      purpose: request.purpose,
      visibility: request.visibility,
      visibilityToViewer: 'full',
      ...(request.allowPass === undefined
        ? {}
        : { allowPass: request.allowPass }),
      ...projectFullChoiceRequestDetails(request, pieceProjectionByCanonicalId),
    }
  }

  return {
    requestId: request.requestId,
    type: request.type,
    responderPlayerId: request.responderPlayerId,
    purpose: request.purpose,
    visibility: request.visibility,
    visibilityToViewer: 'redacted',
  }
}

function projectFullChoiceRequestDetails(
  request: GameChoiceRequest,
  pieceProjectionByCanonicalId: ReadonlyMap<string, PieceProjectionRecord>,
): Omit<
  VisibleFullGameChoiceRequest,
  keyof VisibleGameChoiceRequestBase | 'visibilityToViewer' | 'allowPass'
> {
  switch (request.type) {
    case 'choose.pieces':
      return {
        minSelections: request.minSelections,
        maxSelections: request.maxSelections,
        eligiblePieces: request.eligiblePieceIds.map((pieceId) =>
          resolveProjectedPieceReference(pieceId, pieceProjectionByCanonicalId),
        ),
        ...(request.fromZoneIds === undefined
          ? {}
          : {
              eligibleZones: request.fromZoneIds.map((zoneId) => ({ zoneId })),
            }),
      }
    case 'choose.target':
      return {
        minSelections: request.minSelections,
        maxSelections: request.maxSelections,
        eligibleTargets: request.eligibleTargets,
      }
    case 'choose.zone':
      return {
        minSelections: request.minSelections,
        maxSelections: request.maxSelections,
        eligibleZones: request.eligibleZones,
      }
    case 'choose.option':
      return {
        minSelections: request.minSelections,
        maxSelections: request.maxSelections,
        options: request.options,
      }
    case 'mulligan.select_cards':
      return {
        minSelections: request.minSelections,
        maxSelections: request.maxSelections,
        handZoneId: request.handZoneId,
        deckZoneId: request.deckZoneId,
        eligiblePieces: request.eligiblePieceIds.map((pieceId) =>
          resolveProjectedPieceReference(pieceId, pieceProjectionByCanonicalId),
        ),
        currentDeckCount: request.currentDeckPieceIds.length,
      }
    case 'battle.guard_select':
      return {
        battleId: request.battleId,
        minSelections: request.minSelections,
        maxSelections: request.maxSelections,
        handZoneId: request.handZoneId,
        guardZoneId: request.guardZoneId,
        attackerPiece: resolveProjectedPieceReference(
          request.attackerPieceId,
          pieceProjectionByCanonicalId,
        ),
        eligiblePieces: request.eligiblePieceIds.map((pieceId) =>
          resolveProjectedPieceReference(pieceId, pieceProjectionByCanonicalId),
        ),
        ...(request.handPieceIds === undefined
          ? {}
          : {
              handPieces: request.handPieceIds.map((pieceId) =>
                resolveProjectedPieceReference(
                  pieceId,
                  pieceProjectionByCanonicalId,
                ),
              ),
            }),
        ...(request.interceptPieceIds === undefined
          ? {}
          : {
              interceptPieces: request.interceptPieceIds.map((pieceId) =>
                resolveProjectedPieceReference(
                  pieceId,
                  pieceProjectionByCanonicalId,
                ),
              ),
            }),
      }
    case 'trigger.resolve':
      return {
        battleId: request.battleId,
        checkKind: request.checkKind,
        revealedPiece: resolveProjectedPieceReference(
          request.revealedPieceId,
          pieceProjectionByCanonicalId,
        ),
        triggerType: request.triggerType,
        ...(request.powerAmount === undefined
          ? {}
          : { powerAmount: request.powerAmount }),
        ...(request.criticalAmount === undefined
          ? {}
          : { criticalAmount: request.criticalAmount }),
        ...(request.powerEligiblePieceIds === undefined
          ? {}
          : {
              powerEligiblePieces: request.powerEligiblePieceIds.map(
                (pieceId) =>
                  resolveProjectedPieceReference(
                    pieceId,
                    pieceProjectionByCanonicalId,
                  ),
              ),
            }),
        ...(request.criticalEligiblePieceIds === undefined
          ? {}
          : {
              criticalEligiblePieces: request.criticalEligiblePieceIds.map(
                (pieceId) =>
                  resolveProjectedPieceReference(
                    pieceId,
                    pieceProjectionByCanonicalId,
                  ),
              ),
            }),
        ...(request.standEligiblePieceIds === undefined
          ? {}
          : {
              standEligiblePieces: request.standEligiblePieceIds.map(
                (pieceId) =>
                  resolveProjectedPieceReference(
                    pieceId,
                    pieceProjectionByCanonicalId,
                  ),
              ),
            }),
        ...(request.healEligiblePieceIds === undefined
          ? {}
          : {
              healEligiblePieces: request.healEligiblePieceIds.map((pieceId) =>
                resolveProjectedPieceReference(
                  pieceId,
                  pieceProjectionByCanonicalId,
                ),
              ),
            }),
      }
    case 'confirm.boolean':
      return {
        ...(request.defaultAnswer === undefined
          ? {}
          : { defaultAnswer: request.defaultAnswer }),
      }
  }
}

function projectGameEvent(
  event: GameEvent,
  projectedState: VisibleGameState,
  viewerPlayerId: PlayerId | undefined,
): VisibleGameEvent {
  switch (event.type) {
    case 'zone.shuffled':
      return createVisibleEvent(event, {
        visibility: 'redacted',
        details: [
          { label: 'Zone', value: event.zoneId },
          { label: 'Cards', value: event.orderedPieceIds.length.toString() },
        ],
        redactedFields: ['orderedPieceIds'],
      })
    case 'cards.drawn': {
      const viewerIsDrawingPlayer = event.playerId === viewerPlayerId
      const details: VisibleGameEventDetail[] = [
        { label: 'Player', value: event.playerId },
        { label: 'From', value: event.fromZoneId },
        { label: 'To', value: event.toZoneId },
        { label: 'Cards', value: event.pieceIds.length.toString() },
      ]

      if (
        viewerIsDrawingPlayer ||
        projectedState.projectionMode === 'omniscient'
      ) {
        details.push({
          label: 'Pieces',
          value: event.pieceIds
            .map((pieceId) =>
              resolveProjectedPieceRefId(projectedState, pieceId),
            )
            .join(', '),
        })
      }

      return createVisibleEvent(event, {
        visibility: viewerIsDrawingPlayer ? 'viewer-private' : 'redacted',
        details,
        redactedFields: viewerIsDrawingPlayer ? [] : ['pieceIds'],
      })
    }
    case 'cards.deck_out':
      return createVisibleEvent(event, {
        visibility: 'public',
        details: [
          { label: 'Player', value: event.playerId },
          { label: 'From', value: event.fromZoneId },
          { label: 'Required', value: event.requiredCount.toString() },
          { label: 'Available', value: event.availableCount.toString() },
          { label: 'Reason', value: event.reason },
        ],
        redactedFields: [],
      })
    case 'mulligan.completed': {
      const viewerIsPlayer = event.playerId === viewerPlayerId

      return createVisibleEvent(event, {
        visibility: viewerIsPlayer ? 'viewer-private' : 'redacted',
        details: [
          { label: 'Player', value: event.playerId },
          {
            label: 'Returned',
            value: event.returnedPieceIds.length.toString(),
          },
          { label: 'Drawn', value: event.drawnPieceIds.length.toString() },
        ],
        redactedFields: viewerIsPlayer
          ? []
          : ['returnedPieceIds', 'drawnPieceIds'],
      })
    }
    case 'battle.drive_checked':
    case 'battle.damage_checked':
      return createVisibleEvent(event, {
        visibility: 'public',
        details: [
          { label: 'Battle', value: event.battleId },
          { label: 'Player', value: event.playerId },
          { label: 'Check', value: event.type },
          {
            label: 'Revealed',
            value: event.revealedCards
              .map(
                (card) =>
                  card.cardDefinitionId ??
                  resolveProjectedPieceRefId(projectedState, card.pieceId),
              )
              .join(', '),
          },
        ],
        redactedFields: [],
      })
    case 'trigger.revealed':
      return createVisibleEvent(event, {
        visibility: 'public',
        details: [
          { label: 'Battle', value: event.battleId },
          { label: 'Player', value: event.playerId },
          { label: 'Check', value: event.checkKind },
          { label: 'Trigger', value: event.triggerType },
          ...(event.cardDefinitionId === undefined
            ? []
            : [{ label: 'Card', value: event.cardDefinitionId }]),
        ],
        redactedFields: [],
      })
    default:
      return createVisibleEvent(event, {
        visibility: 'public',
        details: [],
        redactedFields: [],
      })
  }
}

function createVisibleEvent(
  event: GameEvent,
  input: {
    readonly visibility: VisibleEventVisibility
    readonly details: readonly VisibleGameEventDetail[]
    readonly redactedFields: readonly string[]
  },
): VisibleGameEvent {
  return {
    eventId: event.eventId,
    sequence: event.sequence,
    type: event.type,
    origin: event.origin,
    visibility: input.visibility,
    details: input.details,
    redactedFields: input.redactedFields,
  }
}

function projectCardStats(
  cardStats: EngineCardStatsSnapshot | undefined,
  visibleCardDefinitionIds: ReadonlySet<string>,
): EngineCardStatsSnapshot | undefined {
  if (cardStats === undefined) {
    return undefined
  }

  return {
    cards: cardStats.cards.filter((card) =>
      visibleCardDefinitionIds.has(card.cardDefinitionId as string),
    ),
  }
}

function canViewerSeeZoneOccupant(
  zone: GameState['zones'][number],
  piece: GameState['pieces'][number] | undefined,
  options: ProjectStateOptions,
): boolean {
  if (options.mode === 'omniscient') {
    return true
  }

  if (isAlwaysHiddenDeckKind(zone.kind)) {
    return false
  }

  switch (zone.visibility) {
    case 'public':
      return true
    case 'owner-private':
      return (
        zone.ownerPlayerId === options.viewerPlayerId ||
        piece?.ownerPlayerId === options.viewerPlayerId
      )
    case 'controller-private':
      return piece?.controllerPlayerId === options.viewerPlayerId
    case 'hidden':
      return false
    default:
      return false
  }
}

function canViewerSeePlayerPrivateSurface(
  visibility: VisibilityPolicy,
  ownerPlayerId: PlayerId,
  options: ProjectStateOptions,
): boolean {
  if (options.mode === 'omniscient') {
    return true
  }

  switch (visibility) {
    case 'public':
      return true
    case 'owner-private':
    case 'controller-private':
      return ownerPlayerId === options.viewerPlayerId
    case 'hidden':
      return false
    default:
      return false
  }
}

function isAlwaysHiddenDeckKind(kind: ZoneKind): boolean {
  return kind === 'deck' || kind === 'main_deck'
}

function createMaskedPieceRefId(
  viewerPlayerId: PlayerId | undefined,
  zoneId: ZoneId,
  position: number,
): string {
  return `masked:${viewerPlayerId ?? 'omniscient'}:${zoneId}:${position}`
}

function resolveProjectedPieceReference(
  pieceId: PieceId,
  pieceProjectionByCanonicalId: ReadonlyMap<string, PieceProjectionRecord>,
): VisiblePieceReference {
  return (
    pieceProjectionByCanonicalId.get(pieceId as string)?.ref ?? {
      refId: `missing:${pieceId}`,
      visibility: 'masked',
    }
  )
}

function resolveProjectedPieceRefId(
  projectedState: VisibleGameState,
  pieceId: PieceId,
): string {
  return (
    projectedState.pieces.find((piece) => piece.pieceId === pieceId)?.refId ??
    `hidden:${pieceId}`
  )
}
