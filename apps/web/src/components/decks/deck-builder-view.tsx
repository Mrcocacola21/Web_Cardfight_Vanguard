'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CatalogCardEntityRecord, DeckDetailRecord } from '@web-vg/db'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Minus, Plus, Search, Tag, Trash2, X } from 'lucide-react'

import { SearchBar } from '@/components/data-display'
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
import {
  applyDeckBuilderDraftMutation,
  createDeckBuilderDraft,
  createDeckBuilderDraftSaveInput,
  createDeckBuilderDraftSignature,
  getDeckBuilderDraftQuantity,
  updateDeckBuilderDraftMetadata,
  type DeckBuilderDraft,
  type DeckBuilderDraftMutationInput,
} from '@/features/decks/deck-builder-draft'
import {
  clearDeckBuilderDraftBackup,
  loadDeckBuilderDraftBackup,
  saveDeckBuilderDraftBackup,
} from '@/features/decks/deck-builder-draft-storage'
import { DECK_BUILDER_MAX_COPIES } from '@/features/decks/deck-builder-limits'
import { supportedDeckFormats } from '@/features/decks/deck-format-options'
import {
  buildDeckBuilderHref,
  type DeckBuilderQuery,
} from '@/features/decks/deck-builder-query'
import { saveDeckDraftAction } from '@/features/decks/server/deck-builder-actions'

const autosaveDelayMs = 800

type DeckBuilderSaveState = 'saved' | 'unsaved' | 'saving' | 'error'

interface DeckBuilderViewProps {
  readonly initialDeck: DeckDetailRecord
  readonly catalogCards: readonly CatalogCardEntityRecord[]
  readonly catalogErrorMessage: string | null
  readonly query: DeckBuilderQuery
}

export function DeckBuilderView({
  initialDeck,
  catalogCards,
  catalogErrorMessage,
  query,
}: DeckBuilderViewProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(() => createDeckBuilderDraft(initialDeck))
  const [lastSavedDraft, setLastSavedDraft] = useState(() =>
    createDeckBuilderDraft(initialDeck),
  )
  const [titleInput, setTitleInput] = useState(() => initialDeck.title)
  const [pendingTagInput, setPendingTagInput] = useState('')
  const [saveState, setSaveState] = useState<DeckBuilderSaveState>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [restoredFromBackup, setRestoredFromBackup] = useState(false)
  const restoreAttemptedRef = useRef(false)
  const saveInFlightRef = useRef(false)
  const draftRef = useRef(draft)
  const draftSignature = createDeckBuilderDraftSignature(draft)
  const lastSavedSignature = createDeckBuilderDraftSignature(lastSavedDraft)
  const isDirty = draftSignature !== lastSavedSignature
  const nameValidationMessage =
    titleInput.trim().length === 0
      ? 'Deck name is required before autosave can continue.'
      : null
  const totalCards = draft.cards.reduce(
    (total, card) => total + card.quantity,
    0,
  )
  const currentFormatOption =
    supportedDeckFormats.find((format) => format.id === draft.formatId) ??
    supportedDeckFormats[0]
  const catalogCardsWithCounts = useMemo(
    () =>
      catalogCards.map((card) => ({
        ...card,
        quantityInDeck: getDeckBuilderDraftQuantity(draft, card.id),
      })),
    [catalogCards, draft],
  )

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    setTitleInput(draft.title)
  }, [draft.title])

  useEffect(() => {
    if (restoreAttemptedRef.current) {
      return
    }

    restoreAttemptedRef.current = true

    const backupDraft = loadDeckBuilderDraftBackup(initialDeck.id)

    if (!backupDraft) {
      return
    }

    if (createDeckBuilderDraftSignature(backupDraft) === lastSavedSignature) {
      clearDeckBuilderDraftBackup(initialDeck.id)
      return
    }

    setDraft(backupDraft)
    setSaveState('unsaved')
    setSaveError(null)
    setRestoredFromBackup(true)
  }, [initialDeck.id, lastSavedSignature])

  useEffect(() => {
    if (isDirty) {
      saveDeckBuilderDraftBackup(draft)
      return
    }

    clearDeckBuilderDraftBackup(draft.deckId)
  }, [draft, isDirty])

  const persistDraft = useCallback(
    async (draftToSave: DeckBuilderDraft) => {
      const requestSignature = createDeckBuilderDraftSignature(draftToSave)

      saveInFlightRef.current = true
      setSaveState('saving')
      setSaveError(null)

      try {
        const result = await saveDeckDraftAction(
          createDeckBuilderDraftSaveInput(draftToSave),
        )

        if (!result.ok) {
          setSaveState('error')
          setSaveError(result.error.message)
          return
        }

        const persistedDraft = createDeckBuilderDraft(result.data)
        const latestDraftSignature = createDeckBuilderDraftSignature(
          draftRef.current,
        )

        setLastSavedDraft(persistedDraft)

        if (latestDraftSignature === requestSignature) {
          setDraft(persistedDraft)
          setSaveState('saved')
          setSaveError(null)
          setRestoredFromBackup(false)
          clearDeckBuilderDraftBackup(persistedDraft.deckId)

          if (persistedDraft.formatId !== initialDeck.format.id) {
            router.refresh()
          }

          return
        }

        setSaveState('unsaved')
        setSaveError(null)
        saveDeckBuilderDraftBackup(draftRef.current)
      } catch {
        setSaveState('error')
        setSaveError('Could not save changes.')
      } finally {
        saveInFlightRef.current = false
      }
    },
    [initialDeck.format.id, router],
  )

  useEffect(() => {
    if (
      !isDirty ||
      saveInFlightRef.current ||
      saveState === 'error' ||
      nameValidationMessage
    ) {
      return
    }

    const timerId = window.setTimeout(() => {
      void persistDraft(draftRef.current)
    }, autosaveDelayMs)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [draftSignature, isDirty, nameValidationMessage, persistDraft, saveState])

  useEffect(() => {
    if (!isDirty && saveState !== 'saving' && saveState !== 'saved') {
      setSaveState('saved')
      setSaveError(null)
    }
  }, [isDirty, saveState])

  useEffect(() => {
    if (!isDirty && saveState !== 'saving') {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty, saveState])

  function applyLocalMutation(input: DeckBuilderDraftMutationInput) {
    try {
      setDraft((currentDraft) =>
        applyDeckBuilderDraftMutation(currentDraft, input),
      )
      setSaveState('unsaved')
      setSaveError(null)
    } catch (error) {
      setSaveState('error')
      setSaveError(resolveLocalDraftErrorMessage(error))
    }
  }

  function applyMetadataChange(
    updater: Parameters<typeof updateDeckBuilderDraftMetadata>[1],
  ) {
    try {
      setDraft((currentDraft) =>
        updateDeckBuilderDraftMetadata(currentDraft, updater),
      )
      setSaveState('unsaved')
      setSaveError(null)
    } catch (error) {
      setSaveState('error')
      setSaveError(resolveLocalDraftErrorMessage(error))
    }
  }

  function handleTitleChange(value: string) {
    setTitleInput(value)

    if (value.trim().length === 0) {
      return
    }

    applyMetadataChange({
      title: value,
    })
  }

  function handleAddTag() {
    if (pendingTagInput.trim().length === 0) {
      return
    }

    applyMetadataChange({
      tags: [...draft.tags, pendingTagInput],
    })
    setPendingTagInput('')
  }

  function handleRemoveTag(tag: string) {
    applyMetadataChange({
      tags: draft.tags.filter((entry) => entry !== tag),
    })
  }

  function retrySave() {
    if (!isDirty || saveInFlightRef.current) {
      return
    }

    setSaveState('unsaved')
    setSaveError(null)
    void persistDraft(draftRef.current)
  }

  const saveStateDescriptor = getSaveStateDescriptor({
    saveState: nameValidationMessage ? 'error' : saveState,
    restoredFromBackup,
    saveError: nameValidationMessage ?? saveError,
  })

  return (
    <DashboardPageLayout
      containerSize="wide"
      header={
        <PageHeader
          eyebrow={
            <>
              <Badge variant="outline">Deck Builder</Badge>
              <Badge variant="secondary">{currentFormatOption.label}</Badge>
              <Badge variant="outline">{totalCards} cards</Badge>
              {draft.isFavorite ? (
                <Badge variant="warning">Favorite</Badge>
              ) : null}
              <Badge variant={saveStateDescriptor.variant}>
                {saveStateDescriptor.label}
              </Badge>
            </>
          }
          title={draft.title}
          description="Deck edits stay canonical-card based, local draft changes stay responsive, and autosave turns the latest draft into persisted deck truth without forcing a reload on every click."
          meta={
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{saveStateDescriptor.description}</span>
              {saveState === 'error' && !nameValidationMessage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={retrySave}
                >
                  Retry save
                </Button>
              ) : null}
            </div>
          }
          actions={
            <Link
              href="/decks"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ArrowLeft className="size-4" />
              Back to decks
            </Link>
          }
        />
      }
      contentClassName="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
    >
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Deck metadata</CardTitle>
          <CardDescription>
            Metadata stays inside the same draft and autosave pipeline as deck
            cards. Format changes remain lightweight for now and full
            format-aware validation still lands in the next phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(14rem,0.8fr)]">
            <div className="space-y-2">
              <label htmlFor="deck-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="deck-name"
                value={titleInput}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="Untitled Deck"
                aria-invalid={nameValidationMessage ? 'true' : 'false'}
                aria-describedby={
                  nameValidationMessage ? 'deck-name-error' : undefined
                }
              />
              {nameValidationMessage ? (
                <p id="deck-name-error" className="text-xs text-destructive">
                  {nameValidationMessage}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Deck name is user-facing metadata and must stay non-empty.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="deck-format" className="text-sm font-medium">
                Format
              </label>
              <select
                id="deck-format"
                value={draft.formatId}
                onChange={(event) =>
                  applyMetadataChange({
                    formatId: event.target.value,
                  })
                }
                className="flex h-11 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {supportedDeckFormats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Changing format updates the deck field only. Rule validation
                follows later and does not run here yet.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(14rem,0.6fr)]">
            <div className="space-y-2">
              <label htmlFor="deck-description" className="text-sm font-medium">
                Description
              </label>
              <textarea
                id="deck-description"
                value={draft.description ?? ''}
                onChange={(event) =>
                  applyMetadataChange({
                    description: event.target.value,
                  })
                }
                rows={4}
                placeholder="Add a short note about the deck plan."
                className="flex min-h-28 w-full rounded-xl border border-input bg-background-elevated/75 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-background-elevated/55 p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">Favorite</p>
                <p className="text-xs text-muted-foreground">
                  Marks the deck for list-level emphasis. It does not affect
                  gameplay or validation.
                </p>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={draft.isFavorite}
                  onChange={(event) =>
                    applyMetadataChange({
                      isFavorite: event.target.checked,
                    })
                  }
                  className="size-4 rounded border border-input accent-primary"
                  aria-label="Mark deck as favorite"
                />
                Mark as favorite
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="deck-tag-input" className="text-sm font-medium">
                Tags
              </label>
              <p className="text-xs text-muted-foreground">
                Tags stay local to this deck and use a simple trimmed list with
                no global registry.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="deck-tag-input"
                value={pendingTagInput}
                onChange={(event) => setPendingTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return
                  }

                  event.preventDefault()
                  handleAddTag()
                }}
                placeholder="Add a tag"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={pendingTagInput.trim().length === 0}
              >
                <Tag className="size-4" />
                Add tag
              </Button>
            </div>
            {draft.tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tags yet. Add a few organizer labels if the deck needs them.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {draft.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    <span>{tag}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveTag(tag)}
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="size-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>
            Search published card entities for this deck format and add them to
            the current composition. Builder copy counts stop at{' '}
            {DECK_BUILDER_MAX_COPIES} per canonical card until full validation
            lands.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            method="get"
            action={buildDeckBuilderHref(draft.deckId)}
            className="space-y-3"
          >
            <SearchBar
              label="Search cards"
              name="q"
              defaultValue={query.searchText ?? ''}
              placeholder="Search published cards"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="outline" size="sm">
                <Search className="size-4" />
                Search
              </Button>
              {query.searchText ? (
                <Link
                  href={buildDeckBuilderHref(draft.deckId)}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>

          {catalogErrorMessage ? (
            <ErrorState
              compact
              title="Catalog panel is unavailable"
              description={catalogErrorMessage}
            />
          ) : catalogCardsWithCounts.length === 0 ? (
            <EmptyState
              compact
              title="No cards found"
              description="No published catalog cards matched the current deck format and search text."
            />
          ) : (
            <div className="space-y-3">
              {catalogCardsWithCounts.map((card) => (
                <div
                  key={card.id}
                  className="rounded-xl border border-border/70 bg-background-elevated/72 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">Grade {card.grade}</Badge>
                        <Badge variant="outline">
                          {formatCardType(card.cardType)}
                        </Badge>
                        {card.triggerType ? (
                          <Badge variant="secondary">{card.triggerType}</Badge>
                        ) : null}
                        {card.quantityInDeck > 0 ? (
                          <Badge>{card.quantityInDeck} in deck</Badge>
                        ) : null}
                        {card.quantityInDeck >= DECK_BUILDER_MAX_COPIES ? (
                          <Badge variant="secondary">
                            Max {DECK_BUILDER_MAX_COPIES}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {card.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {card.canonicalKey}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        applyLocalMutation({
                          cardEntityId: card.id,
                          mutation: 'add',
                          card: {
                            canonicalKey: card.canonicalKey,
                            name: card.name,
                            grade: card.grade,
                            cardType: card.cardType,
                            triggerType: card.triggerType,
                          },
                        })
                      }
                      disabled={card.quantityInDeck >= DECK_BUILDER_MAX_COPIES}
                      aria-label={`Add ${card.name}`}
                    >
                      <Plus className="size-4" />
                      Add
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current deck</CardTitle>
          <CardDescription>
            Current canonical-card composition for this deck. Changes stay local
            first, autosave persists the full draft, and builder copy counts use
            a temporary cap of {DECK_BUILDER_MAX_COPIES} per card.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.cards.length === 0 ? (
            <EmptyState
              compact
              title="Deck is empty"
              description="Add cards from the catalog panel to start building the deck."
            />
          ) : (
            <div className="space-y-3">
              {draft.cards.map((card) => (
                <div
                  key={`${card.sectionKey}-${card.cardEntityId}`}
                  className="rounded-xl border border-border/70 bg-background-elevated/72 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">x{card.quantity}</Badge>
                        {card.quantity >= DECK_BUILDER_MAX_COPIES ? (
                          <Badge variant="secondary">
                            Max {DECK_BUILDER_MAX_COPIES}
                          </Badge>
                        ) : null}
                        <Badge variant="outline">
                          {formatDeckSectionLabel(card.sectionKey)}
                        </Badge>
                        <Badge variant="outline">Grade {card.grade}</Badge>
                        <Badge variant="outline">
                          {formatCardType(card.cardType)}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {card.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {card.canonicalKey}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() =>
                          applyLocalMutation({
                            cardEntityId: card.cardEntityId,
                            mutation: 'decrement',
                            sectionKey: card.sectionKey,
                          })
                        }
                        aria-label={`Decrease ${card.name}`}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={card.quantity >= DECK_BUILDER_MAX_COPIES}
                        onClick={() =>
                          applyLocalMutation({
                            cardEntityId: card.cardEntityId,
                            mutation: 'increment',
                            sectionKey: card.sectionKey,
                          })
                        }
                        aria-label={`Increase ${card.name}`}
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        onClick={() =>
                          applyLocalMutation({
                            cardEntityId: card.cardEntityId,
                            mutation: 'remove',
                            sectionKey: card.sectionKey,
                          })
                        }
                        aria-label={`Remove ${card.name}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardPageLayout>
  )
}

function getSaveStateDescriptor(input: {
  readonly saveState: DeckBuilderSaveState
  readonly restoredFromBackup: boolean
  readonly saveError: string | null
}) {
  if (input.saveState === 'saving') {
    return {
      label: 'Saving...',
      variant: 'secondary' as const,
      description: 'Autosave is persisting the latest draft to the server.',
    }
  }

  if (input.saveState === 'error') {
    return {
      label: 'Could not save changes',
      variant: 'destructive' as const,
      description:
        input.saveError ??
        'The latest draft is still local and can be retried without discarding changes.',
    }
  }

  if (input.saveState === 'unsaved') {
    return {
      label: 'Unsaved changes',
      variant: 'warning' as const,
      description: input.restoredFromBackup
        ? 'Recovered a temporary draft from this browser session. Autosave will persist it again.'
        : 'Recent deck edits are local for the moment. Autosave runs shortly.',
    }
  }

  return {
    label: 'Saved',
    variant: 'success' as const,
    description:
      'The latest draft is persisted on the server and survives refresh.',
  }
}

function resolveLocalDraftErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'The local draft could not be updated.'
}

function formatCardType(value: string): string {
  return value.replaceAll('-', ' ')
}

function formatDeckSectionLabel(sectionKey: 'main' | 'ride' | 'g'): string {
  if (sectionKey === 'ride') {
    return 'Ride'
  }

  if (sectionKey === 'g') {
    return 'G'
  }

  return 'Main'
}
