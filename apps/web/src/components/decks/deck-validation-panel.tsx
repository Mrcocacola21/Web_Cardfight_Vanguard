'use client'

import { useMemo, useState } from 'react'
import type {
  DeckValidationIssue,
  DeckValidationResult,
} from '@web-vg/deck-validation'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const defaultVisibleCardIssueCount = 4

interface DeckValidationPanelProps {
  readonly validation: DeckValidationResult | null
  readonly cardNamesById?: Readonly<Record<string, string>>
  readonly resolveIssueHref?: (issue: DeckValidationIssue) => string | null
  readonly className?: string
}

export function DeckValidationPanel({
  validation,
  cardNamesById,
  resolveIssueHref,
  className,
}: DeckValidationPanelProps) {
  const [showAllCardIssues, setShowAllCardIssues] = useState(false)
  const groupedIssues = useMemo(() => {
    if (!validation) {
      return {
        deckIssues: [] as readonly DeckValidationIssue[],
        cardIssues: [] as readonly DeckValidationIssue[],
      }
    }

    return {
      deckIssues: validation.issues.filter(
        (issue) => issue.target.type !== 'card',
      ),
      cardIssues: validation.issues.filter(
        (issue) => issue.target.type === 'card',
      ),
    }
  }, [validation])

  const visibleCardIssues = showAllCardIssues
    ? groupedIssues.cardIssues
    : groupedIssues.cardIssues.slice(0, defaultVisibleCardIssueCount)
  const hiddenCardIssueCount =
    groupedIssues.cardIssues.length - visibleCardIssues.length

  return (
    <Card
      className={cn('border-border/70 bg-background-elevated/60', className)}
    >
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle id="deck-validation-heading">Validation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Derived from the current draft state. This panel reads validation
              output; it does not own deck state or apply fixes.
            </p>
          </div>
          {validation ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={validation.isValid ? 'success' : 'destructive'}
                data-slot="validation-status"
              >
                {validation.isValid ? 'Valid' : 'Needs fixes'}
              </Badge>
              {validation.summary.errorCount > 0 ? (
                <Badge variant="destructive">
                  {validation.summary.errorCount} error
                  {validation.summary.errorCount === 1 ? '' : 's'}
                </Badge>
              ) : null}
              {validation.summary.warningCount > 0 ? (
                <Badge variant="warning">
                  {validation.summary.warningCount} warning
                  {validation.summary.warningCount === 1 ? '' : 's'}
                </Badge>
              ) : null}
              {validation.summary.infoCount > 0 ? (
                <Badge variant="outline">
                  {validation.summary.infoCount} info
                  {validation.summary.infoCount === 1 ? '' : 's'}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!validation ? (
          <p className="rounded-xl border border-dashed border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
            Validation is unavailable for this view right now.
          </p>
        ) : validation.issues.length === 0 ? (
          <p className="rounded-xl border border-success/25 bg-success/8 px-4 py-3 text-sm text-foreground">
            No validation issues are active for the current draft.
          </p>
        ) : (
          <>
            {groupedIssues.deckIssues.length > 0 ? (
              <ValidationIssueGroup
                title="Deck issues"
                issues={groupedIssues.deckIssues}
                cardNamesById={cardNamesById}
                resolveIssueHref={resolveIssueHref}
              />
            ) : null}

            {groupedIssues.cardIssues.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">
                    Card issues
                  </h3>
                  {hiddenCardIssueCount > 0 ? (
                    <button
                      type="button"
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'xs',
                      })}
                      onClick={() => setShowAllCardIssues(true)}
                    >
                      Show {hiddenCardIssueCount} more
                    </button>
                  ) : showAllCardIssues &&
                    groupedIssues.cardIssues.length >
                      defaultVisibleCardIssueCount ? (
                    <button
                      type="button"
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'xs',
                      })}
                      onClick={() => setShowAllCardIssues(false)}
                    >
                      Show fewer
                    </button>
                  ) : null}
                </div>
                <ValidationIssueList
                  issues={visibleCardIssues}
                  cardNamesById={cardNamesById}
                  resolveIssueHref={resolveIssueHref}
                />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ValidationIssueGroup(props: {
  readonly title: string
  readonly issues: readonly DeckValidationIssue[]
  readonly cardNamesById: Readonly<Record<string, string>> | undefined
  readonly resolveIssueHref:
    | ((issue: DeckValidationIssue) => string | null)
    | undefined
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">{props.title}</h3>
      <ValidationIssueList
        issues={props.issues}
        cardNamesById={props.cardNamesById}
        resolveIssueHref={props.resolveIssueHref}
      />
    </div>
  )
}

function ValidationIssueList(props: {
  readonly issues: readonly DeckValidationIssue[]
  readonly cardNamesById: Readonly<Record<string, string>> | undefined
  readonly resolveIssueHref:
    | ((issue: DeckValidationIssue) => string | null)
    | undefined
}) {
  return (
    <ul className="space-y-2">
      {props.issues.map((issue, index) => {
        const href = props.resolveIssueHref?.(issue) ?? null

        return (
          <li
            key={buildIssueKey(issue, index)}
            data-severity={issue.severity}
            className={cn(
              'rounded-xl border px-4 py-3',
              getIssueToneClasses(issue.severity),
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getIssueBadgeVariant(issue.severity)}>
                    {capitalize(issue.severity)}
                  </Badge>
                  <code className="rounded bg-background/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {issue.code}
                  </code>
                </div>
                <p className="text-sm text-foreground">{issue.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatIssueTarget(issue, props.cardNamesById)}
                </p>
              </div>
              {href ? (
                <a
                  href={href}
                  className={buttonVariants({
                    variant: 'outline',
                    size: 'xs',
                  })}
                >
                  Go to card
                </a>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function buildIssueKey(issue: DeckValidationIssue, index: number): string {
  return `${issue.severity}:${issue.code}:${formatIssueTarget(issue)}:${index}`
}

function getIssueBadgeVariant(
  severity: DeckValidationIssue['severity'],
): 'destructive' | 'warning' | 'outline' {
  if (severity === 'error') {
    return 'destructive'
  }

  if (severity === 'warning') {
    return 'warning'
  }

  return 'outline'
}

function getIssueToneClasses(
  severity: DeckValidationIssue['severity'],
): string {
  if (severity === 'error') {
    return 'border-destructive/30 bg-destructive/6'
  }

  if (severity === 'warning') {
    return 'border-accent/45 bg-accent/10'
  }

  return 'border-border/70 bg-background'
}

function formatIssueTarget(
  issue: DeckValidationIssue,
  cardNamesById?: Readonly<Record<string, string>>,
): string {
  if (issue.target.type === 'deck') {
    return 'Deck-level issue'
  }

  if (issue.target.type === 'format') {
    return 'Format-level issue'
  }

  if (issue.target.type === 'section') {
    return `${formatSectionLabel(issue.target.section)} section`
  }

  if (issue.target.type === 'restriction') {
    return issue.target.restrictionId
      ? `Restriction ${issue.target.restrictionId}`
      : 'Restriction-level issue'
  }

  const cardName = cardNamesById?.[issue.target.cardEntityId]

  if (issue.target.section) {
    return `${cardName ?? issue.target.cardEntityId} · ${formatSectionLabel(
      issue.target.section,
    )}`
  }

  return cardName ?? issue.target.cardEntityId
}

function formatSectionLabel(section: string): string {
  if (section === 'ride') {
    return 'Ride'
  }

  if (section === 'g') {
    return 'G'
  }

  return 'Main'
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}
