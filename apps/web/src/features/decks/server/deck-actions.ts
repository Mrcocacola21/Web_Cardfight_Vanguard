'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { DeckCreateFormState } from '@/features/decks/server/deck-create-form-state'
import {
  createDeckUseCase,
  deleteDeckUseCase,
  duplicateDeckUseCase,
} from '@/features/decks/application/deck-management-use-cases'
import { createDeckWriteRepository } from '@/features/decks/infrastructure/deck-write-repository'

import {
  requireReadyDeckActionContext,
  resolveReadyDeckActionContext,
} from './deck-action-auth'

export async function createDeckAction(
  _previousState: DeckCreateFormState,
  formData: FormData,
): Promise<DeckCreateFormState> {
  const formatId = formData.get('formatId')
  const deckActionContextResult = await resolveReadyDeckActionContext()

  if (!deckActionContextResult.ok) {
    return {
      status: 'error',
      message: deckActionContextResult.message,
      fieldErrors: {},
    }
  }

  const result = await createDeckUseCase(
    {
      repository: createDeckWriteRepository(
        deckActionContextResult.data.client,
      ),
    },
    {
      authUserId: deckActionContextResult.data.authUserId,
      formatId: typeof formatId === 'string' ? formatId : '',
    },
  )

  if (!result.ok) {
    return {
      status: 'error',
      message: result.error.message,
      fieldErrors:
        result.error.code === 'unsupported-format'
          ? {
              formatId: 'Choose Standard, V Premium, or Premium.',
            }
          : {},
    }
  }

  revalidatePath('/decks')
  redirect(`/decks/${encodeURIComponent(result.data.deckId)}`)
}

export async function deleteDeckAction(formData: FormData): Promise<void> {
  const deckId = readRequiredFormValue(formData, 'deckId')
  const deckActionContext = await requireReadyDeckActionContext()
  const result = await deleteDeckUseCase(
    {
      repository: createDeckWriteRepository(deckActionContext.client),
    },
    {
      authUserId: deckActionContext.authUserId,
      deckId,
    },
  )

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  revalidatePath('/decks')
  revalidatePath(`/decks/${encodeURIComponent(deckId)}`)
}

export async function duplicateDeckAction(formData: FormData): Promise<void> {
  const deckId = readRequiredFormValue(formData, 'deckId')
  const deckActionContext = await requireReadyDeckActionContext()
  const result = await duplicateDeckUseCase(
    {
      repository: createDeckWriteRepository(deckActionContext.client),
    },
    {
      authUserId: deckActionContext.authUserId,
      deckId,
    },
  )

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  revalidatePath('/decks')
}

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key)

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`The required deck action input "${key}" is missing.`)
  }

  return value
}
