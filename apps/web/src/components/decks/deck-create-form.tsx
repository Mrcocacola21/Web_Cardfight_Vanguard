'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { ErrorState } from '@/components/feedback'
import { buttonVariants, Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  defaultDeckFormatId,
  supportedDeckFormats,
} from '@/features/decks/deck-format-options'
import { createDeckAction } from '@/features/decks/server/deck-actions'
import {
  initialDeckCreateFormState,
  type DeckCreateFormState,
} from '@/features/decks/server/deck-create-form-state'

export function DeckCreateForm() {
  const [state, formAction, isPending] = useActionState<
    DeckCreateFormState,
    FormData
  >(createDeckAction, initialDeckCreateFormState)
  const formatErrorId = state.fieldErrors.formatId
    ? 'deck-create-format-error'
    : undefined
  const formatHelpId = 'deck-create-format-help'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a new deck</CardTitle>
        <CardDescription>
          Pick the format first, then the server action creates an empty,
          profile-owned deck and sends you directly into the deck workspace.
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="formatId" className="text-sm font-medium">
              Format
            </label>
            <select
              id="formatId"
              name="formatId"
              required
              defaultValue={defaultDeckFormatId}
              aria-invalid={state.fieldErrors.formatId ? 'true' : 'false'}
              aria-describedby={
                formatErrorId
                  ? `${formatHelpId} ${formatErrorId}`
                  : formatHelpId
              }
              className={cn(
                'flex h-11 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
                state.fieldErrors.formatId
                  ? 'border-destructive ring-3 ring-destructive/20'
                  : null,
              )}
            >
              {supportedDeckFormats.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.label}
                </option>
              ))}
            </select>
            <p id={formatHelpId} className="text-xs text-muted-foreground">
              Supported right now: Standard, V Premium, and Premium. This step
              only creates the empty deck shell.
            </p>
            {state.fieldErrors.formatId ? (
              <p id={formatErrorId} className="text-sm text-destructive">
                {state.fieldErrors.formatId}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {supportedDeckFormats.map((format) => (
              <div
                key={format.id}
                className="rounded-xl border border-border/70 bg-background-elevated/72 p-3"
              >
                <p className="text-sm font-medium">{format.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {format.description}
                </p>
              </div>
            ))}
          </div>

          {state.message ? (
            <ErrorState
              compact
              title="Deck could not be created"
              description={state.message}
            />
          ) : null}
        </CardContent>
        <CardFooter className="flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            The initial deck is created with an empty card list and default
            metadata so the builder can take over immediately.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/decks"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Cancel
            </Link>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create deck'}
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
