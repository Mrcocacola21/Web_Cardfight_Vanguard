import {
  createCollectionApplicationError,
  mapCollectionRepositoryFailure,
  resolveCollectionOwnerProfileId,
  type CollectionApplicationResult,
  type CollectionApplicationServices,
} from './collection-application-support'

export interface AddCollectionPrintingCommand {
  readonly authUserId: string
  readonly printingId: string
  readonly quantity?: number
}

export interface DecrementCollectionPrintingCommand {
  readonly authUserId: string
  readonly printingId: string
  readonly quantity?: number
}

export interface SetCollectionPrintingQuantityCommand {
  readonly authUserId: string
  readonly printingId: string
  readonly quantity: number
}

export interface RemoveCollectionPrintingCommand {
  readonly authUserId: string
  readonly printingId: string
}

export interface CollectionMutationResultData {
  readonly printingId: string
  readonly quantity: number
  readonly removed: boolean
}

export type AddCollectionPrintingResult =
  CollectionApplicationResult<CollectionMutationResultData>
export type DecrementCollectionPrintingResult =
  CollectionApplicationResult<CollectionMutationResultData>
export type SetCollectionPrintingQuantityResult =
  CollectionApplicationResult<CollectionMutationResultData>
export type RemoveCollectionPrintingResult =
  CollectionApplicationResult<CollectionMutationResultData>

export async function addCollectionPrintingUseCase(
  services: CollectionApplicationServices,
  command: AddCollectionPrintingCommand,
): Promise<AddCollectionPrintingResult> {
  const quantity = normalizePositiveQuantity(command.quantity ?? 1)

  if (quantity === null) {
    return createCollectionApplicationError(
      'invalid-quantity',
      'Collection quantity must be a positive integer when adding a printing.',
    )
  }

  const ownerProfileResult = await resolveCollectionOwnerProfileId(
    services,
    command.authUserId,
  )

  if (!ownerProfileResult.ok) {
    return ownerProfileResult
  }

  const changeResult =
    await services.collectionsRepository.changeCollectionPrintingQuantity({
      ownerProfileId: ownerProfileResult.data,
      cardPrintingId: command.printingId,
      quantityDelta: quantity,
    })

  if (!changeResult.ok) {
    return mapCollectionRepositoryFailure(changeResult.error.message)
  }

  if (!changeResult.data) {
    return createCollectionApplicationError(
      'mutation-failed',
      'The collection item quantity could not be updated.',
    )
  }

  return {
    ok: true,
    data: {
      printingId: command.printingId,
      quantity: changeResult.data.quantity,
      removed: false,
    },
  }
}

export async function decrementCollectionPrintingUseCase(
  services: CollectionApplicationServices,
  command: DecrementCollectionPrintingCommand,
): Promise<DecrementCollectionPrintingResult> {
  const quantity = normalizePositiveQuantity(command.quantity ?? 1)

  if (quantity === null) {
    return createCollectionApplicationError(
      'invalid-quantity',
      'Collection quantity must be a positive integer when removing owned copies.',
    )
  }

  const ownerProfileResult = await resolveCollectionOwnerProfileId(
    services,
    command.authUserId,
  )

  if (!ownerProfileResult.ok) {
    return ownerProfileResult
  }

  const currentItemResult =
    await services.collectionsRepository.getCollectionItemByOwnerAndPrinting(
      ownerProfileResult.data,
      command.printingId,
    )

  if (!currentItemResult.ok) {
    return mapCollectionRepositoryFailure(currentItemResult.error.message)
  }

  if (!currentItemResult.data) {
    return createCollectionApplicationError(
      'collection-item-unavailable',
      'This printing is not currently present in your collection.',
    )
  }

  if (quantity > currentItemResult.data.quantity) {
    return createCollectionApplicationError(
      'invalid-quantity',
      'You cannot remove more copies than are currently owned for this printing.',
    )
  }

  const changeResult =
    await services.collectionsRepository.changeCollectionPrintingQuantity({
      ownerProfileId: ownerProfileResult.data,
      cardPrintingId: command.printingId,
      quantityDelta: -quantity,
    })

  if (!changeResult.ok) {
    return mapCollectionRepositoryFailure(changeResult.error.message)
  }

  return {
    ok: true,
    data: {
      printingId: command.printingId,
      quantity: changeResult.data?.quantity ?? 0,
      removed: changeResult.data === null,
    },
  }
}

export async function setCollectionPrintingQuantityUseCase(
  services: CollectionApplicationServices,
  command: SetCollectionPrintingQuantityCommand,
): Promise<SetCollectionPrintingQuantityResult> {
  const quantity = normalizeExactQuantity(command.quantity)

  if (quantity === null) {
    return createCollectionApplicationError(
      'invalid-quantity',
      'Collection quantity must be a non-negative integer.',
    )
  }

  const ownerProfileResult = await resolveCollectionOwnerProfileId(
    services,
    command.authUserId,
  )

  if (!ownerProfileResult.ok) {
    return ownerProfileResult
  }

  const setResult =
    await services.collectionsRepository.setCollectionPrintingQuantity({
      ownerProfileId: ownerProfileResult.data,
      cardPrintingId: command.printingId,
      quantity,
    })

  if (!setResult.ok) {
    return mapCollectionRepositoryFailure(setResult.error.message)
  }

  return {
    ok: true,
    data: {
      printingId: command.printingId,
      quantity: setResult.data?.quantity ?? 0,
      removed: setResult.data === null,
    },
  }
}

export async function removeCollectionPrintingUseCase(
  services: CollectionApplicationServices,
  command: RemoveCollectionPrintingCommand,
): Promise<RemoveCollectionPrintingResult> {
  const ownerProfileResult = await resolveCollectionOwnerProfileId(
    services,
    command.authUserId,
  )

  if (!ownerProfileResult.ok) {
    return ownerProfileResult
  }

  const removeResult =
    await services.collectionsRepository.removeCollectionPrinting({
      ownerProfileId: ownerProfileResult.data,
      cardPrintingId: command.printingId,
    })

  if (!removeResult.ok) {
    return mapCollectionRepositoryFailure(removeResult.error.message)
  }

  return {
    ok: true,
    data: {
      printingId: command.printingId,
      quantity: 0,
      removed: true,
    },
  }
}

function normalizePositiveQuantity(value: number): number | null {
  if (!Number.isInteger(value) || value <= 0) {
    return null
  }

  return value
}

function normalizeExactQuantity(value: number): number | null {
  if (!Number.isInteger(value) || value < 0) {
    return null
  }

  return value
}
