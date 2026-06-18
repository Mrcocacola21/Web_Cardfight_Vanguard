import { ScrollText } from 'lucide-react'

import type {
  LocalMatchEventLogCategory,
  ProjectedMatchEventLogEntry,
} from '@/features/matches/play/event-log'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface EventLogPanelProps {
  readonly entries: readonly ProjectedMatchEventLogEntry[]
}

export function EventLogPanel({ entries }: EventLogPanelProps) {
  const visibleEntries = entries.slice(-8)
  const hiddenCount = entries.length - visibleEntries.length

  return (
    <Card
      role="region"
      aria-label="Event log"
      className="border-white/10 bg-black/35 text-slate-50"
    >
      <CardHeader>
        <CardTitle>Recent Play</CardTitle>
        <CardDescription>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {visibleEntries.length} recent events
            </Badge>
            {hiddenCount > 0 ? (
              <Badge variant="secondary">{hiddenCount} earlier</Badge>
            ) : null}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/65 bg-background-elevated/45 p-3 text-sm text-muted-foreground">
            No table events yet.
          </div>
        ) : (
          <ol className="grid gap-2">
            {visibleEntries.map((entry) => (
              <li
                key={entry.recordId}
                className="grid gap-2 rounded-lg border border-border/60 bg-background-elevated/45 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <ScrollText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="break-words text-sm font-medium">
                        {entry.summary}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge
                          variant={getCategoryBadgeVariant(entry.category)}
                        >
                          {formatCategory(entry.category)}
                        </Badge>
                        <Badge variant="outline">{entry.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <div>#{entry.ordinal}</div>
                  </div>
                </div>

                {getPlayableDetails(entry.details).length === 0 ? null : (
                  <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    {getPlayableDetails(entry.details)
                      .slice(0, 3)
                      .map((detail) => (
                        <LogDetail
                          key={`${entry.recordId}:${detail.label}`}
                          label={detail.label}
                          value={detail.value}
                        />
                      ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function LogDetail({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="grid gap-0.5 rounded border border-border/45 bg-background/45 px-2 py-1">
      <span className="font-medium uppercase">{label}</span>
      <span className="break-words text-foreground">{value}</span>
    </div>
  )
}

function getPlayableDetails(details: ProjectedMatchEventLogEntry['details']) {
  const hiddenLabels = new Set([
    'Action',
    'Event ID',
    'Request',
    'Revision',
    'Sequence',
    'Source',
    'Transition',
  ])

  return details.filter((detail) => !hiddenLabels.has(detail.label))
}

function formatCategory(category: LocalMatchEventLogCategory) {
  return category
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function getCategoryBadgeVariant(category: LocalMatchEventLogCategory) {
  switch (category) {
    case 'match':
    case 'turn':
      return 'default'
    case 'mulligan':
    case 'choice':
      return 'warning'
    case 'card':
    case 'piece':
    case 'zone':
      return 'secondary'
    case 'battle':
      return 'accent'
    case 'effect':
    case 'trigger':
      return 'success'
    case 'resource':
    case 'other':
      return 'outline'
  }
}
