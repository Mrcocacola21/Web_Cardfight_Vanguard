import {
  CheckCircle2,
  CircleAlert,
  CircleSlash,
  Flag,
  ListChecks,
  Route,
  Swords,
} from 'lucide-react'

import type {
  LocalAvailableActionGroup,
  LocalAvailableActionIntent,
  LocalAvailableActionsProjection,
} from '@/features/matches/play/available-actions'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface AvailableActionsPanelProps {
  readonly projection: LocalAvailableActionsProjection
  readonly onSubmitAction: (action: LocalAvailableActionIntent) => void
}

export function AvailableActionsPanel({
  projection,
  onSubmitAction,
}: AvailableActionsPanelProps) {
  const groupedAvailableActions = groupAvailableActions(
    projection.availableActions,
  )

  return (
    <Card role="region" aria-label="Available actions">
      <CardHeader>
        <CardTitle>Available Actions</CardTitle>
        <CardDescription>
          <div className="flex flex-wrap gap-2">
            <Badge variant={getModeBadgeVariant(projection.mode)}>
              {formatModeLabel(projection.mode)}
            </Badge>
            {projection.pendingRequest ? (
              <Badge variant="warning">{projection.pendingRequest.type}</Badge>
            ) : null}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {projection.availableActions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/65 bg-background-elevated/45 p-3 text-sm text-muted-foreground">
            No available actions.
          </div>
        ) : (
          <div className="grid gap-3">
            {groupedAvailableActions.map(([group, actions]) => (
              <ActionGroup
                key={group}
                group={group}
                actions={actions}
                onSubmitAction={onSubmitAction}
              />
            ))}
          </div>
        )}

        <ActionStatusList
          title="Blocked"
          variant="warning"
          actions={projection.blockedActions}
        />
        <ActionStatusList
          title="Unavailable Now"
          variant="destructive"
          actions={projection.unavailableActions}
        />
      </CardContent>
    </Card>
  )
}

function ActionGroup({
  group,
  actions,
  onSubmitAction,
}: {
  readonly group: LocalAvailableActionGroup
  readonly actions: readonly LocalAvailableActionIntent[]
  readonly onSubmitAction: (action: LocalAvailableActionIntent) => void
}) {
  return (
    <section
      aria-label={`${formatGroupLabel(group)} actions`}
      className="grid gap-2"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <ActionGroupIcon group={group} className="size-3.5" />
        <span>{formatGroupLabel(group)}</span>
      </div>
      <div className="grid gap-2">
        {actions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant={group === 'decision' ? 'default' : 'outline'}
            className="h-auto justify-start gap-2 py-2 text-left"
            onClick={() => onSubmitAction(action)}
          >
            <ActionGroupIcon group={group} className="size-4 shrink-0" />
            <span className="grid min-w-0 gap-0.5">
              <span className="truncate">{action.label}</span>
              <span className="whitespace-normal text-xs font-normal text-muted-foreground">
                {action.description}
              </span>
            </span>
          </Button>
        ))}
      </div>
    </section>
  )
}

function ActionStatusList({
  title,
  variant,
  actions,
}: {
  readonly title: string
  readonly variant: 'warning' | 'destructive'
  readonly actions: readonly LocalAvailableActionIntent[]
}) {
  if (actions.length === 0) {
    return null
  }

  return (
    <section aria-label={`${title} actions`} className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <ActionStatusIcon variant={variant} className="size-3.5" />
          <span>{title}</span>
        </div>
        <Badge variant={variant}>{actions.length}</Badge>
      </div>
      <div className="grid gap-1">
        {actions.slice(0, 6).map((action) => (
          <div
            key={action.id}
            className="grid gap-1 rounded-md border border-border/55 bg-background-elevated/45 p-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium">{action.label}</span>
              <Badge variant={variant}>
                {action.preview.code ?? action.status}
              </Badge>
            </div>
            {action.preview.message ? (
              <p className="text-xs text-muted-foreground">
                {action.preview.message}
              </p>
            ) : null}
            {action.preview.blockingRequestIds.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Blocking: {action.preview.blockingRequestIds.join(', ')}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function groupAvailableActions(
  actions: readonly LocalAvailableActionIntent[],
): ReadonlyArray<
  readonly [LocalAvailableActionGroup, readonly LocalAvailableActionIntent[]]
> {
  const groups: LocalAvailableActionGroup[] = [
    'decision',
    'setup',
    'turn_flow',
    'board',
    'match',
  ]

  return groups
    .map(
      (group) =>
        [group, actions.filter((action) => action.group === group)] as const,
    )
    .filter(([, groupActions]) => groupActions.length > 0)
}

function ActionGroupIcon({
  group,
  className,
}: {
  readonly group: LocalAvailableActionGroup
  readonly className: string
}) {
  switch (group) {
    case 'decision':
      return <ListChecks className={className} />
    case 'setup':
      return <CheckCircle2 className={className} />
    case 'turn_flow':
      return <Route className={className} />
    case 'board':
      return <Swords className={className} />
    case 'match':
      return <Flag className={className} />
  }
}

function ActionStatusIcon({
  variant,
  className,
}: {
  readonly variant: 'warning' | 'destructive'
  readonly className: string
}) {
  return variant === 'warning' ? (
    <CircleAlert className={className} />
  ) : (
    <CircleSlash className={className} />
  )
}

function formatGroupLabel(group: LocalAvailableActionGroup) {
  switch (group) {
    case 'decision':
      return 'Decision'
    case 'setup':
      return 'Setup'
    case 'turn_flow':
      return 'Turn Flow'
    case 'board':
      return 'Board'
    case 'match':
      return 'Match'
  }
}

function formatModeLabel(mode: LocalAvailableActionsProjection['mode']) {
  switch (mode) {
    case 'normal':
      return 'Normal'
    case 'pending_request':
      return 'Pending Request'
    case 'closed':
      return 'Closed'
  }
}

function getModeBadgeVariant(mode: LocalAvailableActionsProjection['mode']) {
  switch (mode) {
    case 'normal':
      return 'secondary'
    case 'pending_request':
      return 'warning'
    case 'closed':
      return 'destructive'
  }
}
