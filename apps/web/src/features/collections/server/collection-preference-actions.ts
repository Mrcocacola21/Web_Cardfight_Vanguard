'use server'

import { createProfilesRepository } from '@web-vg/db'
import { revalidatePath } from 'next/cache'

import { createCollectionPreferenceRepository } from '@/features/collections/infrastructure/collection-preference-repository'
import {
  collectionPreferenceKinds,
  type CollectionPreferenceKind,
} from '@/features/collections/application/collection-preference-repository'
import { setCollectionPrintingPreferenceUseCase } from '@/features/collections/application/collection-preference-use-cases'

import {
  type ReadyCollectionActionContext,
  requireReadyCollectionActionContext,
} from './collection-action-auth'

export async function setCollectionPrintingPreferenceAction(
  formData: FormData,
): Promise<void> {
  const printingId = readRequiredFormValue(formData, 'printingId')
  const preferenceKind = readPreferenceKindFormValue(formData, 'preferenceKind')
  const isPresent = readBooleanFormValue(formData, 'isPresent')
  const returnPath = readReturnPath(formData)
  const actionContext = await requireReadyCollectionActionContext()
  const result = await setCollectionPrintingPreferenceUseCase(
    buildCollectionPreferenceActionServices(actionContext.client),
    {
      authUserId: actionContext.authUserId,
      printingId,
      preferenceKind,
      isPresent,
    },
  )

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  revalidatePath(returnPath)
}

function buildCollectionPreferenceActionServices(
  client: ReadyCollectionActionContext['client'],
) {
  return {
    profilesRepository: createProfilesRepository(client),
    collectionsRepository: createCollectionPreferenceRepository(client),
  }
}

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key)

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`The required preference action input "${key}" is missing.`)
  }

  return value.trim()
}

function readPreferenceKindFormValue(
  formData: FormData,
  key: string,
): CollectionPreferenceKind {
  const value = readRequiredFormValue(formData, key)

  if (!collectionPreferenceKinds.includes(value as CollectionPreferenceKind)) {
    throw new Error(
      `The preference action input "${key}" must be one of ${collectionPreferenceKinds.join(', ')}.`,
    )
  }

  return value as CollectionPreferenceKind
}

function readBooleanFormValue(formData: FormData, key: string): boolean {
  const value = readRequiredFormValue(formData, key)

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  throw new Error(
    `The preference action input "${key}" must be the string "true" or "false".`,
  )
}

function readReturnPath(formData: FormData): string {
  const value = formData.get('returnPath')

  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/collection'
  }

  return value
}
