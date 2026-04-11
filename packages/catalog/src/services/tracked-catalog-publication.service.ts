import type {
  CatalogPublicationError,
  CatalogPublicationResult,
  CatalogPublicationService,
  CatalogPublicationSummary,
} from '../publication'

type TrackedImportJobStatus =
  | 'pending'
  | 'running'
  | 'blocked_for_review'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled'

type TrackedImportJobStage =
  | 'source'
  | 'raw_import'
  | 'normalization'
  | 'publication'
  | 'published'

type PublicationLifecycleStoreResult<TData> =
  | {
      readonly ok: true
      readonly data: TData
    }
  | {
      readonly ok: false
      readonly error: {
        readonly code: string
        readonly message: string
        readonly details?: string
      }
    }

export interface TrackedImportJobRecord {
  readonly id: string
  readonly jobStatus: TrackedImportJobStatus
  readonly currentStage: TrackedImportJobStage
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly publishedRecordCount: number
  readonly statusReason: string | null
}

export interface CatalogPublicationLifecycleStore {
  getImportJobById(
    id: string,
  ): Promise<PublicationLifecycleStoreResult<TrackedImportJobRecord | null>>
  markImportJobRunning(input: {
    readonly id: string
    readonly currentStage: 'publication'
    readonly startedAt: string
  }): Promise<PublicationLifecycleStoreResult<TrackedImportJobRecord>>
  finalizeImportJob(input: {
    readonly id: string
    readonly jobStatus: 'completed' | 'partially_completed'
    readonly currentStage: 'published'
    readonly statusReason: string | null
    readonly publishedRecordCount: number
    readonly finishedAt: string
  }): Promise<PublicationLifecycleStoreResult<TrackedImportJobRecord>>
  markImportJobFailed(input: {
    readonly id: string
    readonly currentStage: 'publication'
    readonly startedAt: string
    readonly finishedAt: string
    readonly errorCode: string
    readonly statusReason: string
  }): Promise<PublicationLifecycleStoreResult<TrackedImportJobRecord>>
}

export interface CatalogPublicationLogEntry {
  readonly event:
    | 'publication_started'
    | 'publication_succeeded'
    | 'publication_failed'
  readonly importJobId: string
  readonly replayedExistingPublication: boolean
  readonly jobStatus?: TrackedImportJobStatus
  readonly currentStage?: TrackedImportJobStage
  readonly attemptedCount?: number
  readonly publishableCount?: number
  readonly publishedPrintingCount?: number
  readonly skippedCount?: number
  readonly errorCode?: string
  readonly message?: string
}

export interface CatalogPublicationLogger {
  info(entry: CatalogPublicationLogEntry): void
  error(entry: CatalogPublicationLogEntry): void
}

export interface TrackedCatalogPublicationSummary extends CatalogPublicationSummary {
  readonly finalJobStatus: 'completed' | 'partially_completed'
  readonly finalJobStage: 'published'
  readonly publishedRecordCount: number
  readonly finishedAt: string
  readonly replayedExistingPublication: boolean
}

export interface TrackedCatalogPublicationService {
  publishImportJob(
    importJobId: string,
  ): Promise<CatalogPublicationResult<TrackedCatalogPublicationSummary>>
}

export interface TrackedCatalogPublicationServiceOptions {
  readonly logger?: CatalogPublicationLogger
  readonly now?: () => string
}

const defaultLogger: CatalogPublicationLogger = {
  info(entry) {
    console.info('[catalog-publication]', entry)
  },
  error(entry) {
    console.error('[catalog-publication]', entry)
  },
}

export function createTrackedCatalogPublicationService(
  publicationService: CatalogPublicationService,
  lifecycleStore: CatalogPublicationLifecycleStore,
  options: TrackedCatalogPublicationServiceOptions = {},
): TrackedCatalogPublicationService {
  const logger = options.logger ?? defaultLogger
  const now = options.now ?? (() => new Date().toISOString())

  return {
    async publishImportJob(importJobId) {
      const importJobResult = await lifecycleStore.getImportJobById(importJobId)

      if (!importJobResult.ok) {
        return mapLifecycleStoreError(importJobResult.error)
      }

      const importJob = importJobResult.data

      if (!importJob) {
        return {
          ok: false,
          error: {
            code: 'publication-failed',
            message: 'Failed to load import job for publication.',
            details: `Import job ${importJobId} was not found.`,
          },
        }
      }

      const publicationMode = resolvePublicationMode(importJob)

      if (!publicationMode.ok) {
        return {
          ok: false,
          error: {
            code: 'publication-failed',
            message: publicationMode.message,
            details: publicationMode.details,
          },
        }
      }

      const replayedExistingPublication = publicationMode.replay
      let publicationStartedAt = importJob.startedAt ?? now()

      if (!replayedExistingPublication) {
        const runningResult = await lifecycleStore.markImportJobRunning({
          id: importJobId,
          currentStage: 'publication',
          startedAt: publicationStartedAt,
        })

        if (!runningResult.ok) {
          return mapLifecycleStoreError(runningResult.error)
        }

        publicationStartedAt =
          runningResult.data.startedAt ?? publicationStartedAt
      }

      logger.info({
        event: 'publication_started',
        importJobId,
        replayedExistingPublication,
        jobStatus: replayedExistingPublication
          ? importJob.jobStatus
          : 'running',
        currentStage: replayedExistingPublication
          ? importJob.currentStage
          : 'publication',
      })

      const publicationResult =
        await publicationService.publishImportJob(importJobId)

      if (!publicationResult.ok) {
        logger.error({
          event: 'publication_failed',
          importJobId,
          replayedExistingPublication,
          currentStage: replayedExistingPublication
            ? importJob.currentStage
            : 'publication',
          jobStatus: replayedExistingPublication
            ? importJob.jobStatus
            : 'failed',
          errorCode: publicationResult.error.code,
          message: publicationResult.error.message,
        })

        if (replayedExistingPublication) {
          return publicationResult
        }

        await markPublicationFailure({
          lifecycleStore,
          importJobId,
          publicationStartedAt,
          logger,
          now,
          error: publicationResult.error,
        })

        return publicationResult
      }

      const finalState = deriveFinalPublicationState(publicationResult.data)
      const shouldPersistTerminalState =
        !replayedExistingPublication ||
        importJob.jobStatus !== finalState.jobStatus ||
        importJob.currentStage !== 'published' ||
        importJob.publishedRecordCount !== finalState.publishedRecordCount ||
        importJob.statusReason !== finalState.statusReason

      let finishedAt = importJob.finishedAt ?? now()

      if (shouldPersistTerminalState) {
        finishedAt = now()

        const finalizeResult = await lifecycleStore.finalizeImportJob({
          id: importJobId,
          jobStatus: finalState.jobStatus,
          currentStage: 'published',
          statusReason: finalState.statusReason,
          publishedRecordCount: finalState.publishedRecordCount,
          finishedAt,
        })

        if (!finalizeResult.ok) {
          logger.error({
            event: 'publication_failed',
            importJobId,
            replayedExistingPublication,
            currentStage: replayedExistingPublication
              ? importJob.currentStage
              : 'publication',
            jobStatus: replayedExistingPublication
              ? importJob.jobStatus
              : 'failed',
            errorCode: finalizeResult.error.code,
            message: finalizeResult.error.message,
          })

          if (!replayedExistingPublication) {
            await markPublicationFailure({
              lifecycleStore,
              importJobId,
              publicationStartedAt,
              logger,
              now,
              error: {
                code: 'publication-failed',
                message: finalizeResult.error.message,
                ...(finalizeResult.error.details
                  ? { details: finalizeResult.error.details }
                  : {}),
              },
            })
          }

          return mapLifecycleStoreError(finalizeResult.error)
        }
      }

      logger.info({
        event: 'publication_succeeded',
        importJobId,
        replayedExistingPublication,
        currentStage: 'published',
        jobStatus: finalState.jobStatus,
        attemptedCount: publicationResult.data.attemptedCount,
        publishableCount: publicationResult.data.publishableCount,
        publishedPrintingCount: publicationResult.data.publishedPrintingCount,
        skippedCount: publicationResult.data.skippedResults.length,
      })

      return {
        ok: true,
        data: {
          ...publicationResult.data,
          finalJobStatus: finalState.jobStatus,
          finalJobStage: 'published',
          publishedRecordCount: finalState.publishedRecordCount,
          finishedAt,
          replayedExistingPublication,
        },
      }
    },
  }
}

function deriveFinalPublicationState(summary: CatalogPublicationSummary): {
  readonly jobStatus: 'completed' | 'partially_completed'
  readonly publishedRecordCount: number
  readonly statusReason: string | null
} {
  const skippedCount = summary.skippedResults.length
  const publishedRecordCount = summary.publishedPrintingCount

  if (skippedCount === 0) {
    return {
      jobStatus: 'completed',
      publishedRecordCount,
      statusReason: null,
    }
  }

  if (publishedRecordCount === 0) {
    return {
      jobStatus: 'partially_completed',
      publishedRecordCount,
      statusReason: `Publication completed with no publishable printing records. ${skippedCount} normalization result(s) remained unpublished.`,
    }
  }

  return {
    jobStatus: 'partially_completed',
    publishedRecordCount,
    statusReason: `Publication published ${publishedRecordCount} printing record(s); ${skippedCount} normalization result(s) remained unpublished.`,
  }
}

function resolvePublicationMode(job: TrackedImportJobRecord):
  | {
      readonly ok: true
      readonly replay: boolean
    }
  | {
      readonly ok: false
      readonly message: string
      readonly details: string
    } {
  if (
    job.currentStage === 'published' &&
    (job.jobStatus === 'completed' || job.jobStatus === 'partially_completed')
  ) {
    return {
      ok: true,
      replay: true,
    }
  }

  if (
    job.currentStage !== 'normalization' &&
    job.currentStage !== 'publication'
  ) {
    return {
      ok: false,
      message: 'Import job is not ready for publication.',
      details: `Import job ${job.id} is currently at stage ${job.currentStage}.`,
    }
  }

  if (job.jobStatus === 'pending' || job.jobStatus === 'cancelled') {
    return {
      ok: false,
      message: 'Import job is not in a publishable lifecycle state.',
      details: `Import job ${job.id} has status ${job.jobStatus}.`,
    }
  }

  if (job.currentStage === 'normalization' && job.jobStatus === 'failed') {
    return {
      ok: false,
      message:
        'Import job failed before publication and cannot be published yet.',
      details: `Import job ${job.id} must complete normalization before publication can run.`,
    }
  }

  return {
    ok: true,
    replay: false,
  }
}

async function markPublicationFailure(input: {
  readonly lifecycleStore: CatalogPublicationLifecycleStore
  readonly importJobId: string
  readonly publicationStartedAt: string
  readonly logger: CatalogPublicationLogger
  readonly now: () => string
  readonly error: CatalogPublicationError
}): Promise<void> {
  const finishedAt = input.now()
  const failureResult = await input.lifecycleStore.markImportJobFailed({
    id: input.importJobId,
    currentStage: 'publication',
    startedAt: input.publicationStartedAt,
    finishedAt,
    errorCode: 'publication_failed',
    statusReason: buildPublicationFailureReason(input.error),
  })

  if (!failureResult.ok) {
    input.logger.error({
      event: 'publication_failed',
      importJobId: input.importJobId,
      replayedExistingPublication: false,
      currentStage: 'publication',
      jobStatus: 'failed',
      errorCode: failureResult.error.code,
      message: failureResult.error.message,
    })
  }
}

function buildPublicationFailureReason(error: CatalogPublicationError): string {
  if (error.details) {
    return `${error.message} (${error.details})`
  }

  return error.message
}

function mapLifecycleStoreError(error: {
  readonly message: string
  readonly details?: string
}): CatalogPublicationResult<TrackedCatalogPublicationSummary> {
  return {
    ok: false,
    error: {
      code: 'publication-failed',
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  }
}
