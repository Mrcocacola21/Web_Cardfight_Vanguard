import type { PlayerId, VisibleGameState } from '@web-vg/rules-core'

import { Badge } from '@/components/ui/badge'
import {
  type MatchBoardProjection,
  type MatchBoardSideProjection,
  type MatchBoardZoneRole,
  type ProjectedMatchBoardPiece,
  type ProjectedMatchBoardZone,
} from '@/features/matches/play/zone-projection'
import { cn } from '@/lib/utils'

type ZoneVisualMode =
  | 'battlefield'
  | 'hand'
  | 'library'
  | 'resource'
  | 'discard'
  | 'other'

interface MatchBoardProps {
  readonly projection: MatchBoardProjection
  readonly turn: VisibleGameState['turn']
  readonly zoneCount: number
  readonly pieceCount: number
  readonly resolvePlayerLabel?: (playerId: PlayerId) => string
}

export function MatchBoard({
  projection,
  turn,
  zoneCount,
  pieceCount,
  resolvePlayerLabel,
}: MatchBoardProps) {
  const currentSide = projection.currentSide

  return (
    <section
      aria-label="Match board"
      className="grid gap-4 rounded-xl border border-border/70 bg-background-elevated/40 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Match Board</h2>
          <p className="text-sm text-muted-foreground">
            Turn {turn.turnNumber} | {turn.phase}
            {turn.step ? ` / ${turn.step}` : ''}
          </p>
        </div>
        <Badge variant="outline">
          {zoneCount} zones | {pieceCount} pieces
        </Badge>
      </div>

      <div className="grid gap-3">
        {projection.opponentSides.map((side) => (
          <BoardSide
            key={side.player.playerId}
            side={side}
            playerLabel={resolveLabel(side.player.playerId, resolvePlayerLabel)}
          />
        ))}

        <div className="h-px bg-border/70" aria-hidden="true" />

        {currentSide ? (
          <BoardSide
            side={currentSide}
            playerLabel={resolveLabel(
              currentSide.player.playerId,
              resolvePlayerLabel,
            )}
          />
        ) : (
          <div className="rounded-lg border border-border/60 bg-background/70 p-3 text-sm text-muted-foreground">
            No current player side is available.
          </div>
        )}
      </div>
    </section>
  )
}

function BoardSide({
  side,
  playerLabel,
}: {
  readonly side: MatchBoardSideProjection
  readonly playerLabel: string
}) {
  const sideLabel =
    side.side === 'current' ? 'Current player side' : 'Opponent side'
  const supportZones = [
    ...side.libraryZones,
    ...side.resourceZones,
    ...side.discardZones,
  ]
  const handSection = (
    <ZoneSection
      title="Hand"
      ariaLabel={`${sideLabel} hand zones`}
      zones={side.handZones}
      gridClassName="grid-cols-1"
    />
  )
  const boardSurface = (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <ZoneSection
        title="Battlefield"
        ariaLabel={`${sideLabel} battlefield zones`}
        zones={side.battlefieldZones}
        gridClassName="sm:grid-cols-2"
      />
      <ZoneSection
        title="Support / Resources"
        ariaLabel={`${sideLabel} support zones`}
        zones={supportZones}
        gridClassName="sm:grid-cols-2 xl:grid-cols-1"
      />
    </div>
  )

  return (
    <section
      aria-label={sideLabel}
      className={cn(
        'grid gap-3 rounded-lg border border-border/60 bg-background/70 p-3',
        side.side === 'opponent' && 'bg-muted/20',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{playerLabel}</h3>
          <p className="text-xs text-muted-foreground">{sideLabel}</p>
        </div>
        <Badge variant={side.side === 'current' ? 'default' : 'secondary'}>
          Seat {side.player.seat}
        </Badge>
      </div>

      {side.side === 'opponent' ? handSection : null}
      {boardSurface}
      {side.side === 'current' ? handSection : null}

      {side.otherZones.length > 0 ? (
        <ZoneSection
          title="Other Zones"
          ariaLabel={`${sideLabel} other zones`}
          zones={side.otherZones}
          gridClassName="sm:grid-cols-2"
        />
      ) : null}
    </section>
  )
}

function ZoneSection({
  title,
  ariaLabel,
  zones,
  gridClassName,
}: {
  readonly title: string
  readonly ariaLabel: string
  readonly zones: readonly ProjectedMatchBoardZone[]
  readonly gridClassName: string
}) {
  if (zones.length === 0) {
    return null
  }

  return (
    <section
      aria-label={ariaLabel}
      className="grid content-start gap-2 rounded-md border border-border/45 bg-background/45 p-2"
    >
      <h4 className="text-xs font-semibold uppercase text-muted-foreground">
        {title}
      </h4>
      <div className={cn('grid gap-2', gridClassName)}>
        {zones.map((zone) => (
          <BoardZone
            key={zone.zoneId}
            zone={zone}
            visualMode={getZoneVisualMode(zone.role)}
          />
        ))}
      </div>
    </section>
  )
}

function BoardZone({
  zone,
  visualMode,
}: {
  readonly zone: ProjectedMatchBoardZone
  readonly visualMode: ZoneVisualMode
}) {
  const summaryStyle = isSummaryStyleZone(zone)

  return (
    <section
      aria-label={`${zone.label} zone`}
      className={cn(
        'grid min-h-24 gap-2 rounded-md border border-border/55 bg-card/65 p-2',
        visualMode === 'battlefield' && 'min-h-36',
        visualMode === 'hand' && 'min-h-28',
        summaryStyle && 'bg-muted/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-xs font-semibold uppercase text-muted-foreground">
            {zone.label}
          </h4>
          <p className="text-[11px] text-muted-foreground">
            {zone.layout.occupancy} | {zone.visibility}
          </p>
        </div>
        <Badge variant={summaryStyle ? 'secondary' : 'outline'}>
          {zone.occupantCount}
        </Badge>
      </div>

      {zone.layout.occupancy === 'slotted' && zone.slotIds.length > 0 ? (
        <SlottedZoneContents zone={zone} />
      ) : summaryStyle ? (
        <SummaryZoneContents zone={zone} />
      ) : visualMode === 'hand' ? (
        <PieceGrid zone={zone} />
      ) : (
        <PieceStack zone={zone} />
      )}
    </section>
  )
}

function SlottedZoneContents({
  zone,
}: {
  readonly zone: ProjectedMatchBoardZone
}) {
  const unassignedPieces = zone.pieces.filter(
    (piece) =>
      piece.slotId === undefined || !zone.slotIds.includes(piece.slotId),
  )

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {zone.slotIds.map((slotId) => {
          const piece = zone.pieces.find((candidate) => {
            return candidate.slotId === slotId
          })

          return (
            <div
              key={slotId}
              className="grid min-h-24 gap-1 rounded border border-dashed border-border/70 bg-background/60 p-1.5"
            >
              <span className="truncate text-[11px] text-muted-foreground">
                {slotId}
              </span>
              {piece ? (
                <BoardPiece piece={piece} compact={false} />
              ) : (
                <span className="self-center justify-self-center text-xs text-muted-foreground">
                  Empty slot
                </span>
              )}
            </div>
          )
        })}
      </div>

      {unassignedPieces.length > 0 ? (
        <div className="grid gap-1">
          {unassignedPieces.map((piece) => (
            <BoardPiece
              key={`${piece.refId}:${piece.position}`}
              piece={piece}
              compact
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SummaryZoneContents({
  zone,
}: {
  readonly zone: ProjectedMatchBoardZone
}) {
  if (zone.pieces.length === 0) {
    return (
      <div className="grid min-h-12 place-items-center rounded border border-dashed border-border/65 bg-background/45 text-xs text-muted-foreground">
        Empty zone
      </div>
    )
  }

  const visiblePieces = zone.pieces.slice(0, 4)
  const remainingCount = zone.pieces.length - visiblePieces.length

  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2 rounded border border-border/45 bg-background/45 px-2 py-1 text-[11px] text-muted-foreground">
        <span>Pile</span>
        <span>{zone.occupantCount} cards</span>
      </div>
      {visiblePieces.map((piece) => (
        <BoardPiece
          key={`${piece.refId}:${piece.position}`}
          piece={piece}
          compact
        />
      ))}
      {remainingCount > 0 ? (
        <div className="rounded border border-dashed border-border/65 bg-background/45 px-2 py-1 text-xs text-muted-foreground">
          {remainingCount} more
        </div>
      ) : null}
    </div>
  )
}

function PieceGrid({ zone }: { readonly zone: ProjectedMatchBoardZone }) {
  if (zone.pieces.length === 0) {
    return (
      <div className="grid min-h-16 place-items-center rounded border border-dashed border-border/65 bg-background/45 text-xs text-muted-foreground">
        Empty zone
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1">
      {zone.pieces.map((piece) => (
        <BoardPiece
          key={`${piece.refId}:${piece.position}`}
          piece={piece}
          compact
        />
      ))}
    </div>
  )
}

function PieceStack({ zone }: { readonly zone: ProjectedMatchBoardZone }) {
  if (zone.pieces.length === 0) {
    return (
      <div className="grid min-h-14 place-items-center rounded border border-dashed border-border/65 bg-background/45 text-xs text-muted-foreground">
        Empty zone
      </div>
    )
  }

  return (
    <div className="grid gap-1">
      {zone.pieces.map((piece) => (
        <BoardPiece
          key={`${piece.refId}:${piece.position}`}
          piece={piece}
          compact={false}
        />
      ))}
    </div>
  )
}

function BoardPiece({
  piece,
  compact = false,
}: {
  readonly piece: ProjectedMatchBoardPiece
  readonly compact?: boolean
}) {
  const identityVisible = piece.visibility === 'visible'
  const pieceLabel = identityVisible
    ? (piece.cardDefinitionId ?? piece.pieceId ?? piece.refId)
    : 'Hidden card'

  return (
    <article
      aria-label={`${pieceLabel}`}
      className={cn(
        'grid min-h-16 gap-2 rounded border border-border/65 bg-background-elevated/75 p-2 text-xs shadow-sm',
        compact && 'min-h-10 gap-1 p-1.5',
        piece.orientation === 'rest' && 'border-accent/70 bg-accent/10',
        piece.flags.length > 0 && 'ring-1 ring-accent/35',
      )}
    >
      <div className="break-words font-medium leading-snug">{pieceLabel}</div>
      {piece.orientation || piece.flags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {piece.orientation ? (
            <Badge
              variant={piece.orientation === 'rest' ? 'warning' : 'secondary'}
            >
              {formatStateLabel(piece.orientation)}
            </Badge>
          ) : null}
          {piece.flags.map((flag) => (
            <Badge key={flag} variant="warning">
              {formatStateLabel(flag)}
            </Badge>
          ))}
        </div>
      ) : null}
    </article>
  )
}

function getZoneVisualMode(role: MatchBoardZoneRole): ZoneVisualMode {
  switch (role) {
    case 'vanguard':
    case 'rear_guard':
      return 'battlefield'
    case 'hand':
      return 'hand'
    case 'deck':
    case 'ride_deck':
    case 'g_deck':
      return 'library'
    case 'damage':
    case 'soul':
      return 'resource'
    case 'drop':
    case 'bind':
      return 'discard'
    case 'other':
      return 'other'
  }
}

function isSummaryStyleZone(zone: ProjectedMatchBoardZone) {
  return (
    zone.role === 'deck' ||
    zone.role === 'ride_deck' ||
    zone.role === 'g_deck' ||
    zone.visibility === 'hidden'
  )
}

function resolveLabel(
  playerId: PlayerId,
  resolvePlayerLabel: ((playerId: PlayerId) => string) | undefined,
) {
  return resolvePlayerLabel?.(playerId) ?? playerId
}

function formatStateLabel(value: string) {
  return value
    .split(/[_:.]/)
    .filter((part) => part.length > 0)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}
