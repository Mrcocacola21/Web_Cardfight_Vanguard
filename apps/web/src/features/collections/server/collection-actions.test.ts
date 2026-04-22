// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as CollectionUseCasesModule from '@/features/collections/application/collection-use-cases'

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getCurrentAuthState: vi.fn(),
  createProfilesRepository: vi.fn(),
  createCollectionsRepository: vi.fn(),
  addCollectionPrintingUseCase:
    vi.fn<typeof CollectionUseCasesModule.addCollectionPrintingUseCase>(),
  decrementCollectionPrintingUseCase:
    vi.fn<typeof CollectionUseCasesModule.decrementCollectionPrintingUseCase>(),
  removeCollectionPrintingUseCase:
    vi.fn<typeof CollectionUseCasesModule.removeCollectionPrintingUseCase>(),
  setCollectionPrintingQuantityUseCase:
    vi.fn<
      typeof CollectionUseCasesModule.setCollectionPrintingQuantityUseCase
    >(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}))

vi.mock('@/features/auth/server/auth-session', () => ({
  getCurrentAuthState: mocks.getCurrentAuthState,
}))

vi.mock('@web-vg/db', () => ({
  createProfilesRepository: mocks.createProfilesRepository,
  createCollectionsRepository: mocks.createCollectionsRepository,
}))

vi.mock('@/features/collections/application/collection-use-cases', () => ({
  addCollectionPrintingUseCase: mocks.addCollectionPrintingUseCase,
  decrementCollectionPrintingUseCase: mocks.decrementCollectionPrintingUseCase,
  removeCollectionPrintingUseCase: mocks.removeCollectionPrintingUseCase,
  setCollectionPrintingQuantityUseCase:
    mocks.setCollectionPrintingQuantityUseCase,
}))

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}))

import {
  addCollectionPrintingAction,
  decrementCollectionPrintingAction,
  removeCollectionPrintingAction,
  setCollectionPrintingQuantityAction,
} from './collection-actions'

describe('collection actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createSupabaseServerClient.mockResolvedValue({})
    mocks.getCurrentAuthState.mockResolvedValue({
      kind: 'ready',
      user: {
        id: 'auth-user-1',
        email: 'collector@example.com',
      },
    })
    mocks.createProfilesRepository.mockReturnValue({
      getProfileByAuthUserId: vi.fn(),
    })
    mocks.createCollectionsRepository.mockReturnValue({
      changeCollectionPrintingQuantity: vi.fn(),
      getCollectionItemByOwnerAndPrinting: vi.fn(),
      removeCollectionPrinting: vi.fn(),
      setCollectionPrintingQuantity: vi.fn(),
    })
  })

  it('passes add-to-collection mutations through the application layer and revalidates the current path', async () => {
    mocks.addCollectionPrintingUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        printingId: 'printing-1',
        quantity: 2,
        removed: false,
      },
    })

    const formData = new FormData()
    formData.set('printingId', 'printing-1')
    formData.set('quantity', '2')
    formData.set('returnPath', '/catalog/printings/printing-1')

    await addCollectionPrintingAction(formData)

    expect(mocks.addCollectionPrintingUseCase).toHaveBeenCalledTimes(1)

    const firstCall = mocks.addCollectionPrintingUseCase.mock.calls[0]

    if (!firstCall) {
      throw new Error('Expected addCollectionPrintingUseCase to be called.')
    }

    const [, command] = firstCall

    expect(command).toEqual({
      authUserId: 'auth-user-1',
      printingId: 'printing-1',
      quantity: 2,
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      '/catalog/printings/printing-1',
    )
  })

  it('routes decrement actions through the decrement use case', async () => {
    mocks.decrementCollectionPrintingUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        printingId: 'printing-1',
        quantity: 1,
        removed: false,
      },
    })

    const formData = new FormData()
    formData.set('printingId', 'printing-1')
    formData.set('returnPath', '/catalog/printings/printing-1')

    await decrementCollectionPrintingAction(formData)

    expect(mocks.decrementCollectionPrintingUseCase).toHaveBeenCalledWith(
      expect.any(Object),
      {
        authUserId: 'auth-user-1',
        printingId: 'printing-1',
        quantity: 1,
      },
    )
  })

  it('routes exact quantity updates through the set-quantity use case', async () => {
    mocks.setCollectionPrintingQuantityUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        printingId: 'printing-1',
        quantity: 4,
        removed: false,
      },
    })

    const formData = new FormData()
    formData.set('printingId', 'printing-1')
    formData.set('quantity', '4')
    formData.set('returnPath', '/catalog/printings/printing-1')

    await setCollectionPrintingQuantityAction(formData)

    expect(mocks.setCollectionPrintingQuantityUseCase).toHaveBeenCalledWith(
      expect.any(Object),
      {
        authUserId: 'auth-user-1',
        printingId: 'printing-1',
        quantity: 4,
      },
    )
  })

  it('routes full removal through the remove use case', async () => {
    mocks.removeCollectionPrintingUseCase.mockResolvedValueOnce({
      ok: true,
      data: {
        printingId: 'printing-1',
        quantity: 0,
        removed: true,
      },
    })

    const formData = new FormData()
    formData.set('printingId', 'printing-1')
    formData.set('returnPath', '/catalog/printings/printing-1')

    await removeCollectionPrintingAction(formData)

    expect(mocks.removeCollectionPrintingUseCase).toHaveBeenCalledWith(
      expect.any(Object),
      {
        authUserId: 'auth-user-1',
        printingId: 'printing-1',
      },
    )
  })
})
