'use client'

import { useState } from 'react'
import type {
  PlayerId,
  VisibleGameChoiceRequest,
  VisibleGameState,
} from '@web-vg/rules-core'

import { Badge } from '@/components/ui/badge'
import type {
  BoardActionModel,
  BoardActionTarget,
} from '@/features/matches/play/board-actions'
import {
  type MatchBoardProjection,
  type MatchBoardSideProjection,
  type MatchBoardZoneRole,
  type ProjectedMatchBoardPiece,
  type ProjectedMatchBoardZone,
} from '@/features/matches/play/zone-projection'
import { cn } from '@/lib/utils'

interface MatchBoardProps {
  readonly projection: MatchBoardProjection
  readonly turn: VisibleGameState['turn']
  readonly zoneCount: number
  readonly pieceCount: number
  readonly activeRequest?: VisibleGameChoiceRequest
  readonly battle?: VisibleGameState['battle']
  readonly selectedPieceRefIds?: readonly string[]
  readonly selectedZoneIds?: readonly string[]
  readonly onTogglePieceTarget?: (piece: ProjectedMatchBoardPiece) => void
  readonly onToggleZoneTarget?: (zone: ProjectedMatchBoardZone) => void
  readonly resolvePlayerLabel?: (playerId: PlayerId) => string
  /** Click / drag-and-drop play from the server's legal actions. */
  readonly boardActions?: BoardActionsInteraction
}

export interface BoardActionsInteraction {
  readonly model: BoardActionModel
  readonly onSelectSource: (pieceId: string) => void
  /** `sourcePieceId` is set for drops; clicks use the selected card. */
  readonly onTarget: (target: BoardActionTarget, sourcePieceId?: string) => void
}

const BOARD_DRAG_TYPE = 'application/x-vg-piece'
type BoardActionRole = 'source' | 'selected' | 'target' | null

type BoardSideOrientation = 'opponent' | 'current'
type TargetVisualState = 'available' | 'selected' | 'unavailable' | 'none'
type CircleSlotKey =
  | 'front-left'
  | 'front-right'
  | 'back-left'
  | 'back-center'
  | 'back-right'

interface RequestTargetContext {
  readonly pieceRefIds: ReadonlySet<string>
  readonly pieceIds: ReadonlySet<string>
  readonly zoneIds: ReadonlySet<string>
  readonly hasPieceTargets: boolean
  readonly hasZoneTargets: boolean
}

interface BattleVisualContext {
  readonly attackerRefId?: string
  readonly attackerPieceId?: string
  readonly targetPieceId?: string
  readonly boosterRefId?: string
  readonly boosterPieceId?: string
  readonly guardianRefIds: ReadonlySet<string>
  readonly guardianPieceIds: ReadonlySet<string>
}

interface BoardInteractionContext {
  readonly requestTargets: RequestTargetContext | null
  readonly battle: BattleVisualContext | null
  readonly selectedPieceRefIds: ReadonlySet<string>
  readonly selectedZoneIds: ReadonlySet<string>
  readonly pinnedPieceRefId?: string
  readonly onPreviewPiece?: (piece: ProjectedMatchBoardPiece) => void
  readonly onClearPreviewPiece?: (piece: ProjectedMatchBoardPiece) => void
  readonly onPinPiece?: (piece: ProjectedMatchBoardPiece) => void
  readonly onTogglePieceTarget?: (piece: ProjectedMatchBoardPiece) => void
  readonly onToggleZoneTarget?: (zone: ProjectedMatchBoardZone) => void
  readonly boardActions?: BoardActionsInteraction
}

const REAR_GUARD_BACK_SLOTS: readonly CircleSlotKey[] = [
  'back-left',
  'back-center',
  'back-right',
]

const LEFT_STACK_ROLES: readonly MatchBoardZoneRole[] = [
  'damage',
  'order',
  'prison',
  'bind',
  'guardian',
]

const RIGHT_STACK_ROLES: readonly MatchBoardZoneRole[] = [
  'deck',
  'ride_deck',
  'drop',
  'soul',
  'g_deck',
  'energy',
  'other',
]

export function MatchBoard({
  projection,
  turn,
  zoneCount,
  pieceCount,
  activeRequest,
  battle,
  selectedPieceRefIds = [],
  selectedZoneIds = [],
  onTogglePieceTarget,
  onToggleZoneTarget,
  resolvePlayerLabel,
  boardActions,
}: MatchBoardProps) {
  const currentSide = projection.currentSide
  const [previewPiece, setPreviewPiece] =
    useState<ProjectedMatchBoardPiece | null>(null)
  const [pinnedPiece, setPinnedPiece] =
    useState<ProjectedMatchBoardPiece | null>(null)
  const inspectedPiece = pinnedPiece ?? previewPiece
  const interaction: BoardInteractionContext = {
    requestTargets: createRequestTargetContext(activeRequest),
    battle: createBattleVisualContext(battle),
    selectedPieceRefIds: new Set(selectedPieceRefIds),
    selectedZoneIds: new Set(selectedZoneIds),
    ...(pinnedPiece === null ? {} : { pinnedPieceRefId: pinnedPiece.refId }),
    onPreviewPiece: setPreviewPiece,
    onClearPreviewPiece: (piece) => {
      setPreviewPiece((current) =>
        current?.refId === piece.refId ? null : current,
      )
    },
    onPinPiece: (piece) => {
      setPinnedPiece((current) =>
        current?.refId === piece.refId ? null : piece,
      )
    },
    ...(onTogglePieceTarget === undefined ? {} : { onTogglePieceTarget }),
    ...(onToggleZoneTarget === undefined ? {} : { onToggleZoneTarget }),
    ...(boardActions === undefined ? {} : { boardActions }),
  }

  return (
    <section
      aria-label="Match board"
      data-playmat="vanguard"
      className="relative overflow-hidden rounded-[1.35rem] border border-cyan-300/25 bg-slate-950 p-3 text-slate-50 shadow-[0_28px_80px_-42px_rgba(34,211,238,0.75)] sm:p-4"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.24),transparent_34%),linear-gradient(135deg,rgba(14,165,233,0.22),transparent_28%,rgba(244,63,94,0.16)_72%,transparent)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-cyan-200/20" />
      </div>

      <div className="relative grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold tracking-normal">
              Table Surface
            </h2>
            <p className="text-sm text-slate-300">
              Turn {turn.turnNumber} | {formatStateLabel(turn.phase)}
              {turn.step ? ` / ${formatStateLabel(turn.step)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" aria-label="Projected table size">
              {zoneCount} zones | {pieceCount} cards
            </Badge>
            <Badge variant={battle === undefined ? 'secondary' : 'warning'}>
              {battle === undefined
                ? 'No battle'
                : formatBattleStatus(battle.status)}
            </Badge>
          </div>
        </div>

        {activeRequest === undefined ? null : (
          <PlaymatRequestBanner request={activeRequest} />
        )}

        <div className="grid gap-3">
          {projection.opponentSides.map((side) => (
            <PlaymatSide
              key={side.player.playerId}
              side={side}
              orientation="opponent"
              interaction={interaction}
              playerLabel={resolveLabel(
                side.player.playerId,
                resolvePlayerLabel,
              )}
            />
          ))}

          <BattleAxis
            projection={projection}
            battle={battle}
            interaction={interaction}
            resolvePlayerLabel={resolvePlayerLabel}
          />

          {currentSide ? (
            <PlaymatSide
              side={currentSide}
              orientation="current"
              interaction={interaction}
              playerLabel={resolveLabel(
                currentSide.player.playerId,
                resolvePlayerLabel,
              )}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4 text-sm text-slate-300">
              No current player side is available.
            </div>
          )}
        </div>
      </div>

      {inspectedPiece === null ? null : (
        <CardInspectPanel
          piece={inspectedPiece}
          pinned={pinnedPiece !== null}
          onClose={() => setPinnedPiece(null)}
        />
      )}
    </section>
  )
}

function PlaymatRequestBanner({
  request,
}: {
  readonly request: VisibleGameChoiceRequest
}) {
  return (
    <div
      aria-label="Current playmat request"
      className="relative z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/45 bg-amber-400/12 px-4 py-3 shadow-[0_0_28px_rgba(251,191,36,0.16)]"
    >
      <div>
        <div className="text-xs font-semibold uppercase text-amber-200">
          Current choice
        </div>
        <div className="text-sm font-semibold text-white">
          {formatPlaymatRequestPrompt(request)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="warning">{formatRequestType(request.type)}</Badge>
        {request.visibilityToViewer === 'redacted' ? (
          <Badge variant="secondary">Opponent choice</Badge>
        ) : (
          <Badge variant="success">Targets glow on mat</Badge>
        )}
      </div>
    </div>
  )
}

function PlaymatSide({
  side,
  orientation,
  interaction,
  playerLabel,
}: {
  readonly side: MatchBoardSideProjection
  readonly orientation: BoardSideOrientation
  readonly interaction: BoardInteractionContext
  readonly playerLabel: string
}) {
  const ariaSideLabel =
    side.side === 'current' ? 'Current player side' : 'Opponent side'
  const isCurrent = orientation === 'current'
  const leftStackZones = getStackZones(side, LEFT_STACK_ROLES)
  const rightStackZones = getStackZones(side, RIGHT_STACK_ROLES)
  const otherZones = side.zones.filter((zone) => {
    return (
      zone.role !== 'vanguard' &&
      zone.role !== 'rear_guard' &&
      zone.role !== 'hand' &&
      !leftStackZones.includes(zone) &&
      !rightStackZones.includes(zone)
    )
  })

  return (
    <section
      aria-label={ariaSideLabel}
      data-board-side={side.side}
      className={cn(
        'relative overflow-hidden rounded-[1.15rem] border bg-black/35 p-3 backdrop-blur',
        isCurrent
          ? 'border-cyan-300/35 shadow-[inset_0_0_48px_rgba(14,165,233,0.12)]'
          : 'border-rose-300/25 shadow-[inset_0_0_48px_rgba(244,63,94,0.1)]',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
      >
        <div
          className={cn(
            'absolute inset-x-10 h-24 rounded-full blur-3xl',
            isCurrent ? 'bottom-8 bg-cyan-400/20' : 'top-8 bg-rose-400/20',
          )}
        />
      </div>

      <div className="relative grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">{playerLabel}</h3>
            <p className="text-xs text-slate-300">
              {isCurrent ? 'Your playfield' : 'Opponent playfield'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={isCurrent ? 'default' : 'secondary'}>
              Seat {side.player.seat}
            </Badge>
            <Badge variant="outline">
              {formatStateLabel(side.player.status)}
            </Badge>
          </div>
        </div>

        {isCurrent ? null : (
          <HandBand
            ariaSideLabel={ariaSideLabel}
            side={side}
            interaction={interaction}
            orientation={orientation}
          />
        )}

        <div className="grid gap-3 xl:grid-cols-[9.25rem_minmax(0,1fr)_9.25rem]">
          <StackRail
            ariaLabel={`${ariaSideLabel} left stack zones`}
            zones={leftStackZones}
            interaction={interaction}
          />
          <BattlefieldMat
            ariaSideLabel={ariaSideLabel}
            side={side}
            interaction={interaction}
            orientation={orientation}
          />
          <StackRail
            ariaLabel={`${ariaSideLabel} support zones`}
            zones={rightStackZones}
            interaction={interaction}
          />
        </div>

        {isCurrent ? (
          <HandBand
            ariaSideLabel={ariaSideLabel}
            side={side}
            interaction={interaction}
            orientation={orientation}
          />
        ) : null}

        {otherZones.length === 0 ? null : (
          <StackRail
            ariaLabel={`${ariaSideLabel} other zones`}
            zones={otherZones}
            interaction={interaction}
            horizontal
          />
        )}
      </div>
    </section>
  )
}

function BattlefieldMat({
  ariaSideLabel,
  side,
  interaction,
  orientation,
}: {
  readonly ariaSideLabel: string
  readonly side: MatchBoardSideProjection
  readonly interaction: BoardInteractionContext
  readonly orientation: BoardSideOrientation
}) {
  const vanguardZone = findZoneByRole(side, 'vanguard')
  const rearGuardZone = findZoneByRole(side, 'rear_guard')
  const isOpponent = orientation === 'opponent'

  return (
    <section
      aria-label={`${ariaSideLabel} battlefield zones`}
      className="relative min-h-[19rem] overflow-hidden rounded-2xl border border-cyan-200/20 bg-slate-950/40 p-3 shadow-[inset_0_0_70px_rgba(14,165,233,0.12)]"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-75"
        aria-hidden
      >
        <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/30 bg-cyan-300/5 shadow-[0_0_46px_rgba(34,211,238,0.22)]" />
        <div className="absolute inset-x-10 top-1/2 h-px bg-cyan-200/25" />
        <div className="absolute left-1/2 top-8 h-[calc(100%-4rem)] w-px -translate-x-1/2 bg-cyan-200/20" />
      </div>

      <div
        className={cn(
          'relative grid min-h-[17rem] grid-rows-[1fr_1fr] gap-4',
          isOpponent && 'grid-rows-[1fr_1fr]',
        )}
      >
        {isOpponent ? (
          <>
            <RearGuardRow
              zone={rearGuardZone}
              slots={REAR_GUARD_BACK_SLOTS}
              interaction={interaction}
              rowLabel="Back row"
            />
            <FrontRow
              vanguardZone={vanguardZone}
              rearGuardZone={rearGuardZone}
              interaction={interaction}
              rowLabel="Front row"
            />
          </>
        ) : (
          <>
            <FrontRow
              vanguardZone={vanguardZone}
              rearGuardZone={rearGuardZone}
              interaction={interaction}
              rowLabel="Front row"
            />
            <RearGuardRow
              zone={rearGuardZone}
              slots={REAR_GUARD_BACK_SLOTS}
              interaction={interaction}
              rowLabel="Back row"
            />
          </>
        )}
      </div>
    </section>
  )
}

function FrontRow({
  vanguardZone,
  rearGuardZone,
  interaction,
  rowLabel,
}: {
  readonly vanguardZone: ProjectedMatchBoardZone | undefined
  readonly rearGuardZone: ProjectedMatchBoardZone | undefined
  readonly interaction: BoardInteractionContext
  readonly rowLabel: string
}) {
  return (
    <div aria-label={rowLabel} className="grid grid-cols-3 gap-3">
      <PlaymatCircle
        label="Front left"
        slotKey="front-left"
        zone={rearGuardZone}
        piece={findPieceForSlot(rearGuardZone, 'front-left')}
        interaction={interaction}
        circleKind="rear_guard"
      />
      <PlaymatCircle
        label="Vanguard"
        slotKey={null}
        zone={vanguardZone}
        piece={vanguardZone?.pieces[0]}
        interaction={interaction}
        circleKind="vanguard"
      />
      <PlaymatCircle
        label="Front right"
        slotKey="front-right"
        zone={rearGuardZone}
        piece={findPieceForSlot(rearGuardZone, 'front-right')}
        interaction={interaction}
        circleKind="rear_guard"
      />
    </div>
  )
}

function RearGuardRow({
  zone,
  slots,
  interaction,
  rowLabel,
}: {
  readonly zone: ProjectedMatchBoardZone | undefined
  readonly slots: readonly CircleSlotKey[]
  readonly interaction: BoardInteractionContext
  readonly rowLabel: string
}) {
  return (
    <div aria-label={rowLabel} className="grid grid-cols-3 gap-3">
      {slots.map((slot) => (
        <PlaymatCircle
          key={slot}
          label={formatSlotLabel(slot)}
          slotKey={slot}
          zone={zone}
          piece={findPieceForSlot(zone, slot)}
          interaction={interaction}
          circleKind="rear_guard"
        />
      ))}
    </div>
  )
}

function PlaymatCircle({
  label,
  slotKey,
  zone,
  piece,
  interaction,
  circleKind,
}: {
  readonly label: string
  readonly slotKey: CircleSlotKey | null
  readonly zone: ProjectedMatchBoardZone | undefined
  readonly piece: ProjectedMatchBoardPiece | undefined
  readonly interaction: BoardInteractionContext
  readonly circleKind: 'vanguard' | 'rear_guard'
}) {
  const slotId =
    slotKey === null || zone === undefined
      ? undefined
      : findSlotId(zone, slotKey)
  const zoneTargetState =
    zone === undefined ? 'none' : getZoneTargetState(zone, interaction)
  const canSelectZone =
    piece === undefined &&
    zone !== undefined &&
    (zoneTargetState === 'available' || zoneTargetState === 'selected') &&
    interaction.onToggleZoneTarget !== undefined

  return (
    <div
      onDragOver={(event) => {
        if (
          interaction.boardActions !== undefined &&
          piece === undefined &&
          slotId !== undefined
        ) {
          event.preventDefault()
        }
      }}
      onDrop={(event) => {
        const sourcePieceId = event.dataTransfer.getData(BOARD_DRAG_TYPE)

        if (
          interaction.boardActions !== undefined &&
          piece === undefined &&
          slotId !== undefined &&
          sourcePieceId !== ''
        ) {
          event.preventDefault()
          interaction.boardActions.onTarget(
            { kind: 'slot', slotId },
            sourcePieceId,
          )
        }
      }}
      data-playmat-circle={circleKind}
      data-slot-id={slotId}
      data-target-state={piece === undefined ? zoneTargetState : undefined}
      className={cn(
        'relative grid min-h-36 place-items-center rounded-[1rem] border border-cyan-100/20 bg-black/25 p-2',
        circleKind === 'vanguard' &&
          'border-cyan-200/45 bg-cyan-300/10 shadow-[0_0_34px_rgba(34,211,238,0.22)]',
        circleKind === 'rear_guard' && 'border-amber-100/22 bg-amber-200/5',
        zoneTargetState === 'available' &&
          'border-emerald-300/80 bg-emerald-400/12 ring-2 ring-emerald-300/35',
        zoneTargetState === 'selected' &&
          'border-emerald-200 bg-emerald-400/18 ring-2 ring-emerald-200/55',
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-4 rounded-full border border-dashed border-white/18',
          circleKind === 'vanguard' && 'border-cyan-100/45',
        )}
      />
      <div className="relative grid w-full gap-2">
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-normal text-slate-300">
          <span>{label}</span>
          {slotId === undefined && slotKey !== null ? (
            <span className="text-slate-500">No slot</span>
          ) : null}
        </div>
        {piece === undefined || zone === undefined ? (
          slotId !== undefined &&
          interaction.boardActions?.model.targetSlotIds.has(slotId) === true ? (
            <button
              type="button"
              data-board-action="target"
              className="grid min-h-24 place-items-center rounded-xl border border-sky-200/60 bg-sky-400/12 px-2 text-center text-xs font-semibold text-sky-50 ring-2 ring-sky-300/40 hover:bg-sky-400/20"
              onClick={() =>
                interaction.boardActions?.onTarget({ kind: 'slot', slotId })
              }
            >
              Call here
            </button>
          ) : (
            <EmptyCircle
              label={label}
              zone={zone}
              zoneTargetState={zoneTargetState}
              canSelectZone={canSelectZone}
              onSelect={() => {
                if (zone !== undefined) {
                  interaction.onToggleZoneTarget?.(zone)
                }
              }}
            />
          )
        ) : (
          <BoardPiece
            piece={piece}
            zone={zone}
            interaction={interaction}
            presentation="circle"
          />
        )}
      </div>
    </div>
  )
}

function EmptyCircle({
  label,
  zone,
  zoneTargetState,
  canSelectZone,
  onSelect,
}: {
  readonly label: string
  readonly zone: ProjectedMatchBoardZone | undefined
  readonly zoneTargetState: TargetVisualState
  readonly canSelectZone: boolean
  readonly onSelect: () => void
}) {
  if (canSelectZone) {
    return (
      <button
        type="button"
        className="grid min-h-24 place-items-center rounded-xl border border-emerald-200/45 bg-emerald-400/10 px-2 text-center text-xs font-semibold text-emerald-50 hover:bg-emerald-400/18"
        onClick={onSelect}
      >
        {zoneTargetState === 'selected' ? 'Selected circle' : 'Select circle'}
      </button>
    )
  }

  return (
    <div className="grid min-h-24 place-items-center rounded-xl border border-dashed border-white/14 bg-black/20 px-2 text-center text-xs text-slate-400">
      {zone === undefined ? `${label} unavailable` : 'Open circle'}
    </div>
  )
}

function HandBand({
  ariaSideLabel,
  side,
  interaction,
  orientation,
}: {
  readonly ariaSideLabel: string
  readonly side: MatchBoardSideProjection
  readonly interaction: BoardInteractionContext
  readonly orientation: BoardSideOrientation
}) {
  const handZones = side.handZones

  if (handZones.length === 0) {
    return null
  }

  return (
    <section
      aria-label={`${ariaSideLabel} hand zones`}
      className={cn(
        'rounded-2xl border border-white/10 bg-black/30 p-3',
        orientation === 'current'
          ? 'shadow-[0_-12px_40px_-34px_rgba(34,211,238,0.9)]'
          : '',
      )}
    >
      {handZones.map((zone) => (
        <div key={zone.zoneId} className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold uppercase text-slate-300">
                Hand
              </h4>
              <p className="text-[11px] text-slate-400">
                {formatZoneVisibilityLine(zone)}
              </p>
            </div>
            <Badge variant="outline">{zone.occupantCount}</Badge>
          </div>
          <div
            className={cn(
              'flex min-h-24 items-end overflow-x-auto px-1 pb-1',
              zone.pieces.length > 0 ? '-space-x-5' : 'space-x-0',
            )}
          >
            {zone.pieces.length === 0 ? (
              <div className="grid min-h-20 min-w-28 place-items-center rounded-xl border border-dashed border-white/15 bg-black/20 text-xs text-slate-400">
                Empty hand
              </div>
            ) : (
              zone.pieces.map((piece, index) => (
                <div
                  key={`${piece.refId}:${piece.position}`}
                  className="min-w-[7.25rem]"
                  style={{
                    transform: `translateY(${
                      Math.abs(index - Math.floor(zone.pieces.length / 2)) * 2
                    }px)`,
                  }}
                >
                  <BoardPiece
                    piece={piece}
                    zone={zone}
                    interaction={interaction}
                    presentation="hand"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </section>
  )
}

function StackRail({
  ariaLabel,
  zones,
  interaction,
  horizontal = false,
}: {
  readonly ariaLabel: string
  readonly zones: readonly ProjectedMatchBoardZone[]
  readonly interaction: BoardInteractionContext
  readonly horizontal?: boolean
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'grid content-start gap-2',
        horizontal && 'sm:grid-cols-2 xl:grid-cols-4',
      )}
    >
      {zones.length === 0 ? (
        <div className="hidden xl:block" aria-hidden="true" />
      ) : (
        zones.map((zone) => (
          <StackZone key={zone.zoneId} zone={zone} interaction={interaction} />
        ))
      )}
    </section>
  )
}

function StackZone({
  zone,
  interaction,
}: {
  readonly zone: ProjectedMatchBoardZone
  readonly interaction: BoardInteractionContext
}) {
  const zoneTargetState = getZoneTargetState(zone, interaction)
  const canSelect =
    (zoneTargetState === 'available' || zoneTargetState === 'selected') &&
    interaction.onToggleZoneTarget !== undefined
  const topPieces = zone.pieces.slice(0, 2)

  return (
    <section
      aria-label={`${zone.label} zone`}
      data-zone-role={zone.role}
      data-target-state={zoneTargetState}
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/12 bg-black/30 p-2 shadow-[inset_0_0_22px_rgba(15,23,42,0.55)]',
        zone.role === 'damage' && 'border-rose-200/35 bg-rose-400/8',
        zone.role === 'deck' && 'border-cyan-200/25 bg-cyan-300/8',
        zone.role === 'drop' && 'border-slate-200/25 bg-slate-300/8',
        zoneTargetState === 'available' &&
          'border-emerald-300/75 bg-emerald-400/12 ring-2 ring-emerald-300/30',
        zoneTargetState === 'selected' &&
          'border-emerald-200 bg-emerald-400/18 ring-2 ring-emerald-200/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-[11px] font-semibold uppercase text-slate-300">
            {zone.label}
          </h4>
          <p className="text-[10px] text-slate-500">
            {formatZoneKind(zone.role)}
          </p>
        </div>
        <Badge variant={zone.occupantCount > 0 ? 'secondary' : 'outline'}>
          {zone.occupantCount}
        </Badge>
      </div>

      <div className="mt-2 grid min-h-20 gap-1">
        {zone.pieces.length === 0 ? (
          <div className="grid min-h-16 place-items-center rounded-lg border border-dashed border-white/12 bg-black/20 text-[11px] text-slate-500">
            Empty stack
          </div>
        ) : (
          <>
            {topPieces.map((piece) => (
              <BoardPiece
                key={`${piece.refId}:${piece.position}`}
                piece={piece}
                zone={zone}
                interaction={interaction}
                presentation="stack"
              />
            ))}
            {zone.pieces.length > topPieces.length ? (
              <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                +{zone.pieces.length - topPieces.length} more
              </div>
            ) : null}
          </>
        )}
      </div>

      {canSelect ? (
        <button
          type="button"
          className="mt-2 w-full rounded-lg border border-emerald-200/40 bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-50 hover:bg-emerald-400/18"
          onClick={() => interaction.onToggleZoneTarget?.(zone)}
        >
          {zoneTargetState === 'selected' ? 'Selected zone' : 'Select zone'}
        </button>
      ) : null}
    </section>
  )
}

function BattleAxis({
  projection,
  battle,
  interaction,
  resolvePlayerLabel,
}: {
  readonly projection: MatchBoardProjection
  readonly battle: VisibleGameState['battle'] | undefined
  readonly interaction: BoardInteractionContext
  readonly resolvePlayerLabel: ((playerId: PlayerId) => string) | undefined
}) {
  const attackerLabel =
    battle === undefined
      ? null
      : resolveBattlePieceLabel(projection, battle.attacker)
  const targetLabel =
    battle === undefined
      ? null
      : battle.target.kind === 'player'
        ? resolveLabel(battle.target.playerId, resolvePlayerLabel)
        : resolveBattlePieceLabel(projection, {
            refId: battle.target.pieceId as unknown as string,
            pieceId: battle.target.pieceId,
          })

  return (
    <div
      aria-label="Battle lane"
      data-battle-active={battle === undefined ? 'false' : 'true'}
      className={cn(
        'relative overflow-hidden rounded-2xl border px-4 py-3 text-sm',
        battle === undefined
          ? 'border-white/10 bg-white/[0.03] text-slate-400'
          : 'border-amber-200/50 bg-amber-300/12 text-white shadow-[0_0_36px_rgba(251,191,36,0.18)]',
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px bg-gradient-to-r from-transparent via-amber-200/60 to-transparent" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-400">
            Central battle lane
          </div>
          <div className="font-semibold">
            {battle === undefined
              ? 'Idle board'
              : `${attackerLabel ?? 'Attacker'} -> ${targetLabel ?? 'Target'}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {battle === undefined ? (
            <Badge variant="outline">No attack declared</Badge>
          ) : (
            <>
              <Badge variant="warning">
                {formatBattleStatus(battle.status)}
              </Badge>
              {interaction.battle?.boosterRefId === undefined ? null : (
                <Badge variant="secondary">Boost linked</Badge>
              )}
              {battle.status === 'guard_requested' ? (
                <Badge variant="success">Guard window</Badge>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function BoardPiece({
  piece,
  zone,
  interaction,
  presentation,
}: {
  readonly piece: ProjectedMatchBoardPiece
  readonly zone: ProjectedMatchBoardZone
  readonly interaction: BoardInteractionContext
  readonly presentation: 'circle' | 'hand' | 'stack'
}) {
  const identityVisible = piece.visibility === 'visible'
  const card = identityVisible ? piece.card : undefined
  const rawLabel = identityVisible
    ? (piece.cardDefinitionId ?? piece.pieceId ?? piece.refId)
    : 'Hidden card'
  const pieceLabel = identityVisible
    ? (card?.name ?? formatCardLabel(rawLabel))
    : 'Hidden card'
  const targetState = getPieceTargetState(piece, zone, interaction)
  const battleRole = getPieceBattleRole(piece, interaction.battle)
  const selectable =
    (targetState === 'available' || targetState === 'selected') &&
    interaction.onTogglePieceTarget !== undefined
  const boardRole = getBoardActionRole(piece, interaction.boardActions)
  const compact = presentation !== 'circle'
  const inspectPinned = interaction.pinnedPieceRefId === piece.refId
  const renderer = card?.imageUrl ? 'image' : 'fallback'

  return (
    <button
      type="button"
      onClick={() => {
        if (selectable) {
          interaction.onTogglePieceTarget?.(piece)
        } else if (boardRole === 'target' && piece.pieceId !== undefined) {
          interaction.boardActions?.onTarget({
            kind: 'piece',
            pieceId: piece.pieceId,
          })
        } else if (
          (boardRole === 'source' || boardRole === 'selected') &&
          piece.pieceId !== undefined
        ) {
          interaction.boardActions?.onSelectSource(piece.pieceId)
        }
        interaction.onPinPiece?.(piece)
      }}
      draggable={boardRole === 'source' || boardRole === 'selected'}
      onDragStart={(event) => {
        if (piece.pieceId !== undefined) {
          event.dataTransfer.setData(BOARD_DRAG_TYPE, piece.pieceId)
          event.dataTransfer.effectAllowed = 'move'
          interaction.boardActions?.onSelectSource(piece.pieceId)
        }
      }}
      onDragOver={(event) => {
        if (interaction.boardActions !== undefined) {
          event.preventDefault()
        }
      }}
      onDrop={(event) => {
        const sourcePieceId = event.dataTransfer.getData(BOARD_DRAG_TYPE)

        if (
          interaction.boardActions !== undefined &&
          piece.pieceId !== undefined &&
          sourcePieceId !== '' &&
          sourcePieceId !== piece.pieceId
        ) {
          event.preventDefault()
          interaction.boardActions.onTarget(
            { kind: 'piece', pieceId: piece.pieceId },
            sourcePieceId,
          )
        }
      }}
      data-board-action={boardRole ?? undefined}
      onMouseEnter={() => interaction.onPreviewPiece?.(piece)}
      onMouseLeave={() => interaction.onClearPreviewPiece?.(piece)}
      onFocus={() => interaction.onPreviewPiece?.(piece)}
      onBlur={() => interaction.onClearPreviewPiece?.(piece)}
      aria-label={
        boardRole === 'target'
          ? `${pieceLabel} - play target`
          : boardRole === 'selected'
            ? `${pieceLabel} - selected to play`
            : targetState === 'available'
              ? `${pieceLabel} - legal target`
              : targetState === 'selected'
                ? `${pieceLabel} - selected target`
                : battleRole === null
                  ? `${pieceLabel}`
                  : `${pieceLabel} - ${battleRole}`
      }
      title={identityVisible ? pieceLabel : undefined}
      data-card-identity={identityVisible ? rawLabel : undefined}
      data-card-name={identityVisible ? pieceLabel : undefined}
      data-card-renderer={renderer}
      data-card-visibility={piece.visibility}
      data-target-state={targetState}
      data-battle-role={battleRole ?? undefined}
      className={cn(
        'relative grid overflow-visible rounded-xl border bg-transparent text-left shadow-lg transition',
        compact ? 'min-h-[5.75rem] text-[11px]' : 'min-h-[8.75rem] text-xs',
        identityVisible ? 'border-white/18' : 'border-cyan-100/20',
        piece.orientation === 'rest' && 'rotate-90 border-amber-200/70',
        piece.flags.length > 0 && 'ring-1 ring-amber-300/40',
        'cursor-pointer hover:-translate-y-1 hover:shadow-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/75',
        targetState === 'available' &&
          'border-emerald-200 ring-2 ring-emerald-300/45',
        targetState === 'selected' &&
          'border-emerald-100 ring-2 ring-emerald-100/70',
        targetState === 'unavailable' && 'opacity-35 saturate-50',
        boardRole === 'source' && 'border-sky-200/60',
        boardRole === 'selected' && 'border-sky-100 ring-2 ring-sky-200/70',
        boardRole === 'target' && 'border-sky-200 ring-2 ring-sky-300/55',
        battleRole === 'attacker' && 'border-rose-200 ring-2 ring-rose-300/45',
        battleRole === 'target' && 'border-amber-100 ring-2 ring-amber-200/55',
        battleRole === 'booster' && 'border-cyan-100 ring-2 ring-cyan-200/45',
        battleRole === 'guardian' &&
          'border-violet-100 ring-2 ring-violet-200/45',
        inspectPinned && 'ring-2 ring-fuchsia-200/75',
      )}
    >
      <PlayableCardFace
        piece={piece}
        card={card}
        label={pieceLabel}
        zoneLabel={zone.label}
        compact={compact}
      />

      {piece.orientation ||
      piece.flags.length > 0 ||
      piece.powerModifier !== undefined ||
      piece.criticalModifier !== undefined ||
      battleRole !== null ||
      targetState === 'available' ||
      targetState === 'selected' ? (
        <div className="relative flex flex-wrap gap-1 self-end">
          {targetState === 'available' ? (
            <Badge variant="success">Legal target</Badge>
          ) : null}
          {targetState === 'selected' ? (
            <Badge variant="success">Selected</Badge>
          ) : null}
          {battleRole === null ? null : (
            <Badge variant={battleRole === 'target' ? 'warning' : 'secondary'}>
              {formatStateLabel(battleRole)}
            </Badge>
          )}
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
          {piece.powerModifier !== undefined && piece.powerModifier !== 0 ? (
            <Badge variant={piece.powerModifier > 0 ? 'success' : 'warning'}>
              {formatSigned(piece.powerModifier)} power
            </Badge>
          ) : null}
          {piece.criticalModifier !== undefined &&
          piece.criticalModifier !== 0 ? (
            <Badge variant={piece.criticalModifier > 0 ? 'success' : 'warning'}>
              {formatSigned(piece.criticalModifier)} critical
            </Badge>
          ) : null}
        </div>
      ) : null}
    </button>
  )
}

function PlayableCardFace({
  piece,
  card,
  label,
  zoneLabel,
  compact,
}: {
  readonly piece: ProjectedMatchBoardPiece
  readonly card: ProjectedMatchBoardPiece['card']
  readonly label: string
  readonly zoneLabel: string
  readonly compact: boolean
}) {
  if (piece.visibility !== 'visible') {
    return (
      <>
        <span className="sr-only">Hidden card</span>
        <div
          aria-hidden="true"
          className={cn(
            'relative grid aspect-[63/88] w-full min-w-20 overflow-hidden rounded-xl border border-cyan-100/25 bg-[radial-gradient(circle_at_50%_22%,rgba(34,211,238,0.32),rgba(15,23,42,0.95)_48%,rgba(2,6,23,1))] p-2 text-cyan-100 shadow-[inset_0_0_28px_rgba(34,211,238,0.18)]',
            compact ? 'max-w-[7.25rem]' : 'max-w-[8.5rem]',
          )}
        >
          <div className="absolute inset-2 rounded-lg border border-cyan-100/20" />
          <div className="absolute inset-5 rounded-full border border-cyan-100/25" />
          <div className="relative grid place-items-center text-center text-[10px] font-semibold uppercase">
            Vanguard
            <span className="mt-1 block text-[9px] text-cyan-100/70">
              Card back
            </span>
          </div>
        </div>
      </>
    )
  }

  const cardType = card?.cardType ?? 'unit'
  const trigger = card?.triggerType
  const keywords = card?.keywords ?? []
  const effectRefs = card?.effectRefs ?? []
  const hasRulesLine = keywords.length > 0 || effectRefs.length > 0

  return (
    <div
      className={cn(
        'relative grid aspect-[63/88] w-full min-w-20 overflow-hidden rounded-xl border border-white/18 bg-gradient-to-b from-slate-100 via-slate-200 to-slate-950 p-1.5 text-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]',
        compact ? 'max-w-[7.25rem]' : 'max-w-[8.5rem]',
      )}
    >
      <div className="rounded-md border border-slate-950/70 bg-slate-950 px-1.5 py-1 text-[10px] font-bold leading-tight text-white">
        <span className="line-clamp-2">{label}</span>
      </div>
      <div
        className={cn(
          'relative my-1 overflow-hidden rounded-md border border-slate-950/45 bg-[radial-gradient(circle_at_50%_30%,rgba(125,211,252,0.86),rgba(15,23,42,0.86)_58%,rgba(2,6,23,1))]',
          compact ? 'min-h-9' : 'min-h-14',
        )}
        role="img"
        aria-label={`${label} card art fallback`}
        style={
          card?.imageUrl
            ? {
                backgroundImage: `linear-gradient(rgba(2,6,23,0.08),rgba(2,6,23,0.12)), url("${card.imageUrl}")`,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
              }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.2),transparent_42%,rgba(255,255,255,0.08)_72%,transparent)]" />
        <div className="absolute bottom-1 left-1 rounded bg-black/65 px-1 text-[9px] font-semibold uppercase text-white">
          {formatStateLabel(cardType)}
        </div>
        {trigger === null || trigger === undefined ? null : (
          <div className="absolute right-1 top-1 rounded bg-amber-300 px-1 text-[9px] font-bold uppercase text-slate-950">
            {formatStateLabel(trigger)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-[9px] font-bold">
        <MiniStat label="G" value={card?.grade ?? '-'} />
        <MiniStat label="P" value={formatShortNumber(card?.power)} />
        <MiniStat label="C" value={card?.critical ?? '-'} />
      </div>
      <div className="mt-1 min-h-6 rounded border border-slate-950/35 bg-white/82 px-1 py-0.5 text-[9px] leading-tight text-slate-800">
        {hasRulesLine ? (
          <span className="line-clamp-2">
            {[...keywords, ...effectRefs]
              .slice(0, 2)
              .map(formatStateLabel)
              .join(' | ')}
          </span>
        ) : (
          <span className="text-slate-500">
            {card?.nation ? formatStateLabel(card.nation) : zoneLabel}
          </span>
        )}
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | number
}) {
  return (
    <span className="rounded bg-slate-950 px-1 py-0.5 text-white">
      {label} {value}
    </span>
  )
}

function CardInspectPanel({
  piece,
  pinned,
  onClose,
}: {
  readonly piece: ProjectedMatchBoardPiece
  readonly pinned: boolean
  readonly onClose: () => void
}) {
  const visible = piece.visibility === 'visible'
  const card = visible ? piece.card : undefined
  const rawLabel = visible
    ? (piece.cardDefinitionId ?? piece.pieceId ?? piece.refId)
    : 'Hidden card'
  const label = visible
    ? (card?.name ?? formatCardLabel(rawLabel))
    : 'Hidden card'

  return (
    <aside
      aria-label="Card inspect"
      data-card-inspect={pinned ? 'pinned' : 'preview'}
      className="absolute right-4 top-24 z-30 grid w-[min(24rem,calc(100%-2rem))] gap-3 rounded-2xl border border-cyan-100/35 bg-slate-950/96 p-4 text-slate-50 shadow-[0_24px_80px_-34px_rgba(34,211,238,0.8)] backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-cyan-200">
            {pinned ? 'Pinned card inspect' : 'Card preview'}
          </div>
          <h3 className="text-lg font-semibold leading-tight">{label}</h3>
        </div>
        {pinned ? (
          <button
            type="button"
            className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
            onClick={onClose}
          >
            Close
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <PlayableCardFace
          piece={piece}
          card={card}
          label={label}
          zoneLabel="Inspect"
          compact={false}
        />
        <div className="grid content-start gap-3 text-sm">
          {visible ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <InspectStat label="Grade" value={card?.grade ?? '-'} />
                <InspectStat label="Power" value={formatNumber(card?.power)} />
                <InspectStat
                  label="Shield"
                  value={formatNumber(card?.shield)}
                />
                <InspectStat label="Critical" value={card?.critical ?? '-'} />
              </div>
              <div className="grid gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <InspectLine
                  label="Type"
                  value={formatStateLabel(card?.cardType ?? 'card')}
                />
                <InspectLine
                  label="Nation"
                  value={
                    card?.nation ? formatStateLabel(card.nation) : 'Unknown'
                  }
                />
                <InspectLine
                  label="Clan"
                  value={card?.clan ? formatStateLabel(card.clan) : 'None'}
                />
                <InspectLine
                  label="Trigger"
                  value={
                    card?.triggerType
                      ? formatStateLabel(card.triggerType)
                      : 'None'
                  }
                />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="text-xs font-semibold uppercase text-slate-400">
                  Text / Effects
                </div>
                <div className="mt-2 grid gap-1 text-sm text-slate-100">
                  {card?.keywords.length ? (
                    <p>
                      Keywords: {card.keywords.map(formatStateLabel).join(', ')}
                    </p>
                  ) : null}
                  {card?.effectRefs.length ? (
                    <p>
                      Effect refs:{' '}
                      {card.effectRefs.map((effectRef) => (
                        <code key={effectRef} className="mr-1 text-cyan-100">
                          {effectRef}
                        </code>
                      ))}
                    </p>
                  ) : null}
                  {!card?.keywords.length && !card?.effectRefs.length ? (
                    <p className="text-slate-400">
                      No printed effect reference is published for this visible
                      card yet.
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-slate-300">
              This card is hidden by the participant-safe projection. The client
              shows a card back and does not reveal name, stats, or effect text.
            </p>
          )}
        </div>
      </div>
    </aside>
  )
}

function InspectStat({
  label,
  value,
}: {
  readonly label: string
  readonly value: string | number
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-slate-400">
        {label}
      </div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function InspectLine({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-100">{value}</span>
    </div>
  )
}

function getBoardActionRole(
  piece: ProjectedMatchBoardPiece,
  boardActions: BoardActionsInteraction | undefined,
): BoardActionRole {
  const pieceId = piece.pieceId

  if (boardActions === undefined || pieceId === undefined) {
    return null
  }

  const { model } = boardActions

  if (model.targetPieceIds.has(pieceId)) {
    return 'target'
  }

  if (model.selectedSourcePieceId === pieceId) {
    return 'selected'
  }

  return model.sourcePieceIds.has(pieceId) ? 'source' : null
}

function findZoneByRole(
  side: MatchBoardSideProjection,
  role: MatchBoardZoneRole,
) {
  return side.zones.find((zone) => zone.role === role)
}

function getStackZones(
  side: MatchBoardSideProjection,
  roles: readonly MatchBoardZoneRole[],
) {
  return side.zones
    .filter((zone) => roles.includes(zone.role))
    .sort((left, right) => {
      const leftIndex = roles.indexOf(left.role)
      const rightIndex = roles.indexOf(right.role)

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex
      }

      return left.label.localeCompare(right.label)
    })
}

function findSlotId(
  zone: ProjectedMatchBoardZone,
  slotKey: CircleSlotKey,
): string | undefined {
  return zone.slotIds.find((slotId) => {
    return slotId.toLowerCase().includes(slotKey)
  }) as string | undefined
}

function findPieceForSlot(
  zone: ProjectedMatchBoardZone | undefined,
  slotKey: CircleSlotKey,
) {
  if (zone === undefined) {
    return undefined
  }

  const slotId = findSlotId(zone, slotKey)

  if (slotId === undefined) {
    return undefined
  }

  return zone.pieces.find((piece) => piece.slotId === slotId)
}

function formatSlotLabel(slot: CircleSlotKey) {
  return slot
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatZoneKind(role: MatchBoardZoneRole) {
  switch (role) {
    case 'vanguard':
      return 'central unit'
    case 'rear_guard':
      return 'rear-guard circles'
    case 'hand':
      return 'private hand'
    case 'deck':
      return 'main deck'
    case 'ride_deck':
      return 'ride line'
    case 'g_deck':
      return 'extra deck'
    case 'damage':
      return 'damage track'
    case 'soul':
      return 'soul stack'
    case 'drop':
      return 'discard pile'
    case 'bind':
      return 'bound cards'
    case 'order':
      return 'order area'
    case 'prison':
      return 'prison area'
    case 'guardian':
      return 'guard circle'
    case 'energy':
      return 'energy area'
    case 'other':
      return 'auxiliary'
  }
}

function formatZoneVisibilityLine(zone: ProjectedMatchBoardZone) {
  const access = zone.visibility === 'public' ? 'Table zone' : 'Private zone'

  switch (zone.contentsVisibility) {
    case 'full':
      return `${access} | cards visible`
    case 'masked':
      return `${access} | card backs shown`
  }
}

function createRequestTargetContext(
  request: VisibleGameChoiceRequest | undefined,
): RequestTargetContext | null {
  if (request === undefined || request.visibilityToViewer !== 'full') {
    return null
  }

  const pieceRefs = [
    ...(request.eligiblePieces ?? []),
    ...(request.powerEligiblePieces ?? []),
    ...(request.criticalEligiblePieces ?? []),
    ...(request.standEligiblePieces ?? []),
    ...(request.healEligiblePieces ?? []),
    ...(request.handPieces ?? []),
    ...(request.interceptPieces ?? []),
  ]
  const pieceRefIds = new Set(pieceRefs.map((piece) => piece.refId))
  const pieceIds = new Set(
    pieceRefs
      .map((piece) => piece.pieceId)
      .filter((pieceId): pieceId is NonNullable<typeof pieceId> => {
        return pieceId !== undefined
      })
      .map((pieceId) => pieceId as string),
  )

  for (const target of request.eligibleTargets ?? []) {
    if (target.kind === 'piece') {
      pieceIds.add(target.pieceId as string)
    }
  }

  const zoneIds = new Set<string>()

  for (const zone of request.eligibleZones ?? []) {
    zoneIds.add(zone.zoneId as string)
  }

  for (const zoneId of [
    request.handZoneId,
    request.deckZoneId,
    request.guardZoneId,
  ]) {
    if (zoneId !== undefined) {
      zoneIds.add(zoneId as string)
    }
  }

  return {
    pieceRefIds,
    pieceIds,
    zoneIds,
    hasPieceTargets: pieceRefIds.size > 0 || pieceIds.size > 0,
    hasZoneTargets: zoneIds.size > 0,
  }
}

function createBattleVisualContext(
  battle: VisibleGameState['battle'] | undefined,
): BattleVisualContext | null {
  if (battle === undefined) {
    return null
  }

  return {
    attackerRefId: battle.attacker.refId,
    ...(battle.attacker.pieceId === undefined
      ? {}
      : { attackerPieceId: battle.attacker.pieceId as string }),
    ...(battle.target.kind === 'piece'
      ? { targetPieceId: battle.target.pieceId as string }
      : {}),
    ...(battle.boostingPiece === undefined
      ? {}
      : {
          boosterRefId: battle.boostingPiece.refId,
          ...(battle.boostingPiece.pieceId === undefined
            ? {}
            : { boosterPieceId: battle.boostingPiece.pieceId as string }),
        }),
    guardianRefIds: new Set(battle.guardPieces.map((piece) => piece.refId)),
    guardianPieceIds: new Set(
      battle.guardPieces
        .map((piece) => piece.pieceId)
        .filter((pieceId): pieceId is NonNullable<typeof pieceId> => {
          return pieceId !== undefined
        })
        .map((pieceId) => pieceId as string),
    ),
  }
}

function getZoneTargetState(
  zone: ProjectedMatchBoardZone,
  interaction: BoardInteractionContext,
): TargetVisualState {
  const targets = interaction.requestTargets

  if (targets === null || !targets.hasZoneTargets) {
    return 'none'
  }

  const zoneId = zone.zoneId as string

  if (!targets.zoneIds.has(zoneId)) {
    return 'none'
  }

  return interaction.selectedZoneIds.has(zoneId) ? 'selected' : 'available'
}

function getPieceTargetState(
  piece: ProjectedMatchBoardPiece,
  zone: ProjectedMatchBoardZone,
  interaction: BoardInteractionContext,
): TargetVisualState {
  const targets = interaction.requestTargets

  if (targets === null || !targets.hasPieceTargets) {
    return 'none'
  }

  const isEligible =
    targets.pieceRefIds.has(piece.refId) ||
    (piece.pieceId !== undefined &&
      targets.pieceIds.has(piece.pieceId as string))

  if (isEligible) {
    return interaction.selectedPieceRefIds.has(piece.refId)
      ? 'selected'
      : 'available'
  }

  if (
    piece.visibility === 'visible' &&
    (targets.zoneIds.size === 0 || targets.zoneIds.has(zone.zoneId as string))
  ) {
    return 'unavailable'
  }

  return 'none'
}

function getPieceBattleRole(
  piece: ProjectedMatchBoardPiece,
  battle: BattleVisualContext | null,
): 'attacker' | 'target' | 'booster' | 'guardian' | null {
  if (battle === null) {
    return null
  }

  const pieceId = piece.pieceId as string | undefined

  if (
    piece.refId === battle.attackerRefId ||
    (pieceId !== undefined && pieceId === battle.attackerPieceId)
  ) {
    return 'attacker'
  }

  if (pieceId !== undefined && pieceId === battle.targetPieceId) {
    return 'target'
  }

  if (
    piece.refId === battle.boosterRefId ||
    (pieceId !== undefined && pieceId === battle.boosterPieceId)
  ) {
    return 'booster'
  }

  if (
    battle.guardianRefIds.has(piece.refId) ||
    (pieceId !== undefined && battle.guardianPieceIds.has(pieceId))
  ) {
    return 'guardian'
  }

  return null
}

function resolveBattlePieceLabel(
  projection: MatchBoardProjection,
  pieceRef: {
    readonly refId: string
    readonly pieceId?: ProjectedMatchBoardPiece['pieceId']
  },
) {
  const piece = [
    ...(projection.currentSide?.zones ?? []),
    ...projection.opponentSides.flatMap((side) => side.zones),
  ]
    .flatMap((zone) => zone.pieces)
    .find((candidate) => {
      return (
        candidate.refId === pieceRef.refId ||
        (pieceRef.pieceId !== undefined &&
          candidate.pieceId === pieceRef.pieceId)
      )
    })

  if (piece === undefined) {
    return 'Unit'
  }

  return piece.visibility === 'visible'
    ? formatCardLabel(piece.cardDefinitionId ?? piece.pieceId ?? piece.refId)
    : 'Hidden unit'
}

function resolveLabel(
  playerId: PlayerId,
  resolvePlayerLabel: ((playerId: PlayerId) => string) | undefined,
) {
  return resolvePlayerLabel?.(playerId) ?? playerId
}

function formatPlaymatRequestPrompt(request: VisibleGameChoiceRequest) {
  if (request.visibilityToViewer === 'redacted') {
    return 'Opponent is resolving a private choice.'
  }

  switch (request.type) {
    case 'mulligan.select_cards':
      return 'Choose cards from hand to return, or keep your hand.'
    case 'choose.pieces':
    case 'choose.target':
      return 'Choose highlighted units on the playmat.'
    case 'choose.zone':
      return 'Choose one of the highlighted zones.'
    case 'choose.option':
      return 'Choose an available option.'
    case 'battle.guard_select':
      return 'Choose guardians or pass guard.'
    case 'confirm.boolean':
      return 'Confirm the current game choice.'
    case 'trigger.resolve':
      return 'Assign trigger effects to highlighted units.'
    default:
      return formatRequestType(request.type)
  }
}

function formatBattleStatus(status: string) {
  switch (status) {
    case 'attack_declared':
      return 'Attack declared'
    case 'boost_declared':
      return 'Boost linked'
    case 'guard_requested':
      return 'Waiting for guard'
    case 'guard_resolved':
      return 'Guard resolved'
    case 'drive_checked':
      return 'Drive check'
    case 'combat_resolved':
      return 'Combat resolved'
    case 'damage_checked':
      return 'Damage checked'
    default:
      return formatStateLabel(status)
  }
}

function formatRequestType(type: string) {
  return type.split('.').map(formatStateLabel).join(' ')
}

function formatStateLabel(value: string) {
  return value
    .split(/[_:.]/)
    .filter((part) => part.length > 0)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatCardLabel(value: string) {
  const lastSegment = value.split(':').at(-1) ?? value

  return lastSegment
    .split(/[-_.]/)
    .filter((part) => part.length > 0)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatNumber(value: number | undefined) {
  return value === undefined ? '-' : value.toLocaleString('en-US')
}

function formatShortNumber(value: number | undefined) {
  if (value === undefined) {
    return '-'
  }

  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`
  }

  return String(value)
}

function formatSigned(value: number) {
  return value > 0 ? `+${value}` : value.toString()
}
