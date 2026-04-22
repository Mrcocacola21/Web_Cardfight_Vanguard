'use server'

import {
  createCollectionsRepository,
  createProfilesRepository,
} from '@web-vg/db'
import { revalidatePath } from 'next/cache'

import {
  addCollectionPrintingUseCase,
  decrementCollectionPrintingUseCase,
  removeCollectionPrintingUseCase,
  setCollectionPrintingQuantityUseCase,
} from '@/features/collections/application/collection-use-cases'

import {
  type ReadyCollectionActionContext,
  requireReadyCollectionActionContext,
} from './collection-action-auth'

export async function addCollectionPrintingAction(
  formData: FormData,
): Promise<void> {
  const printingId = readRequiredFormValue(formData, 'printingId')
  const quantity = readIntegerFormValue(formData, 'quantity', 1)
  const returnPath = readReturnPath(formData)
  const actionContext = await requireReadyCollectionActionContext()
  const result = await addCollectionPrintingUseCase(
    buildCollectionActionServices(actionContext.client),
    {
      authUserId: actionContext.authUserId,
      printingId,
      quantity,
    },
  )

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  revalidatePath(returnPath)
}

export async function decrementCollectionPrintingAction(
  formData: FormData,
): Promise<void> {
  const printingId = readRequiredFormValue(formData, 'printingId')
  const quantity = readIntegerFormValue(formData, 'quantity', 1)
  const returnPath = readReturnPath(formData)
  const actionContext = await requireReadyCollectionActionContext()
  const result = await decrementCollectionPrintingUseCase(
    buildCollectionActionServices(actionContext.client),
    {
      authUserId: actionContext.authUserId,
      printingId,
      quantity,
    },
  )

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  revalidatePath(returnPath)
}

export async function removeCollectionPrintingAction(
  formData: FormData,
): Promise<void> {
  const printingId = readRequiredFormValue(formData, 'printingId')
  const returnPath = readReturnPath(formData)
  const actionContext = await requireReadyCollectionActionContext()
  const result = await removeCollectionPrintingUseCase(
    buildCollectionActionServices(actionContext.client),
    {
      authUserId: actionContext.authUserId,
      printingId,
    },
  )

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  revalidatePath(returnPath)
}

export async function setCollectionPrintingQuantityAction(
  formData: FormData,
): Promise<void> {
  const printingId = readRequiredFormValue(formData, 'printingId')
  const quantity = readIntegerFormValue(formData, 'quantity')
  const returnPath = readReturnPath(formData)
  const actionContext = await requireReadyCollectionActionContext()
  const result = await setCollectionPrintingQuantityUseCase(
    buildCollectionActionServices(actionContext.client),
    {
      authUserId: actionContext.authUserId,
      printingId,
      quantity,
    },
  )

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  revalidatePath(returnPath)
}

function buildCollectionActionServices(
  client: ReadyCollectionActionContext['client'],
) {
  return {
    profilesRepository: createProfilesRepository(client),
    collectionsRepository: createCollectionsRepository(client),
  }
}

function readRequiredFormValue(formData: FormData, key: string): string {
  const value = formData.get(key)

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`The required collection action input "${key}" is missing.`)
  }

  return value.trim()
}

function readIntegerFormValue(
  formData: FormData,
  key: string,
  fallback?: number,
): number {
  const value = formData.get(key)

  if (typeof value !== 'string' || value.trim().length === 0) {
    if (fallback !== undefined) {
      return fallback
    }

    throw new Error(`The required collection action input "${key}" is missing.`)
  }

  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue)) {
    throw new Error(`The collection action input "${key}" must be an integer.`)
  }

  return parsedValue
}

function readReturnPath(formData: FormData): string {
  const value = formData.get('returnPath')

  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/catalog'
  }

  return value
}
