import type { CreateDeckRecordInput } from '@/features/decks/application/deck-write-repository'
import {
  STANDARD_SLICE_QA_DECKS,
  type StandardSliceQaDeck,
} from '@/features/decks/standard-slice-qa-decks'

type StandardSliceQaBootstrapResult =
  | {
      readonly ok: true
      readonly data: {
        readonly ownerProfileId: string
        readonly createdDeckIds: readonly string[]
        readonly skippedDeckTitles: readonly string[]
      }
    }
  | {
      readonly ok: false
      readonly error: {
        readonly code:
          | 'profile-unavailable'
          | 'repository-failed'
          | 'catalog-bootstrap-failed'
        readonly message: string
      }
    }

type RepositoryResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly message: string
      }
    }

export interface StandardSliceQaDeckSummary {
  readonly title: string
}

export interface StandardSliceQaBootstrapDeckRepository {
  getOwnerProfileIdByAuthUserId(
    authUserId: string,
  ): Promise<RepositoryResult<string | null>>
  listDecksByOwnerProfileId(
    ownerProfileId: string,
  ): Promise<RepositoryResult<readonly StandardSliceQaDeckSummary[]>>
  createDeck(
    input: CreateDeckRecordInput,
  ): Promise<RepositoryResult<{ readonly id: string }>>
}

export interface StandardSliceQaCatalogBootstrapRepository {
  ensureStandardSliceQaCatalog(): Promise<RepositoryResult<void>>
}

export interface StandardSliceQaBootstrapServices {
  readonly deckRepository: StandardSliceQaBootstrapDeckRepository
  readonly catalogRepository: StandardSliceQaCatalogBootstrapRepository
}

export async function bootstrapStandardSliceQaDecksUseCase(
  services: StandardSliceQaBootstrapServices,
  command: {
    readonly authUserId: string
  },
): Promise<StandardSliceQaBootstrapResult> {
  const ownerProfileResult =
    await services.deckRepository.getOwnerProfileIdByAuthUserId(
      command.authUserId,
    )

  if (!ownerProfileResult.ok) {
    return repositoryFailure(
      'repository-failed',
      'Failed to resolve the current deck owner profile.',
      ownerProfileResult.error.message,
    )
  }

  if (!ownerProfileResult.data) {
    return {
      ok: false,
      error: {
        code: 'profile-unavailable',
        message:
          'Create your profile before creating the Standard slice QA decks.',
      },
    }
  }

  const catalogResult =
    await services.catalogRepository.ensureStandardSliceQaCatalog()

  if (!catalogResult.ok) {
    return repositoryFailure(
      'catalog-bootstrap-failed',
      'Failed to publish the Standard slice QA catalog cards.',
      catalogResult.error.message,
    )
  }

  const existingDecksResult =
    await services.deckRepository.listDecksByOwnerProfileId(
      ownerProfileResult.data,
    )

  if (!existingDecksResult.ok) {
    return repositoryFailure(
      'repository-failed',
      'Failed to inspect existing decks before QA bootstrap.',
      existingDecksResult.error.message,
    )
  }

  const existingTitles = new Set(
    existingDecksResult.data.map((deck) => deck.title.trim().toLowerCase()),
  )
  const createdDeckIds: string[] = []
  const skippedDeckTitles: string[] = []

  for (const qaDeck of STANDARD_SLICE_QA_DECKS) {
    if (existingTitles.has(qaDeck.title.trim().toLowerCase())) {
      skippedDeckTitles.push(qaDeck.title)
      continue
    }

    const createResult = await services.deckRepository.createDeck(
      mapQaDeckToCreateDeckInput(ownerProfileResult.data, qaDeck),
    )

    if (!createResult.ok) {
      return repositoryFailure(
        'repository-failed',
        `Failed to create ${qaDeck.title}.`,
        createResult.error.message,
      )
    }

    createdDeckIds.push(createResult.data.id)
    existingTitles.add(qaDeck.title.trim().toLowerCase())
  }

  return {
    ok: true,
    data: {
      ownerProfileId: ownerProfileResult.data,
      createdDeckIds,
      skippedDeckTitles,
    },
  }
}

function mapQaDeckToCreateDeckInput(
  ownerProfileId: string,
  qaDeck: StandardSliceQaDeck,
): CreateDeckRecordInput {
  return {
    ownerProfileId,
    formatId: 'standard',
    name: qaDeck.title,
    description: `${qaDeck.identity} Source DeckLog ${qaDeck.deckLogCode}. Bounded Pre-Phase 21 QA fixture.`,
    tags: ['qa', 'pre-phase-21', 'standard-slice', qaDeck.key],
    isFavorite: false,
    visibility: 'private',
    cards: qaDeck.entries.map((entry) => ({
      section: entry.section,
      cardEntityId: entry.cardEntityId,
      quantity: entry.quantity,
    })),
  }
}

function repositoryFailure(
  code: 'repository-failed' | 'catalog-bootstrap-failed',
  message: string,
  details: string,
): Extract<StandardSliceQaBootstrapResult, { readonly ok: false }> {
  return {
    ok: false,
    error: {
      code,
      message: `${message} ${details}`,
    },
  }
}
