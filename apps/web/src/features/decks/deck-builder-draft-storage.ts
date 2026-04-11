import type { DeckBuilderDraft } from './deck-builder-draft'

const draftStoragePrefix = 'web-vg.deck-builder-draft.'
const storedDraftVersion = 1

interface StoredDeckBuilderDraft {
  readonly version: number
  readonly draft: DeckBuilderDraft
}

export function loadDeckBuilderDraftBackup(
  deckId: string,
): DeckBuilderDraft | null {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = window.sessionStorage.getItem(
    getDeckBuilderDraftStorageKey(deckId),
  )

  if (!rawValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(rawValue) as StoredDeckBuilderDraft

    if (
      parsedValue.version !== storedDraftVersion ||
      !isDeckBuilderDraft(parsedValue.draft) ||
      parsedValue.draft.deckId !== deckId
    ) {
      return null
    }

    return parsedValue.draft
  } catch {
    return null
  }
}

export function saveDeckBuilderDraftBackup(draft: DeckBuilderDraft): void {
  if (typeof window === 'undefined') {
    return
  }

  const storedDraft: StoredDeckBuilderDraft = {
    version: storedDraftVersion,
    draft,
  }

  window.sessionStorage.setItem(
    getDeckBuilderDraftStorageKey(draft.deckId),
    JSON.stringify(storedDraft),
  )
}

export function clearDeckBuilderDraftBackup(deckId: string): void {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(getDeckBuilderDraftStorageKey(deckId))
}

function getDeckBuilderDraftStorageKey(deckId: string): string {
  return `${draftStoragePrefix}${deckId}`
}

function isDeckBuilderDraft(value: unknown): value is DeckBuilderDraft {
  if (!value || typeof value !== 'object') {
    return false
  }

  const draft = value as Partial<DeckBuilderDraft>

  return (
    typeof draft.deckId === 'string' &&
    typeof draft.ownerProfileId === 'string' &&
    typeof draft.formatId === 'string' &&
    typeof draft.title === 'string' &&
    (typeof draft.description === 'string' || draft.description === null) &&
    Array.isArray(draft.tags) &&
    draft.tags.every((tag) => typeof tag === 'string') &&
    typeof draft.isFavorite === 'boolean' &&
    (typeof draft.currentVersionId === 'string' ||
      draft.currentVersionId === null) &&
    typeof draft.updatedAt === 'string' &&
    Array.isArray(draft.cards) &&
    draft.cards.every(isDeckBuilderDraftCard)
  )
}

function isDeckBuilderDraftCard(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false
  }

  const card = value as Record<string, unknown>

  return (
    typeof card.cardEntityId === 'string' &&
    typeof card.canonicalKey === 'string' &&
    typeof card.name === 'string' &&
    typeof card.grade === 'number' &&
    typeof card.cardType === 'string' &&
    (typeof card.triggerType === 'string' || card.triggerType === null) &&
    typeof card.quantity === 'number' &&
    (card.sectionKey === 'main' ||
      card.sectionKey === 'ride' ||
      card.sectionKey === 'g')
  )
}
