import {
  STANDARD_FORMAT_ID,
  assertGameStateInvariant,
  buildEngineCardStatsSnapshotFromGameplayCards,
  type EffectDefinitionId,
  type GameId,
  type GameState,
  type PieceId,
  type PlayerId,
  type ZoneId,
  type ZoneSlotId,
} from '@web-vg/rules-core'
import type {
  CardId,
  DeckSection,
  DeckSnapshot,
  FormatId,
  GameplayCard,
} from '@web-vg/shared'

export interface MatchDeckValidationProof {
  readonly isValid: boolean
  readonly source: string
  readonly errorCount: number
  readonly issueCodes?: readonly string[]
}

export interface DeckBackedMatchPlayerInput {
  readonly playerId: PlayerId
  readonly seat: number
  readonly deckSnapshot: DeckSnapshot
  readonly cardDefinitions: readonly GameplayCard[]
  readonly validation: MatchDeckValidationProof
  readonly runtimeKey?: string
}

export interface CreateDeckBackedGameStateInput {
  readonly gameId: GameId
  readonly formatId: FormatId
  readonly players: readonly DeckBackedMatchPlayerInput[]
  readonly startingPlayerId?: PlayerId
  readonly openingHandSize?: number
}

export type DeckBackedGameStateBootstrapIssueCode =
  | 'missing_players'
  | 'duplicate_players'
  | 'format_mismatch'
  | 'deck_not_valid'
  | 'incomplete_deck_snapshot'
  | 'invalid_deck_entry'
  | 'missing_card_definition'
  | 'invalid_card_stats'
  | 'missing_starting_vanguard'
  | 'invalid_bootstrap_state'

export type DeckBackedGameStateBootstrapResult =
  | {
      readonly ok: true
      readonly state: GameState
    }
  | {
      readonly ok: false
      readonly code: DeckBackedGameStateBootstrapIssueCode
      readonly message: string
    }

interface ExpandedDeckPiece {
  readonly pieceId: PieceId
  readonly cardDefinitionId: CardId
  readonly section: DeckSection
}

interface PlayerBootstrapPayload {
  readonly player: GameState['players'][number]
  readonly zones: readonly GameState['zones'][number][]
  readonly pieces: readonly GameState['pieces'][number][]
}

const defaultOpeningHandSize = 5
export function createDeckBackedGameState(
  input: CreateDeckBackedGameStateInput,
): DeckBackedGameStateBootstrapResult {
  if (input.players.length === 0) {
    return {
      ok: false,
      code: 'missing_players',
      message: 'Deck-backed match bootstrap requires at least one player.',
    }
  }

  const playerIdentityIssue = validatePlayerIdentities(input.players)

  if (playerIdentityIssue !== undefined) {
    return playerIdentityIssue
  }

  const validationIssue = validateDeckInputs(input)

  if (validationIssue !== undefined) {
    return validationIssue
  }

  const requiredCardIds = collectRequiredCardIds(input.players)
  const cardDefinitions = collectRequiredCardDefinitions(
    input.players,
    requiredCardIds,
  )

  if (!cardDefinitions.ok) {
    return cardDefinitions
  }

  const cardDefinitionsById = new Map(
    cardDefinitions.cards.map((card) => [card.cardId as string, card] as const),
  )
  const cardStats = (() => {
    try {
      return {
        ok: true as const,
        snapshot: buildEngineCardStatsSnapshotFromGameplayCards(
          cardDefinitions.cards,
        ),
      }
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error
            ? error.message
            : 'Deck-backed match bootstrap could not build engine card stats.',
      }
    }
  })()

  if (!cardStats.ok) {
    return {
      ok: false,
      code: 'invalid_card_stats',
      message: cardStats.message,
    }
  }

  const openingHandSize = input.openingHandSize ?? defaultOpeningHandSize
  const payloads: PlayerBootstrapPayload[] = []

  for (const player of input.players.slice().sort(comparePlayersBySeat)) {
    const payload = createPlayerBootstrapPayload({
      player,
      formatId: input.formatId,
      openingHandSize,
      cardDefinitionsById,
    })

    if (!payload.ok) {
      return payload
    }

    payloads.push(payload.payload)
  }

  const startingPlayerId =
    input.startingPlayerId ?? payloads[0]?.player.playerId

  if (
    startingPlayerId === undefined ||
    !payloads.some((payload) => payload.player.playerId === startingPlayerId)
  ) {
    return {
      ok: false,
      code: 'missing_players',
      message: `Starting player ${String(startingPlayerId)} is not part of the deck-backed match bootstrap input.`,
    }
  }

  const state: GameState = {
    gameId: input.gameId,
    formatId: input.formatId,
    status: 'setup',
    revision: 0,
    turn: {
      turnNumber: 0,
      turnPlayerId: startingPlayerId,
      phase: 'pregame',
      step: 'setup',
    },
    players: payloads.map((payload) => payload.player),
    zones: payloads.flatMap((payload) => payload.zones),
    pieces: payloads.flatMap((payload) => payload.pieces),
    cardStats: cardStats.snapshot,
    pieceStates: [],
    flags: [],
    pendingRequests: [],
  }

  try {
    assertGameStateInvariant(state)
  } catch (error) {
    return {
      ok: false,
      code: 'invalid_bootstrap_state',
      message:
        error instanceof Error
          ? error.message
          : 'Deck-backed match bootstrap produced an invalid game state.',
    }
  }

  return {
    ok: true,
    state,
  }
}

function validatePlayerIdentities(
  players: readonly DeckBackedMatchPlayerInput[],
): DeckBackedGameStateBootstrapResult | undefined {
  const playerIds = players.map((player) => player.playerId as string)
  const seats = players.map((player) => player.seat)
  const runtimeKeys = players.map((player) => resolveRuntimeKey(player))

  if (
    hasDuplicates(playerIds) ||
    hasDuplicates(seats.map((seat) => seat.toString())) ||
    hasDuplicates(runtimeKeys)
  ) {
    return {
      ok: false,
      code: 'duplicate_players',
      message:
        'Deck-backed match bootstrap players must not repeat player ids, seats, or runtime keys.',
    }
  }

  for (const player of players) {
    if (!Number.isSafeInteger(player.seat) || player.seat < 0) {
      return {
        ok: false,
        code: 'duplicate_players',
        message: `Deck-backed match bootstrap player ${player.playerId} has invalid seat ${player.seat}.`,
      }
    }
  }

  return undefined
}

function validateDeckInputs(
  input: CreateDeckBackedGameStateInput,
): DeckBackedGameStateBootstrapResult | undefined {
  for (const player of input.players) {
    if (player.deckSnapshot.formatId !== input.formatId) {
      return {
        ok: false,
        code: 'format_mismatch',
        message: `Deck ${player.deckSnapshot.deckId} format ${player.deckSnapshot.formatId} does not match match format ${input.formatId}.`,
      }
    }

    if (!player.validation.isValid || player.validation.errorCount > 0) {
      return {
        ok: false,
        code: 'deck_not_valid',
        message: `Deck ${player.deckSnapshot.deckId} must pass deck validation before match bootstrap. Validation source ${player.validation.source} reported ${player.validation.errorCount} errors.`,
      }
    }

    if (player.deckSnapshot.completeness !== 'complete') {
      return {
        ok: false,
        code: 'incomplete_deck_snapshot',
        message: `Deck ${player.deckSnapshot.deckId} snapshot revision ${player.deckSnapshot.revision} is incomplete.`,
      }
    }

    const deckEntryIssue = validateSnapshotEntries(player.deckSnapshot)

    if (deckEntryIssue !== undefined) {
      return deckEntryIssue
    }
  }

  return undefined
}

function validateSnapshotEntries(
  deckSnapshot: DeckSnapshot,
): DeckBackedGameStateBootstrapResult | undefined {
  const seenEntries = new Set<string>()

  for (const section of deckSnapshot.sections) {
    if (!isDeckSection(section.section)) {
      return {
        ok: false,
        code: 'invalid_deck_entry',
        message: `Deck ${deckSnapshot.deckId} contains unsupported section ${String(section.section)}.`,
      }
    }

    for (const entry of section.entries) {
      const cardId = String(entry.cardId)

      if (cardId.trim().length === 0) {
        return {
          ok: false,
          code: 'invalid_deck_entry',
          message: `Deck ${deckSnapshot.deckId} contains an entry without a card definition id.`,
        }
      }

      if (!Number.isSafeInteger(entry.count) || entry.count <= 0) {
        return {
          ok: false,
          code: 'invalid_deck_entry',
          message: `Deck ${deckSnapshot.deckId} entry ${cardId} has invalid count ${entry.count}.`,
        }
      }

      const key = `${section.section}:${cardId}`

      if (seenEntries.has(key)) {
        return {
          ok: false,
          code: 'invalid_deck_entry',
          message: `Deck ${deckSnapshot.deckId} repeats card ${cardId} in section ${section.section}.`,
        }
      }

      seenEntries.add(key)
    }
  }

  return undefined
}

function collectRequiredCardIds(
  players: readonly DeckBackedMatchPlayerInput[],
): ReadonlySet<string> {
  return new Set(
    players.flatMap((player) =>
      player.deckSnapshot.sections.flatMap((section) =>
        section.entries.map((entry) => entry.cardId as string),
      ),
    ),
  )
}

function collectRequiredCardDefinitions(
  players: readonly DeckBackedMatchPlayerInput[],
  requiredCardIds: ReadonlySet<string>,
):
  | {
      readonly ok: true
      readonly cards: readonly GameplayCard[]
    }
  | Extract<DeckBackedGameStateBootstrapResult, { readonly ok: false }> {
  const cardsById = new Map<string, GameplayCard>()

  for (const player of players) {
    for (const card of player.cardDefinitions) {
      if (!requiredCardIds.has(card.cardId as string)) {
        continue
      }

      if (!cardsById.has(card.cardId as string)) {
        cardsById.set(card.cardId as string, card)
      }
    }
  }

  const missingCardIds = Array.from(requiredCardIds)
    .filter((cardId) => !cardsById.has(cardId))
    .sort((left, right) => left.localeCompare(right))

  if (missingCardIds.length > 0) {
    return {
      ok: false,
      code: 'missing_card_definition',
      message: `Deck-backed match bootstrap is missing gameplay card definitions for ${missingCardIds.join(', ')}.`,
    }
  }

  return {
    ok: true,
    cards: Array.from(cardsById.values()).sort((left, right) =>
      (left.cardId as string).localeCompare(right.cardId as string),
    ),
  }
}

function createPlayerBootstrapPayload(input: {
  readonly player: DeckBackedMatchPlayerInput
  readonly formatId: FormatId
  readonly openingHandSize: number
  readonly cardDefinitionsById: ReadonlyMap<string, GameplayCard>
}):
  | {
      readonly ok: true
      readonly payload: PlayerBootstrapPayload
    }
  | Extract<DeckBackedGameStateBootstrapResult, { readonly ok: false }> {
  const runtimeKey = resolveRuntimeKey(input.player)
  const mainPieces = expandDeckSection(
    input.player.deckSnapshot,
    'main',
    runtimeKey,
  )
  const ridePieces = expandDeckSection(
    input.player.deckSnapshot,
    'ride',
    runtimeKey,
  )
  const gPieces = expandDeckSection(input.player.deckSnapshot, 'g', runtimeKey)

  if (mainPieces.length < input.openingHandSize) {
    return {
      ok: false,
      code: 'invalid_deck_entry',
      message: `Deck ${input.player.deckSnapshot.deckId} main deck cannot provide opening hand size ${input.openingHandSize}.`,
    }
  }

  const startingVanguard = selectStartingVanguard(
    input.player.deckSnapshot,
    ridePieces,
    input.cardDefinitionsById,
  )

  if (!startingVanguard.ok) {
    if (input.formatId === STANDARD_FORMAT_ID) {
      return startingVanguard
    }
  }

  const startingVanguardPiece =
    startingVanguard.ok === true ? startingVanguard.piece : undefined
  const openingHandPieces = mainPieces.slice(0, input.openingHandSize)
  const deckPieces = mainPieces.slice(input.openingHandSize)
  const rideDeckPiecesUnsorted =
    startingVanguardPiece === undefined
      ? ridePieces
      : ridePieces.filter(
          (piece) => piece.pieceId !== startingVanguardPiece.pieceId,
        )
  const rideDeckPieces = sortRideDeckPiecesByGrade(
    rideDeckPiecesUnsorted,
    input.cardDefinitionsById,
  )
  const allPieces = [...mainPieces, ...ridePieces, ...gPieces]
  const zones = createPlayerZones({
    runtimeKey,
    playerId: input.player.playerId,
    formatId: input.formatId,
    deckPieces,
    openingHandPieces,
    rideDeckPieces,
    gPieces,
    ...(startingVanguardPiece === undefined ? {} : { startingVanguardPiece }),
  })

  return {
    ok: true,
    payload: {
      player: {
        playerId: input.player.playerId,
        seat: input.player.seat,
        status: 'waiting',
        ownedZoneIds: zones.map((zone) => zone.zoneId),
        counters: createPlayerCounters(input.formatId),
        flags: [],
      },
      zones,
      pieces: allPieces.map((piece) =>
        createRuntimePieceState(
          piece,
          input.player.playerId,
          input.cardDefinitionsById,
        ),
      ),
    },
  }
}

function createRuntimePieceState(
  piece: ExpandedDeckPiece,
  playerId: PlayerId,
  cardDefinitionsById: ReadonlyMap<string, GameplayCard>,
): GameState['pieces'][number] {
  const card = cardDefinitionsById.get(piece.cardDefinitionId as string)
  const effectDefinitionIds = Array.from(
    new Set(
      card?.effectRefs.map(
        (effectRef) => effectRef.id as unknown as EffectDefinitionId,
      ) ?? [],
    ),
  )

  return {
    pieceId: piece.pieceId,
    kind: 'card',
    cardDefinitionId: piece.cardDefinitionId,
    ownerPlayerId: playerId,
    controllerPlayerId: playerId,
    ...(effectDefinitionIds.length === 0 ? {} : { effectDefinitionIds }),
  }
}

function expandDeckSection(
  deckSnapshot: DeckSnapshot,
  section: DeckSection,
  runtimeKey: string,
): readonly ExpandedDeckPiece[] {
  const sectionState = deckSnapshot.sections.find(
    (candidate) => candidate.section === section,
  )

  if (sectionState === undefined) {
    return []
  }

  const pieces: ExpandedDeckPiece[] = []

  sectionState.entries.forEach((entry, entryIndex) => {
    for (let copyIndex = 0; copyIndex < entry.count; copyIndex += 1) {
      pieces.push({
        pieceId: createDeckPieceId({
          runtimeKey,
          section,
          cardId: entry.cardId,
          entryIndex,
          copyIndex,
        }),
        cardDefinitionId: entry.cardId,
        section,
      })
    }
  })

  return pieces
}

function selectStartingVanguard(
  deckSnapshot: DeckSnapshot,
  ridePieces: readonly ExpandedDeckPiece[],
  cardDefinitionsById: ReadonlyMap<string, GameplayCard>,
):
  | {
      readonly ok: true
      readonly piece: ExpandedDeckPiece
    }
  | Extract<DeckBackedGameStateBootstrapResult, { readonly ok: false }> {
  const gradeZeroRidePieces = ridePieces.filter((piece) => {
    const card = cardDefinitionsById.get(piece.cardDefinitionId as string)

    return card?.grade === 0
  })
  const piece = gradeZeroRidePieces[0]

  if (piece === undefined) {
    return {
      ok: false,
      code: 'missing_starting_vanguard',
      message: `Deck ${deckSnapshot.deckId} must provide a grade 0 ride deck card for the starting vanguard.`,
    }
  }

  return {
    ok: true,
    piece,
  }
}

function sortRideDeckPiecesByGrade(
  pieces: readonly ExpandedDeckPiece[],
  cardDefinitionsById: ReadonlyMap<string, GameplayCard>,
): readonly ExpandedDeckPiece[] {
  return [...pieces].sort((left, right) => {
    const leftCard = cardDefinitionsById.get(left.cardDefinitionId as string)
    const rightCard = cardDefinitionsById.get(right.cardDefinitionId as string)
    const leftGrade = leftCard?.grade ?? Number.MAX_SAFE_INTEGER
    const rightGrade = rightCard?.grade ?? Number.MAX_SAFE_INTEGER

    return (
      leftGrade - rightGrade ||
      (left.cardDefinitionId as string).localeCompare(
        right.cardDefinitionId as string,
      ) ||
      (left.pieceId as string).localeCompare(right.pieceId as string)
    )
  })
}

function createPlayerZones(input: {
  readonly runtimeKey: string
  readonly playerId: PlayerId
  readonly formatId: FormatId
  readonly deckPieces: readonly ExpandedDeckPiece[]
  readonly openingHandPieces: readonly ExpandedDeckPiece[]
  readonly rideDeckPieces: readonly ExpandedDeckPiece[]
  readonly gPieces: readonly ExpandedDeckPiece[]
  readonly startingVanguardPiece?: ExpandedDeckPiece
}): readonly GameState['zones'][number][] {
  return [
    createOrderedMultiZone(input.runtimeKey, input.playerId, 'deck', [
      ...input.deckPieces,
    ]),
    createOrderedMultiZone(input.runtimeKey, input.playerId, 'ride_deck', [
      ...input.rideDeckPieces,
    ]),
    createOrderedMultiZone(input.runtimeKey, input.playerId, 'g_deck', [
      ...input.gPieces,
    ]),
    createUnorderedMultiZone(input.runtimeKey, input.playerId, 'hand', [
      ...input.openingHandPieces,
    ]),
    {
      zoneId: createZoneId(input.runtimeKey, 'vanguard'),
      kind: 'vanguard_circle',
      scope: 'player',
      ownerPlayerId: input.playerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'single',
      },
      occupants:
        input.startingVanguardPiece === undefined
          ? []
          : [{ pieceId: input.startingVanguardPiece.pieceId }],
    },
    {
      zoneId: createZoneId(input.runtimeKey, 'rear-guard'),
      kind: 'rear_guard_circle',
      scope: 'player',
      ownerPlayerId: input.playerId,
      visibility: 'public',
      layout: {
        ordering: 'unordered',
        occupancy: 'slotted',
        slotIds: createRearGuardSlotIds(input.runtimeKey),
      },
      occupants: [],
    },
    createUnorderedMultiZone(
      input.runtimeKey,
      input.playerId,
      'guardian_circle',
      [],
    ),
    ...createStandardVerticalSliceZones(input),
    createOrderedMultiZone(input.runtimeKey, input.playerId, 'damage', []),
    createOrderedMultiZone(input.runtimeKey, input.playerId, 'soul', []),
    createOrderedMultiZone(input.runtimeKey, input.playerId, 'drop', []),
    createOrderedMultiZone(input.runtimeKey, input.playerId, 'bind', []),
  ]
}

function createStandardVerticalSliceZones(input: {
  readonly runtimeKey: string
  readonly playerId: PlayerId
  readonly formatId: FormatId
}): readonly GameState['zones'][number][] {
  if (input.formatId !== STANDARD_FORMAT_ID) {
    return []
  }

  return [
    createOrderedMultiZone(input.runtimeKey, input.playerId, 'order_zone', []),
    createUnorderedMultiZone(input.runtimeKey, input.playerId, 'prison', []),
  ]
}

function createPlayerCounters(
  formatId: FormatId,
): GameState['players'][number]['counters'] {
  if (formatId !== STANDARD_FORMAT_ID) {
    return []
  }

  return [
    {
      key: 'energy',
      amount: 0,
      visibility: 'public',
    },
  ]
}

function createOrderedMultiZone(
  runtimeKey: string,
  playerId: PlayerId,
  kind: GameState['zones'][number]['kind'],
  pieces: readonly ExpandedDeckPiece[],
): GameState['zones'][number] {
  return {
    zoneId: createZoneId(runtimeKey, normalizeZoneKey(kind)),
    kind,
    scope: 'player',
    ownerPlayerId: playerId,
    visibility:
      kind === 'deck' || kind === 'ride_deck' || kind === 'g_deck'
        ? 'owner-private'
        : 'public',
    layout: {
      ordering: 'ordered',
      occupancy: 'multi',
    },
    occupants: pieces.map((piece) => ({ pieceId: piece.pieceId })),
  }
}

function createUnorderedMultiZone(
  runtimeKey: string,
  playerId: PlayerId,
  kind: GameState['zones'][number]['kind'],
  pieces: readonly ExpandedDeckPiece[],
): GameState['zones'][number] {
  return {
    zoneId: createZoneId(runtimeKey, normalizeZoneKey(kind)),
    kind,
    scope: 'player',
    ownerPlayerId: playerId,
    visibility: kind === 'hand' ? 'owner-private' : 'public',
    layout: {
      ordering: 'unordered',
      occupancy: 'multi',
    },
    occupants: pieces.map((piece) => ({ pieceId: piece.pieceId })),
  }
}

function createRearGuardSlotIds(runtimeKey: string): readonly ZoneSlotId[] {
  return [
    `${runtimeKey}:front-left`,
    `${runtimeKey}:back-left`,
    `${runtimeKey}:back-center`,
    `${runtimeKey}:front-right`,
    `${runtimeKey}:back-right`,
  ].map((slotId) => slotId as ZoneSlotId)
}

function createDeckPieceId(input: {
  readonly runtimeKey: string
  readonly section: DeckSection
  readonly cardId: CardId
  readonly entryIndex: number
  readonly copyIndex: number
}): PieceId {
  return `${input.runtimeKey}:piece:${input.section}:${input.entryIndex + 1}:${input.copyIndex + 1}:${normalizeIdFragment(input.cardId)}` as PieceId
}

function createZoneId(runtimeKey: string, zoneKey: string): ZoneId {
  return `${runtimeKey}:zone:${zoneKey}` as ZoneId
}

function normalizeZoneKey(kind: GameState['zones'][number]['kind']): string {
  return kind === 'ride_deck'
    ? 'ride-deck'
    : kind === 'g_deck'
      ? 'g-deck'
      : kind === 'guardian_circle'
        ? 'guardian'
        : kind === 'order_zone'
          ? 'order-zone'
          : kind
}

function normalizeIdFragment(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, '_')
}

function resolveRuntimeKey(player: DeckBackedMatchPlayerInput): string {
  return player.runtimeKey ?? `seat-${player.seat}`
}

function comparePlayersBySeat(
  left: DeckBackedMatchPlayerInput,
  right: DeckBackedMatchPlayerInput,
): number {
  return (
    left.seat - right.seat ||
    (left.playerId as string).localeCompare(right.playerId as string)
  )
}

function isDeckSection(value: string): value is DeckSection {
  return value === 'main' || value === 'ride' || value === 'g'
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length
}
