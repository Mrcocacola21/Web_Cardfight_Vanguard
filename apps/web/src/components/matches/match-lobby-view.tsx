'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Check, Play, Send, Swords, X } from 'lucide-react'
import type { VisibleProfileRecord } from '@web-vg/db/repositories/profiles'

import { EmptyState, ErrorState } from '@/components/feedback'
import { DashboardPageLayout, PageHeader } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type {
  MatchLobbyDetailPageState,
  MatchLobbyIndexPageState,
  MatchLobbyInviteView,
  MatchLobbyParticipantView,
} from '@/features/matches/server/match-lobby-read'
import {
  chooseMatchLobbyDeckAction,
  respondToMatchLobbyInviteAction,
  sendMatchLobbyInviteAction,
  setMatchLobbyReadyAction,
  startMatchLobbyAction,
} from '@/features/matches/server/match-lobby-actions'
import {
  initialMatchOpponentSearchFormState,
  type MatchOpponentSearchFormState,
} from '@/features/matches/server/match-opponent-search-form-state'
import { initialMatchLobbyFormState } from '@/features/matches/server/match-lobby-form-state'
import { searchMatchOpponentProfilesAction } from '@/features/matches/server/match-entry-actions'

export function MatchLobbyIndexView({
  state,
}: {
  readonly state: Extract<MatchLobbyIndexPageState, { kind: 'ready' }>
}) {
  const [selectedOpponent, setSelectedOpponent] =
    useState<VisibleProfileRecord | null>(null)
  const [inviteState, inviteAction, isInviting] = useActionState(
    sendMatchLobbyInviteAction,
    initialMatchLobbyFormState,
  )
  const [searchState, searchAction, isSearching] = useActionState<
    MatchOpponentSearchFormState,
    FormData
  >(searchMatchOpponentProfilesAction, initialMatchOpponentSearchFormState)

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Matches</Badge>
              <Badge variant="secondary">Invite lobby</Badge>
            </>
          }
          title="Start a Vanguard Match"
          description="Invite another player, wait for acceptance, then both players choose decks and ready before the persisted match room opens."
          meta={
            <span className="text-sm text-muted-foreground">
              Signed in as {state.viewerDisplayName}
            </span>
          }
          actions={
            <Link
              href="/matches"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Match history
            </Link>
          }
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5" />
            Invite opponent
          </CardTitle>
          <CardDescription>
            Send an invite to a visible profile. Decks are selected only after
            the invite is accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form
            action={searchAction}
            className="grid gap-3 sm:grid-cols-[1fr_auto]"
          >
            <Input
              name="query"
              placeholder="Search visible profiles"
              defaultValue={searchState.query}
              aria-label="Search opponent profiles"
            />
            <Button type="submit" variant="outline" disabled={isSearching}>
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </form>

          {renderOpponentSearchState(searchState, selectedOpponent, (profile) =>
            setSelectedOpponent(profile),
          )}

          <form action={inviteAction} className="grid gap-3">
            <input
              type="hidden"
              name="inviteeProfileId"
              value={selectedOpponent?.id ?? ''}
            />
            {selectedOpponent ? (
              <div className="rounded-xl border border-border/70 bg-background-elevated/65 p-3">
                <div className="text-sm font-medium">
                  {selectedOpponent.displayName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedOpponent.bio ?? 'Visible profile selected.'}
                </div>
              </div>
            ) : null}
            {inviteState.status === 'error' ? (
              <ErrorState
                compact
                title="Invite could not be sent"
                description={inviteState.message ?? 'Try again.'}
              />
            ) : null}
            <Button type="submit" disabled={isInviting || !selectedOpponent}>
              <Send className="size-4" />
              {isInviting ? 'Sending...' : 'Send match invite'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="size-5" />
            Your lobbies
          </CardTitle>
          <CardDescription>
            Open incoming or outgoing match lobbies. Accepted lobbies are where
            both players choose decks and ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.invites.length === 0 ? (
            <EmptyState
              title="No match lobbies yet"
              description="Send an invite to create a lobby, or open an invite sent to you."
            />
          ) : (
            <div className="grid gap-3">
              {state.invites.map((invite) => (
                <InviteListItem key={invite.invite.id} invite={invite} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardPageLayout>
  )
}

export function MatchLobbyDetailView({
  state,
}: {
  readonly state: Extract<MatchLobbyDetailPageState, { kind: 'ready' }>
}) {
  const [respondState, respondAction, isResponding] = useActionState(
    respondToMatchLobbyInviteAction,
    initialMatchLobbyFormState,
  )
  const [deckState, deckAction, isChoosingDeck] = useActionState(
    chooseMatchLobbyDeckAction,
    initialMatchLobbyFormState,
  )
  const [readyState, readyAction, isReadyChanging] = useActionState(
    setMatchLobbyReadyAction,
    initialMatchLobbyFormState,
  )
  const [startState, startAction, isStarting] = useActionState(
    startMatchLobbyAction,
    initialMatchLobbyFormState,
  )
  const viewerParticipant = state.participants.find(
    (participant) => participant.isViewer,
  )
  const viewerReady = viewerParticipant?.ready ?? false

  return (
    <DashboardPageLayout
      containerSize="wide"
      className="min-h-screen"
      contentClassName="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Match lobby</Badge>
              <Badge
                variant={
                  state.invite.status === 'accepted' ? 'success' : 'secondary'
                }
              >
                {formatLobbyStatus(state.invite.status)}
              </Badge>
            </>
          }
          title="Vanguard Lobby"
          description="Both players must accept, choose saved Standard decks, and ready before the authoritative match room starts."
          meta={
            <span className="text-sm text-muted-foreground">
              Lobby {state.invite.id}
            </span>
          }
          actions={
            <Link
              href="/matches/lobby"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              All lobbies
            </Link>
          }
        />
      }
    >
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Players</CardTitle>
            <CardDescription>
              Deck names are shown for your own selection. The opponent slot
              only reveals whether a deck has been selected.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {state.participants.map((participant) => (
              <ParticipantCard
                key={participant.profileId}
                participant={participant}
              />
            ))}
          </CardContent>
        </Card>

        {state.invite.status === 'pending' && state.viewerRole === 'invitee' ? (
          <Card>
            <CardHeader>
              <CardTitle>Respond to invite</CardTitle>
              <CardDescription>
                Accept to open deck selection, or decline to close this lobby.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <form action={respondAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="inviteId" value={state.invite.id} />
                <Button
                  type="submit"
                  name="response"
                  value="accepted"
                  disabled={isResponding}
                >
                  <Check className="size-4" />
                  Accept
                </Button>
                <Button
                  type="submit"
                  name="response"
                  value="declined"
                  variant="outline"
                  disabled={isResponding}
                >
                  <X className="size-4" />
                  Decline
                </Button>
              </form>
              <ActionFeedback state={respondState} />
            </CardContent>
          </Card>
        ) : null}

        {state.invite.status === 'pending' &&
        state.viewerRole === 'requester' ? (
          <Card>
            <CardHeader>
              <CardTitle>Waiting for opponent</CardTitle>
              <CardDescription>
                Deck selection opens after the invited player accepts.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {state.invite.status === 'accepted' ? (
          <Card>
            <CardHeader>
              <CardTitle>Choose your deck</CardTitle>
              <CardDescription>
                Select one saved Standard deck. Changing decks clears your ready
                flag.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <form
                action={deckAction}
                className="grid gap-3 md:grid-cols-[1fr_auto]"
              >
                <input type="hidden" name="inviteId" value={state.invite.id} />
                <select
                  name="deckId"
                  aria-label="Choose lobby deck"
                  defaultValue={viewerParticipant?.deckId ?? ''}
                  className="h-11 rounded-xl border border-input bg-background-elevated/75 px-3 text-sm"
                  disabled={!state.canSelectDeck || isChoosingDeck}
                >
                  <option value="">Choose a Standard deck</option>
                  {state.availableDecks.map((deck) => (
                    <option key={deck.id} value={deck.id}>
                      {deck.title} | {deck.totalCards} cards
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  disabled={!state.canSelectDeck || isChoosingDeck}
                >
                  {isChoosingDeck ? 'Saving...' : 'Save deck'}
                </Button>
              </form>
              <ActionFeedback state={deckState} />
            </CardContent>
          </Card>
        ) : null}
      </div>

      <aside className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Ready check</CardTitle>
            <CardDescription>
              The match starts only when both deck slots and both ready flags
              are complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <form action={readyAction}>
              <input type="hidden" name="inviteId" value={state.invite.id} />
              <input
                type="hidden"
                name="ready"
                value={viewerReady ? 'false' : 'true'}
              />
              <Button
                type="submit"
                variant={viewerReady ? 'outline' : 'default'}
                disabled={!state.canReady || isReadyChanging}
                className="w-full"
              >
                {viewerReady ? 'Clear ready' : 'Ready'}
              </Button>
            </form>
            <ActionFeedback state={readyState} />

            <form action={startAction}>
              <input type="hidden" name="inviteId" value={state.invite.id} />
              <Button
                type="submit"
                disabled={!state.canStart || isStarting}
                className="w-full"
              >
                <Play className="size-4" />
                {isStarting ? 'Starting...' : 'Start match'}
              </Button>
            </form>
            <ActionFeedback state={startState} />

            {state.invite.startedRoomId ? (
              <Link
                href={`/matches/play/${encodeURIComponent(state.invite.startedRoomId)}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                Open started match
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </aside>
    </DashboardPageLayout>
  )
}

function InviteListItem({ invite }: { readonly invite: MatchLobbyInviteView }) {
  return (
    <Link
      href={invite.href}
      className="rounded-2xl border border-border/70 bg-background-elevated/65 p-4 transition hover:border-primary/40 hover:bg-background-elevated"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {invite.requesterName} vs {invite.inviteeName}
          </div>
          <div className="text-sm text-muted-foreground">
            {invite.viewerRole === 'requester'
              ? 'Outgoing invite'
              : 'Incoming invite'}
          </div>
        </div>
        <Badge
          variant={invite.invite.status === 'accepted' ? 'success' : 'outline'}
        >
          {formatLobbyStatus(invite.invite.status)}
        </Badge>
      </div>
    </Link>
  )
}

function ParticipantCard({
  participant,
}: {
  readonly participant: MatchLobbyParticipantView
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background-elevated/65 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">
            {participant.displayName}
            {participant.isViewer ? ' (you)' : ''}
          </div>
          <div className="text-sm text-muted-foreground">
            {participant.role === 'requester' ? 'Requester' : 'Invited player'}
          </div>
        </div>
        <Badge variant={participant.ready ? 'success' : 'outline'}>
          {participant.ready ? 'Ready' : 'Not ready'}
        </Badge>
      </div>
      <div className="mt-4 rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
        {participant.deckSelected
          ? (participant.deckTitle ?? 'Deck selected')
          : 'No deck selected'}
      </div>
    </div>
  )
}

function ActionFeedback({
  state,
}: {
  readonly state: typeof initialMatchLobbyFormState
}) {
  if (state.status === 'idle' || !state.message) {
    return null
  }

  return (
    <p
      className={
        state.status === 'success'
          ? 'rounded-xl border border-emerald-200/40 bg-emerald-400/10 p-3 text-sm text-emerald-700 dark:text-emerald-100'
          : 'rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive'
      }
    >
      {state.message}
    </p>
  )
}

function renderOpponentSearchState(
  state: MatchOpponentSearchFormState,
  selectedOpponent: VisibleProfileRecord | null,
  onSelect: (profile: VisibleProfileRecord) => void,
) {
  if (state.kind === 'error') {
    return (
      <ErrorState
        compact
        title="Opponent search unavailable"
        description={state.message}
      />
    )
  }

  if (state.kind === 'idle') {
    return (
      <EmptyState
        title="Search for a player"
        description="Use a display name query, then select the profile to invite."
      />
    )
  }

  if (state.results.length === 0) {
    return (
      <EmptyState
        title="No visible profiles found"
        description={`No profile matched "${state.query}".`}
      />
    )
  }

  return (
    <div className="grid gap-3">
      {state.results.map((profile) => {
        const selected = selectedOpponent?.id === profile.id

        return (
          <div
            key={profile.id}
            className="rounded-xl border border-border/70 bg-background-elevated/65 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{profile.displayName}</div>
                <div className="text-sm text-muted-foreground">
                  {profile.bio ?? 'No visible bio.'}
                </div>
              </div>
              <Button
                type="button"
                variant={selected ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSelect(profile)}
              >
                {selected ? 'Selected' : 'Select'}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatLobbyStatus(status: string) {
  return status
    .split(/[_:.]/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}
