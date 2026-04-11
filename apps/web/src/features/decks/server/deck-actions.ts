'use server'

import {
  createDecksRepository,
  createProfilesRepository,
  type CreateDeckCardInput,
} from '@web-vg/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  defaultDeckName,
  isSupportedDeckFormatId,
} from '@/features/decks/deck-format-options'
import { getCurrentAuthState } from '@/features/auth/server/auth-session'
import type { DeckCreateFormState } from '@/features/decks/server/deck-create-form-state'

export async function createDeckAction(
  _previousState: DeckCreateFormState,
  formData: FormData,
): Promise<DeckCreateFormState> {
  const formatId = formData.get('formatId')

  if (typeof formatId !== 'string' || !isSupportedDeckFormatId(formatId)) {
    return {
      status: 'error',
      message: 'Select one of the supported formats before creating a deck.',
      fieldErrors: {
        formatId: 'Choose Standard, V Premium, or Premium.',
      },
    }
  }

  const ownerProfileState = await resolveCurrentDeckOwnerProfile()

  if (!ownerProfileState.ok) {
    return {
      status: 'error',
      message: ownerProfileState.message,
      fieldErrors: {},
    }
  }

  const { profile, client } = ownerProfileState
  const repository = createDecksRepository(client)
  const result = await repository.createDeck({
    ownerProfileId: profile.id,
    formatId,
    title: defaultDeckName,
    description: null,
    tags: [],
    isFavorite: false,
    cards: [],
  })

  if (!result.ok) {
    return {
      status: 'error',
      message: result.error.message,
      fieldErrors: {},
    }
  }

  revalidatePath('/decks')
  redirect(`/decks/${encodeURIComponent(result.data.id)}`)
}

export async function deleteDeckAction(formData: FormData): Promise<void> {
  const deckId = readRequiredFormValue(formData, 'deckId')
  const { profile, client } = await requireCurrentDeckOwnerProfile()
  const repository = createDecksRepository(client)

  const existingDeckResult = await repository.getDeckById(deckId)

  if (!existingDeckResult.ok) {
    throw new Error(existingDeckResult.error.message)
  }

  if (!existingDeckResult.data) {
    throw new Error('The requested deck could not be found.')
  }

  if (existingDeckResult.data.ownerProfileId !== profile.id) {
    throw new Error('The current profile cannot delete this deck.')
  }

  const deleteResult = await repository.deleteDeck(deckId)

  if (!deleteResult.ok) {
    throw new Error(deleteResult.error.message)
  }

  revalidatePath('/decks')
  revalidatePath(`/decks/${encodeURIComponent(deckId)}`)
}

export async function duplicateDeckAction(formData: FormData): Promise<void> {
  const deckId = readRequiredFormValue(formData, 'deckId')
  const { profile, client } = await requireCurrentDeckOwnerProfile()
  const repository = createDecksRepository(client)
  const existingDeckResult = await repository.getDeckById(deckId)

  if (!existingDeckResult.ok) {
    throw new Error(existingDeckResult.error.message)
  }

  if (!existingDeckResult.data) {
    throw new Error('The requested deck could not be found.')
  }

  if (existingDeckResult.data.ownerProfileId !== profile.id) {
    throw new Error('The current profile cannot duplicate this deck.')
  }

  const duplicateResult = await repository.createDeck({
    ownerProfileId: profile.id,
    formatId: existingDeckResult.data.formatId,
    title: buildDeckCopyTitle(existingDeckResult.data.title),
    description: existingDeckResult.data.description,
    tags: existingDeckResult.data.tags,
    isFavorite: existingDeckResult.data.isFavorite,
    visibility: existingDeckResult.data.visibility as
      | 'private'
      | 'unlisted'
      | 'public',
    cards: mapDeckCardsForCreate(existingDeckResult.data.currentVersion?.cards),
  })

  if (!duplicateResult.ok) {
    throw new Error(duplicateResult.error.message)
  }

  revalidatePath('/decks')
}

async function requireCurrentDeckOwnerProfile() {
  const result = await resolveCurrentDeckOwnerProfile()

  if (!result.ok) {
    throw new Error(result.message)
  }

  return result
}

async function resolveCurrentDeckOwnerProfile() {
  const client = await createSupabaseServerClient()
  const authState = await getCurrentAuthState({ client })

  if (authState.kind === 'error') {
    return {
      ok: false as const,
      message: authState.message,
    }
  }

  if (authState.kind !== 'ready') {
    return {
      ok: false as const,
      message: 'You need an authenticated session before deck actions can run.',
    }
  }

  const profilesRepository = createProfilesRepository(client)
  const profileResult = await profilesRepository.getProfileByAuthUserId(
    authState.user.id,
  )

  if (!profileResult.ok) {
    return {
      ok: false as const,
      message: profileResult.error.message,
    }
  }

  if (!profileResult.data) {
    return {
      ok: false as const,
      message:
        'A persisted profile row is required before deck actions can run.',
    }
  }

  return {
    ok: true as const,
    client,
    profile: profileResult.data,
  }
}

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key)

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`The required deck action input "${key}" is missing.`)
  }

  return value
}

function buildDeckCopyTitle(title: string): string {
  const trimmedTitle = title.trim()

  if (trimmedTitle.length === 0) {
    return `${defaultDeckName} (copy)`
  }

  return `${trimmedTitle} (copy)`
}

function mapDeckCardsForCreate(
  cards:
    | readonly {
        readonly sectionKey: string
        readonly cardEntityId: string
        readonly quantity: number
      }[]
    | null
    | undefined,
): readonly CreateDeckCardInput[] {
  if (!cards || cards.length === 0) {
    return []
  }

  return cards.map((card) => ({
    sectionKey: card.sectionKey,
    cardEntityId: card.cardEntityId,
    quantity: card.quantity,
  }))
}
