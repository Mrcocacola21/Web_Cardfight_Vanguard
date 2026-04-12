'use server'

import type { DeckDetailRecord } from '@web-vg/db/repositories/decks'
import { revalidatePath } from 'next/cache'

import type { DeckBuilderDraftSaveInput } from '@/features/decks/deck-builder-draft'
import {
  mutateDeckCompositionUseCase,
  saveDeckDraftUseCase,
  type DeckBuilderMutationInput as DeckBuilderMutationCommand,
  type DeckBuilderMutationKind as DeckBuilderMutationCommandKind,
} from '@/features/decks/application/deck-builder-use-cases'
import { createDeckWriteRepository } from '@/features/decks/infrastructure/deck-write-repository'

import { resolveReadyDeckActionContext } from './deck-action-auth'

export type DeckBuilderMutationKind = DeckBuilderMutationCommandKind

export interface DeckBuilderMutationInput {
  readonly deckId: string
  readonly cardEntityId: string
  readonly mutation: DeckBuilderMutationKind
  readonly sectionKey?: DeckBuilderMutationCommand['sectionKey']
}

export type DeckBuilderMutationResult =
  | {
      readonly ok: true
      readonly data: DeckDetailRecord
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
      }
    }

export type SaveDeckDraftResult = DeckBuilderMutationResult

export async function mutateDeckCompositionAction(
  input: Omit<DeckBuilderMutationInput, 'authUserId'>,
): Promise<DeckBuilderMutationResult> {
  const deckActionContextResult = await resolveReadyDeckActionContext()

  if (!deckActionContextResult.ok) {
    return {
      ok: false,
      error: {
        message: deckActionContextResult.message,
      },
    }
  }

  const command: DeckBuilderMutationCommand = {
    authUserId: deckActionContextResult.data.authUserId,
    deckId: input.deckId,
    cardEntityId: input.cardEntityId,
    mutation: input.mutation,
    ...(input.sectionKey ? { sectionKey: input.sectionKey } : {}),
  }

  const result = await mutateDeckCompositionUseCase(
    {
      repository: createDeckWriteRepository(
        deckActionContextResult.data.client,
      ),
    },
    command,
  )

  if (!result.ok) {
    return {
      ok: false,
      error: {
        message: result.error.message,
      },
    }
  }

  revalidatePath('/decks')
  revalidatePath(`/decks/${encodeURIComponent(input.deckId)}`)

  return result
}

export async function saveDeckDraftAction(
  input: DeckBuilderDraftSaveInput,
): Promise<SaveDeckDraftResult> {
  const deckActionContextResult = await resolveReadyDeckActionContext()

  if (!deckActionContextResult.ok) {
    return {
      ok: false,
      error: {
        message: deckActionContextResult.message,
      },
    }
  }

  const result = await saveDeckDraftUseCase(
    {
      repository: createDeckWriteRepository(
        deckActionContextResult.data.client,
      ),
    },
    {
      ...input,
      authUserId: deckActionContextResult.data.authUserId,
    },
  )

  if (!result.ok) {
    return {
      ok: false,
      error: {
        message: result.error.message,
      },
    }
  }

  revalidatePath('/decks')
  revalidatePath(`/decks/${encodeURIComponent(input.deckId)}`)

  return result
}
