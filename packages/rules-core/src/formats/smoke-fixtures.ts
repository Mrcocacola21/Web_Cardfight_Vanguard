import type { CardId, FormatId } from '@web-vg/shared'

import type {
  GameChoiceRequest,
  GameState,
  RequestId,
  ZoneSlotId,
} from '../index'
import {
  PREMIUM_FORMAT_ID,
  PREMIUM_ZONE_KINDS,
  STANDARD_FORMAT_ID,
  STANDARD_ZONE_KINDS,
  V_PREMIUM_FORMAT_ID,
  V_PREMIUM_ZONE_KINDS,
  buildEngineCardStatsSnapshot,
} from '../index'

interface FormatSmokeStateOptions {
  readonly formatId?: FormatId
  readonly revision?: number
  readonly status?: GameState['status']
  readonly pendingRequests?: readonly GameChoiceRequest[]
}

interface VPremiumSmokeStateOptions extends FormatSmokeStateOptions {
  readonly includeGiftZone?: boolean
  readonly includeRideDeckZone?: boolean
}

interface PremiumSmokeStateOptions extends FormatSmokeStateOptions {
  readonly includeRideDeckZone?: boolean
  readonly occupiedHeart?: boolean
}

export function makeSmokeBlockingRequest(
  requestId: RequestId = 'request-format-smoke-1' as RequestId,
): GameChoiceRequest {
  return {
    requestId,
    type: 'confirm.boolean',
    responderPlayerId: 'player-1' as GameState['players'][number]['playerId'],
    purpose: 'rule',
    visibility: 'responder-only',
  }
}

export function makeStandardSmokeState(
  options: FormatSmokeStateOptions = {},
): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status = resolveStatus(options.status, pendingRequests)
  const playerStatus = resolvePlayerStatus(status)
  const opponentStatus = resolveOpponentStatus(status)

  return {
    gameId: 'game-standard-smoke-1' as GameState['gameId'],
    formatId: options.formatId ?? STANDARD_FORMAT_ID,
    status,
    revision: options.revision ?? (status === 'ready' ? 0 : 3),
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
        status: playerStatus,
        ownedZoneIds: [
          'zone-standard-p1-ride' as GameState['zones'][number]['zoneId'],
          'zone-standard-p1-vanguard' as GameState['zones'][number]['zoneId'],
          'zone-standard-p1-soul' as GameState['zones'][number]['zoneId'],
          'zone-standard-p1-rearguard' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: opponentStatus,
        ownedZoneIds: [
          'zone-standard-p2-vanguard' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones: [
      {
        zoneId: 'zone-standard-p1-ride' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.rideDeck,
        scope: 'player',
        ownerPlayerId: 'player-1' as GameState['players'][number]['playerId'],
        visibility: 'public',
        layout: {
          ordering: 'ordered',
          occupancy: 'multi',
        },
        occupants: [
          {
            pieceId:
              'piece-standard-ride' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId:
          'zone-standard-p1-vanguard' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.vanguardCircle,
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
              'piece-standard-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
      {
        zoneId: 'zone-standard-p1-soul' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.soul,
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
        zoneId:
          'zone-standard-p1-rearguard' as GameState['zones'][number]['zoneId'],
        kind: 'rear_guard_circle',
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
        zoneId:
          'zone-standard-p2-vanguard' as GameState['zones'][number]['zoneId'],
        kind: STANDARD_ZONE_KINDS.vanguardCircle,
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
              'piece-standard-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
          },
        ],
      },
    ],
    pieces: [
      makeCardPiece(
        'piece-standard-ride' as GameState['pieces'][number]['pieceId'],
        'player-1' as GameState['players'][number]['playerId'],
        'card-standard-ride' as CardId,
      ),
      makeCardPiece(
        'piece-standard-vanguard' as GameState['pieces'][number]['pieceId'],
        'player-1' as GameState['players'][number]['playerId'],
        'card-standard-vanguard' as CardId,
      ),
      makeCardPiece(
        'piece-standard-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
        'player-2' as GameState['players'][number]['playerId'],
        'card-standard-opponent-vanguard' as CardId,
      ),
    ],
    cardStats: buildEngineCardStatsSnapshot([
      makeUnitStats('card-standard-ride' as CardId, 1),
      makeUnitStats('card-standard-vanguard' as CardId, 0),
      makeUnitStats('card-standard-opponent-vanguard' as CardId, 0),
    ]),
    pieceStates: [],
    flags: [],
    pendingRequests,
  }
}

export function makeVPremiumSmokeState(
  options: VPremiumSmokeStateOptions = {},
): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status = resolveStatus(options.status, pendingRequests)
  const includeGiftZone = options.includeGiftZone ?? true
  const includeRideDeckZone = options.includeRideDeckZone ?? false
  const playerStatus = resolvePlayerStatus(status)
  const opponentStatus = resolveOpponentStatus(status)
  const ownedZoneIds: GameState['zones'][number]['zoneId'][] = [
    'zone-vp-p1-hand' as GameState['zones'][number]['zoneId'],
    'zone-vp-p1-vanguard' as GameState['zones'][number]['zoneId'],
    'zone-vp-p1-soul' as GameState['zones'][number]['zoneId'],
  ]
  const zones: GameState['zones'][number][] = [
    {
      zoneId: 'zone-vp-p1-hand' as GameState['zones'][number]['zoneId'],
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
          pieceId:
            'piece-vp-hand-ride' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-vp-p1-vanguard' as GameState['zones'][number]['zoneId'],
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
          pieceId:
            'piece-vp-vanguard' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-vp-p1-soul' as GameState['zones'][number]['zoneId'],
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
    makeCardPiece(
      'piece-vp-hand-ride' as GameState['pieces'][number]['pieceId'],
      'player-1' as GameState['players'][number]['playerId'],
      'card-vp-hand-ride' as CardId,
    ),
    makeCardPiece(
      'piece-vp-vanguard' as GameState['pieces'][number]['pieceId'],
      'player-1' as GameState['players'][number]['playerId'],
      'card-vp-vanguard' as CardId,
    ),
  ]

  if (includeGiftZone) {
    ownedZoneIds.push('zone-vp-p1-gift' as GameState['zones'][number]['zoneId'])
    zones.push({
      zoneId: 'zone-vp-p1-gift' as GameState['zones'][number]['zoneId'],
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
    ownedZoneIds.push('zone-vp-p1-ride' as GameState['zones'][number]['zoneId'])
    zones.push({
      zoneId: 'zone-vp-p1-ride' as GameState['zones'][number]['zoneId'],
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
          pieceId:
            'piece-vp-ride-deck' as GameState['pieces'][number]['pieceId'],
        },
      ],
    })
    pieces.push(
      makeCardPiece(
        'piece-vp-ride-deck' as GameState['pieces'][number]['pieceId'],
        'player-1' as GameState['players'][number]['playerId'],
        'card-vp-ride-deck' as CardId,
      ),
    )
  }

  zones.push({
    zoneId: 'zone-vp-p2-vanguard' as GameState['zones'][number]['zoneId'],
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
          'piece-vp-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
      },
    ],
  })
  pieces.push(
    makeCardPiece(
      'piece-vp-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
      'player-2' as GameState['players'][number]['playerId'],
      'card-vp-opponent-vanguard' as CardId,
    ),
  )

  return {
    gameId: 'game-v-premium-smoke-1' as GameState['gameId'],
    formatId: options.formatId ?? V_PREMIUM_FORMAT_ID,
    status,
    revision: options.revision ?? (status === 'ready' ? 0 : 4),
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
        status: playerStatus,
        ownedZoneIds: ownedZoneIds,
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: opponentStatus,
        ownedZoneIds: [
          'zone-vp-p2-vanguard' as GameState['zones'][number]['zoneId'],
        ],
        counters: [],
        flags: [],
      },
    ],
    zones,
    pieces,
    cardStats: buildEngineCardStatsSnapshot([
      makeUnitStats('card-vp-hand-ride' as CardId, 3),
      makeUnitStats('card-vp-vanguard' as CardId, 2),
      makeUnitStats('card-vp-ride-deck' as CardId, 3),
      makeUnitStats('card-vp-opponent-vanguard' as CardId, 2),
    ]),
    pieceStates: [],
    flags: [],
    pendingRequests,
  }
}

export function makePremiumSmokeState(
  options: PremiumSmokeStateOptions = {},
): GameState {
  const pendingRequests = options.pendingRequests ?? []
  const status = resolveStatus(options.status, pendingRequests)
  const includeRideDeckZone = options.includeRideDeckZone ?? false
  const occupiedHeart = options.occupiedHeart ?? false
  const playerStatus = resolvePlayerStatus(status)
  const opponentStatus = resolveOpponentStatus(status)
  const ownedZoneIds: GameState['zones'][number]['zoneId'][] = [
    'zone-premium-p1-vanguard' as GameState['zones'][number]['zoneId'],
    'zone-premium-p1-soul' as GameState['zones'][number]['zoneId'],
    'zone-premium-p1-g' as GameState['zones'][number]['zoneId'],
    'zone-premium-p1-heart' as GameState['zones'][number]['zoneId'],
  ]
  const zones: GameState['zones'][number][] = [
    {
      zoneId:
        'zone-premium-p1-vanguard' as GameState['zones'][number]['zoneId'],
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
          pieceId:
            'piece-premium-vanguard' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-premium-p1-soul' as GameState['zones'][number]['zoneId'],
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
      zoneId: 'zone-premium-p1-g' as GameState['zones'][number]['zoneId'],
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
          pieceId:
            'piece-premium-g-unit' as GameState['pieces'][number]['pieceId'],
        },
      ],
    },
    {
      zoneId: 'zone-premium-p1-heart' as GameState['zones'][number]['zoneId'],
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
                'piece-premium-heart-existing' as GameState['pieces'][number]['pieceId'],
            },
          ]
        : [],
    },
  ]
  const pieces: GameState['pieces'][number][] = [
    makeCardPiece(
      'piece-premium-vanguard' as GameState['pieces'][number]['pieceId'],
      'player-1' as GameState['players'][number]['playerId'],
      'card-premium-vanguard' as CardId,
    ),
    makeCardPiece(
      'piece-premium-g-unit' as GameState['pieces'][number]['pieceId'],
      'player-1' as GameState['players'][number]['playerId'],
      'card-premium-g-unit' as CardId,
    ),
  ]

  if (occupiedHeart) {
    pieces.push(
      makeCardPiece(
        'piece-premium-heart-existing' as GameState['pieces'][number]['pieceId'],
        'player-1' as GameState['players'][number]['playerId'],
        'card-premium-heart-existing' as CardId,
      ),
    )
  }

  if (includeRideDeckZone) {
    ownedZoneIds.push(
      'zone-premium-p1-ride' as GameState['zones'][number]['zoneId'],
    )
    zones.push({
      zoneId: 'zone-premium-p1-ride' as GameState['zones'][number]['zoneId'],
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
          pieceId:
            'piece-premium-ride-deck' as GameState['pieces'][number]['pieceId'],
        },
      ],
    })
    pieces.push(
      makeCardPiece(
        'piece-premium-ride-deck' as GameState['pieces'][number]['pieceId'],
        'player-1' as GameState['players'][number]['playerId'],
        'card-premium-ride-deck' as CardId,
      ),
    )
  }

  zones.push({
    zoneId: 'zone-premium-p2-vanguard' as GameState['zones'][number]['zoneId'],
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
          'piece-premium-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
      },
    ],
  })
  pieces.push(
    makeCardPiece(
      'piece-premium-opponent-vanguard' as GameState['pieces'][number]['pieceId'],
      'player-2' as GameState['players'][number]['playerId'],
      'card-premium-opponent-vanguard' as CardId,
    ),
  )

  return {
    gameId: 'game-premium-smoke-1' as GameState['gameId'],
    formatId: options.formatId ?? PREMIUM_FORMAT_ID,
    status,
    revision: options.revision ?? (status === 'ready' ? 0 : 5),
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
        status: playerStatus,
        ownedZoneIds: ownedZoneIds,
        counters: [],
        flags: [],
      },
      {
        playerId: 'player-2' as GameState['players'][number]['playerId'],
        seat: 1,
        status: opponentStatus,
        ownedZoneIds: [
          'zone-premium-p2-vanguard' as GameState['zones'][number]['zoneId'],
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

function resolveStatus(
  status: GameState['status'] | undefined,
  pendingRequests: readonly GameChoiceRequest[],
): GameState['status'] {
  return (
    status ?? (pendingRequests.length > 0 ? 'awaiting_choice' : 'in_progress')
  )
}

function resolvePlayerStatus(
  status: GameState['status'],
): GameState['players'][number]['status'] {
  return status === 'ready' ? 'ready' : 'active'
}

function resolveOpponentStatus(
  status: GameState['status'],
): GameState['players'][number]['status'] {
  return status === 'ready' ? 'ready' : 'waiting'
}

function makeCardPiece(
  pieceId: GameState['pieces'][number]['pieceId'],
  ownerPlayerId: GameState['players'][number]['playerId'],
  cardDefinitionId: CardId,
): GameState['pieces'][number] {
  return {
    pieceId,
    kind: 'card',
    ownerPlayerId,
    controllerPlayerId: ownerPlayerId,
    cardDefinitionId,
  }
}

function makeUnitStats(
  cardDefinitionId: CardId,
  grade: number,
): NonNullable<GameState['cardStats']>['cards'][number] {
  return {
    cardDefinitionId,
    cardType: 'normal-unit',
    grade: grade as NonNullable<
      GameState['cardStats']
    >['cards'][number]['grade'],
    power: 10000,
    shield: 5000,
    critical: 1,
    triggerType: null,
    keywords: [],
  }
}
