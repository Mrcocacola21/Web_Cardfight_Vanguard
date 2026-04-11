import type { Tables } from '../../generated/database.types'

import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'
import type {
  CreateImportJobInput,
  FinalizeImportJobInput,
  ImportSourceRecord,
  CatalogCardEntityNormalizationRecord,
  CardPrintingNormalizationResultRecord,
  ImportJobRecord,
  ManualReviewItemRecord,
  MarkImportJobFailedInput,
  MarkImportJobRunningInput,
  RawCardPrintingRecord,
  RawProductRecord,
  UpsertImportSourceInput,
  UpdateManualReviewItemStatusInput,
  UpdateImportJobNormalizationStateInput,
  UpdateImportJobRawRecordCountInput,
  UpsertManualReviewItemInput,
  UpsertCardPrintingNormalizationResultInput,
  UpsertRawCardPrintingRecordInput,
  UpsertRawProductRecordInput,
} from './importer.types'

const importSourceSelect =
  'id, source_key, source_type, display_name, provider_name, origin_uri, configuration, is_active, created_at, updated_at'
const importJobSelect =
  'id, source_id, retry_of_job_id, job_status, current_stage, pipeline_version, upstream_snapshot_key, input_fingerprint, scope_metadata, status_reason, error_code, raw_record_count, normalized_candidate_count, conflict_count, published_record_count, created_at, started_at, finished_at, updated_at'
const rawProductRecordSelect =
  'id, import_job_id, source_product_id, payload_fingerprint, raw_name, raw_code, raw_product_category, raw_product_kind, raw_family_name, raw_release_date_text, raw_region_code, source_payload, created_at, updated_at'
const rawCardPrintingRecordSelect =
  'id, import_job_id, source_printing_id, source_product_id, source_product_code, raw_product_record_id, payload_fingerprint, raw_card_name, raw_printing_code, raw_rarity, raw_locale_code, raw_region_code, raw_card_type, raw_nation, raw_clan, raw_trigger_type, raw_grade_text, raw_power_text, raw_critical_text, raw_shield_text, raw_rules_text, source_payload, created_at, updated_at'
const cardPrintingNormalizationResultSelect =
  'id, import_job_id, raw_card_printing_record_id, raw_product_record_id, normalization_version, normalization_status, resolution_basis, proposed_card_entity_id, candidate_card_entity_ids, candidate_count, normalized_name, normalized_grade, normalized_card_type, normalized_nation, normalized_clan, normalized_trigger_type, raw_payload_fingerprint, needs_manual_review, status_reason, conflict_summary, resolution_evidence, created_at, updated_at'
const normalizationCatalogCardEntitySelect =
  'id, canonical_key, name, normalized_name, grade, card_type, nation, clan, trigger_type'
const manualReviewItemSelect =
  'id, import_job_id, normalization_result_id, raw_card_printing_record_id, raw_product_record_id, review_reason, review_status, summary, context_payload, candidate_card_entity_ids, proposed_card_entity_id, resolution_kind, resolved_card_entity_id, decision_notes, opened_at, started_review_at, resolved_at, closed_at, updated_at'

type ImportSourceRow = Tables<{ schema: 'importer' }, 'import_sources'>
type ImportJobRow = Tables<{ schema: 'importer' }, 'import_jobs'>
type RawProductRow = Tables<{ schema: 'importer' }, 'raw_product_records'>
type RawCardPrintingRow = Tables<
  { schema: 'importer' },
  'raw_card_printing_records'
>
type CardPrintingNormalizationResultRow = Tables<
  { schema: 'importer' },
  'card_printing_normalization_results'
>
type ManualReviewItemRow = Tables<{ schema: 'importer' }, 'manual_review_items'>
type CatalogCardEntityNormalizationRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_entities'>,
  | 'id'
  | 'canonical_key'
  | 'name'
  | 'normalized_name'
  | 'grade'
  | 'card_type'
  | 'nation'
  | 'clan'
  | 'trigger_type'
>

export interface ImporterRepository {
  upsertImportSource(
    input: UpsertImportSourceInput,
  ): Promise<RepositoryResult<ImportSourceRecord>>
  createImportJob(
    input: CreateImportJobInput,
  ): Promise<RepositoryResult<ImportJobRecord>>
  getImportJobById(
    id: string,
  ): Promise<RepositoryResult<ImportJobRecord | null>>
  markImportJobRunning(
    input: MarkImportJobRunningInput,
  ): Promise<RepositoryResult<ImportJobRecord>>
  markImportJobFailed(
    input: MarkImportJobFailedInput,
  ): Promise<RepositoryResult<ImportJobRecord>>
  updateImportJobRawRecordCount(
    input: UpdateImportJobRawRecordCountInput,
  ): Promise<RepositoryResult<ImportJobRecord>>
  updateImportJobNormalizationState(
    input: UpdateImportJobNormalizationStateInput,
  ): Promise<RepositoryResult<ImportJobRecord>>
  finalizeImportJob(
    input: FinalizeImportJobInput,
  ): Promise<RepositoryResult<ImportJobRecord>>
  listRawProductRecordsByJobAndSourceIds(
    importJobId: string,
    sourceProductIds: readonly string[],
  ): Promise<RepositoryResult<readonly RawProductRecord[]>>
  listRawProductRecordsByJobAndCodes(
    importJobId: string,
    rawCodes: readonly string[],
  ): Promise<RepositoryResult<readonly RawProductRecord[]>>
  upsertRawProductRecords(
    input: readonly UpsertRawProductRecordInput[],
  ): Promise<RepositoryResult<readonly RawProductRecord[]>>
  listRawCardPrintingRecordsByJobAndSourceIds(
    importJobId: string,
    sourcePrintingIds: readonly string[],
  ): Promise<RepositoryResult<readonly RawCardPrintingRecord[]>>
  listRawCardPrintingRecordsByJob(
    importJobId: string,
    rawCardPrintingRecordIds?: readonly string[],
  ): Promise<RepositoryResult<readonly RawCardPrintingRecord[]>>
  upsertRawCardPrintingRecords(
    input: readonly UpsertRawCardPrintingRecordInput[],
  ): Promise<RepositoryResult<readonly RawCardPrintingRecord[]>>
  listCatalogCardEntitiesByNormalizedNames(
    normalizedNames: readonly string[],
  ): Promise<RepositoryResult<readonly CatalogCardEntityNormalizationRecord[]>>
  listCardPrintingNormalizationResultsByJob(
    importJobId: string,
  ): Promise<RepositoryResult<readonly CardPrintingNormalizationResultRecord[]>>
  listCardPrintingNormalizationResultsByJobAndRawIds(
    importJobId: string,
    rawCardPrintingRecordIds: readonly string[],
  ): Promise<RepositoryResult<readonly CardPrintingNormalizationResultRecord[]>>
  upsertCardPrintingNormalizationResults(
    input: readonly UpsertCardPrintingNormalizationResultInput[],
  ): Promise<RepositoryResult<readonly CardPrintingNormalizationResultRecord[]>>
  markCardPrintingNormalizationResultsSuperseded(
    resultIds: readonly string[],
  ): Promise<RepositoryResult<number>>
  getManualReviewItemById(
    id: string,
  ): Promise<RepositoryResult<ManualReviewItemRecord | null>>
  listManualReviewItemsByJob(
    importJobId: string,
    reviewStatuses?: readonly ManualReviewItemRecord['reviewStatus'][],
  ): Promise<RepositoryResult<readonly ManualReviewItemRecord[]>>
  listManualReviewItemsByNormalizationResultIds(
    normalizationResultIds: readonly string[],
  ): Promise<RepositoryResult<readonly ManualReviewItemRecord[]>>
  upsertManualReviewItems(
    input: readonly UpsertManualReviewItemInput[],
  ): Promise<RepositoryResult<readonly ManualReviewItemRecord[]>>
  updateManualReviewItemStatus(
    input: UpdateManualReviewItemStatusInput,
  ): Promise<RepositoryResult<ManualReviewItemRecord>>
  countAllRawRecordsForJob(
    importJobId: string,
  ): Promise<RepositoryResult<number>>
}

export function createImporterRepository(client: DbClient): ImporterRepository {
  return {
    async upsertImportSource(input) {
      const { data, error } = await client
        .schema('importer')
        .from('import_sources')
        .upsert(
          {
            source_key: input.sourceKey,
            source_type: input.sourceType,
            display_name: input.displayName,
            provider_name: input.providerName,
            origin_uri: input.originUri,
            configuration: input.configuration,
            is_active: input.isActive,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'source_type,source_key',
          },
        )
        .select(importSourceSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to save import source.'))
      }

      return ok(mapImportSourceRow(data))
    },

    async createImportJob(input) {
      const { data, error } = await client
        .schema('importer')
        .from('import_jobs')
        .insert({
          source_id: input.sourceId,
          retry_of_job_id: input.retryOfJobId,
          job_status: 'pending',
          current_stage: 'source',
          pipeline_version: input.pipelineVersion,
          upstream_snapshot_key: input.upstreamSnapshotKey,
          input_fingerprint: input.inputFingerprint,
          scope_metadata: input.scopeMetadata,
        })
        .select(importJobSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to create import job.'))
      }

      return ok(mapImportJobRow(data))
    },

    async getImportJobById(id) {
      const { data, error } = await client
        .schema('importer')
        .from('import_jobs')
        .select(importJobSelect)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load import job.'))
      }

      return ok(data ? mapImportJobRow(data) : null)
    },

    async markImportJobRunning(input) {
      const { data, error } = await client
        .schema('importer')
        .from('import_jobs')
        .update({
          job_status: 'running',
          current_stage: input.currentStage,
          started_at: input.startedAt,
          updated_at: new Date().toISOString(),
          finished_at: null,
          error_code: null,
          status_reason: null,
        })
        .eq('id', input.id)
        .select(importJobSelect)
        .single()

      if (error) {
        return err(
          mapQueryError(error, 'Failed to mark import job as running.'),
        )
      }

      return ok(mapImportJobRow(data))
    },

    async markImportJobFailed(input) {
      const { data, error } = await client
        .schema('importer')
        .from('import_jobs')
        .update({
          job_status: 'failed',
          current_stage: input.currentStage,
          started_at: input.startedAt,
          finished_at: input.finishedAt,
          error_code: input.errorCode,
          status_reason: input.statusReason,
          updated_at: input.finishedAt,
        })
        .eq('id', input.id)
        .select(importJobSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to mark import job as failed.'))
      }

      return ok(mapImportJobRow(data))
    },

    async updateImportJobRawRecordCount(input) {
      const { data, error } = await client
        .schema('importer')
        .from('import_jobs')
        .update({
          current_stage: input.currentStage,
          raw_record_count: input.rawRecordCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select(importJobSelect)
        .single()

      if (error) {
        return err(
          mapQueryError(error, 'Failed to update import job raw record count.'),
        )
      }

      return ok(mapImportJobRow(data))
    },

    async updateImportJobNormalizationState(input) {
      const finishedAt =
        input.jobStatus === 'blocked_for_review'
          ? new Date().toISOString()
          : null
      const { data, error } = await client
        .schema('importer')
        .from('import_jobs')
        .update({
          job_status: input.jobStatus,
          current_stage: input.currentStage,
          normalized_candidate_count: input.normalizedCandidateCount,
          conflict_count: input.conflictCount,
          status_reason: input.statusReason,
          error_code: null,
          finished_at: finishedAt,
          updated_at: finishedAt ?? new Date().toISOString(),
        })
        .eq('id', input.id)
        .select(importJobSelect)
        .single()

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to update import job normalization state.',
          ),
        )
      }

      return ok(mapImportJobRow(data))
    },

    async finalizeImportJob(input) {
      const update: {
        job_status: typeof input.jobStatus
        current_stage: typeof input.currentStage
        status_reason: typeof input.statusReason
        error_code: null
        finished_at: string
        updated_at: string
        published_record_count?: number
      } = {
        job_status: input.jobStatus,
        current_stage: input.currentStage,
        status_reason: input.statusReason,
        error_code: null,
        finished_at: input.finishedAt,
        updated_at: input.finishedAt,
      }

      if (input.publishedRecordCount !== undefined) {
        update.published_record_count = input.publishedRecordCount
      }

      const { data, error } = await client
        .schema('importer')
        .from('import_jobs')
        .update(update)
        .eq('id', input.id)
        .select(importJobSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to finalize import job.'))
      }

      return ok(mapImportJobRow(data))
    },

    async listRawProductRecordsByJobAndSourceIds(
      importJobId,
      sourceProductIds,
    ) {
      if (sourceProductIds.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('raw_product_records')
        .select(rawProductRecordSelect)
        .eq('import_job_id', importJobId)
        .in('source_product_id', sourceProductIds)

      if (error) {
        return err(mapQueryError(error, 'Failed to load raw product records.'))
      }

      return ok((data ?? []).map(mapRawProductRow))
    },

    async upsertRawProductRecords(input) {
      if (input.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('raw_product_records')
        .upsert(
          input.map((record) => ({
            import_job_id: record.importJobId,
            source_product_id: record.sourceProductId,
            payload_fingerprint: record.payloadFingerprint,
            raw_name: record.rawName,
            raw_code: record.rawCode,
            raw_product_category: record.rawProductCategory,
            raw_product_kind: record.rawProductKind,
            raw_family_name: record.rawFamilyName,
            raw_release_date_text: record.rawReleaseDateText,
            raw_region_code: record.rawRegionCode,
            source_payload: record.sourcePayload,
            updated_at: record.updatedAt,
          })),
          {
            onConflict: 'import_job_id,source_product_id',
          },
        )
        .select(rawProductRecordSelect)

      if (error) {
        return err(mapQueryError(error, 'Failed to save raw product records.'))
      }

      return ok((data ?? []).map(mapRawProductRow))
    },

    async listRawProductRecordsByJobAndCodes(importJobId, rawCodes) {
      if (rawCodes.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('raw_product_records')
        .select(rawProductRecordSelect)
        .eq('import_job_id', importJobId)
        .in('raw_code', rawCodes)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load raw product records by source product code.',
          ),
        )
      }

      return ok((data ?? []).map(mapRawProductRow))
    },

    async listRawCardPrintingRecordsByJobAndSourceIds(
      importJobId,
      sourcePrintingIds,
    ) {
      if (sourcePrintingIds.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('raw_card_printing_records')
        .select(rawCardPrintingRecordSelect)
        .eq('import_job_id', importJobId)
        .in('source_printing_id', sourcePrintingIds)

      if (error) {
        return err(mapQueryError(error, 'Failed to load raw printing records.'))
      }

      return ok((data ?? []).map(mapRawCardPrintingRow))
    },

    async listRawCardPrintingRecordsByJob(
      importJobId,
      rawCardPrintingRecordIds,
    ) {
      let request = client
        .schema('importer')
        .from('raw_card_printing_records')
        .select(rawCardPrintingRecordSelect)
        .eq('import_job_id', importJobId)

      if (rawCardPrintingRecordIds && rawCardPrintingRecordIds.length > 0) {
        request = request.in('id', rawCardPrintingRecordIds)
      }

      const { data, error } = await request

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load raw printing records for normalization.',
          ),
        )
      }

      return ok((data ?? []).map(mapRawCardPrintingRow))
    },

    async upsertRawCardPrintingRecords(input) {
      if (input.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('raw_card_printing_records')
        .upsert(
          input.map((record) => ({
            import_job_id: record.importJobId,
            source_printing_id: record.sourcePrintingId,
            source_product_id: record.sourceProductId,
            source_product_code: record.sourceProductCode,
            raw_product_record_id: record.rawProductRecordId,
            payload_fingerprint: record.payloadFingerprint,
            raw_card_name: record.rawCardName,
            raw_printing_code: record.rawPrintingCode,
            raw_rarity: record.rawRarity,
            raw_locale_code: record.rawLocaleCode,
            raw_region_code: record.rawRegionCode,
            raw_card_type: record.rawCardType,
            raw_nation: record.rawNation,
            raw_clan: record.rawClan,
            raw_trigger_type: record.rawTriggerType,
            raw_grade_text: record.rawGradeText,
            raw_power_text: record.rawPowerText,
            raw_critical_text: record.rawCriticalText,
            raw_shield_text: record.rawShieldText,
            raw_rules_text: record.rawRulesText,
            source_payload: record.sourcePayload,
            updated_at: record.updatedAt,
          })),
          {
            onConflict: 'import_job_id,source_printing_id',
          },
        )
        .select(rawCardPrintingRecordSelect)

      if (error) {
        return err(mapQueryError(error, 'Failed to save raw printing records.'))
      }

      return ok((data ?? []).map(mapRawCardPrintingRow))
    },

    async listCatalogCardEntitiesByNormalizedNames(normalizedNames) {
      if (normalizedNames.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('catalog')
        .from('card_entities')
        .select(normalizationCatalogCardEntitySelect)
        .in('normalized_name', normalizedNames)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load canonical card entities for normalization.',
          ),
        )
      }

      return ok((data ?? []).map(mapCatalogCardEntityNormalizationRow))
    },

    async listCardPrintingNormalizationResultsByJob(importJobId) {
      const { data, error } = await client
        .schema('importer')
        .from('card_printing_normalization_results')
        .select(cardPrintingNormalizationResultSelect)
        .eq('import_job_id', importJobId)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load card-printing normalization results.',
          ),
        )
      }

      return ok((data ?? []).map(mapCardPrintingNormalizationResultRow))
    },

    async listCardPrintingNormalizationResultsByJobAndRawIds(
      importJobId,
      rawCardPrintingRecordIds,
    ) {
      if (rawCardPrintingRecordIds.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('card_printing_normalization_results')
        .select(cardPrintingNormalizationResultSelect)
        .eq('import_job_id', importJobId)
        .in('raw_card_printing_record_id', rawCardPrintingRecordIds)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load card-printing normalization results.',
          ),
        )
      }

      return ok((data ?? []).map(mapCardPrintingNormalizationResultRow))
    },

    async upsertCardPrintingNormalizationResults(input) {
      if (input.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('card_printing_normalization_results')
        .upsert(
          input.map((result) => ({
            import_job_id: result.importJobId,
            raw_card_printing_record_id: result.rawCardPrintingRecordId,
            raw_product_record_id: result.rawProductRecordId,
            normalization_version: result.normalizationVersion,
            normalization_status: result.normalizationStatus,
            resolution_basis: result.resolutionBasis,
            proposed_card_entity_id: result.proposedCardEntityId,
            candidate_card_entity_ids: [...result.candidateCardEntityIds],
            candidate_count: result.candidateCount,
            normalized_name: result.normalizedName,
            normalized_grade: result.normalizedGrade,
            normalized_card_type: result.normalizedCardType,
            normalized_nation: result.normalizedNation,
            normalized_clan: result.normalizedClan,
            normalized_trigger_type: result.normalizedTriggerType,
            raw_payload_fingerprint: result.rawPayloadFingerprint,
            needs_manual_review: result.needsManualReview,
            status_reason: result.statusReason,
            conflict_summary: result.conflictSummary,
            resolution_evidence: result.resolutionEvidence,
            updated_at: result.updatedAt,
          })),
          {
            onConflict: 'raw_card_printing_record_id,normalization_version',
          },
        )
        .select(cardPrintingNormalizationResultSelect)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to save card-printing normalization results.',
          ),
        )
      }

      return ok((data ?? []).map(mapCardPrintingNormalizationResultRow))
    },

    async markCardPrintingNormalizationResultsSuperseded(resultIds) {
      if (resultIds.length === 0) {
        return ok(0)
      }

      const { data, error } = await client
        .schema('importer')
        .from('card_printing_normalization_results')
        .update({
          normalization_status: 'superseded',
          needs_manual_review: false,
          conflict_summary: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', resultIds)
        .select('id')

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to mark card-printing normalization results as superseded.',
          ),
        )
      }

      return ok((data ?? []).length)
    },

    async getManualReviewItemById(id) {
      const { data, error } = await client
        .schema('importer')
        .from('manual_review_items')
        .select(manualReviewItemSelect)
        .eq('id', id)
        .maybeSingle()

      if (error) {
        return err(mapQueryError(error, 'Failed to load manual review item.'))
      }

      return ok(data ? mapManualReviewItemRow(data) : null)
    },

    async listManualReviewItemsByJob(importJobId, reviewStatuses) {
      let request = client
        .schema('importer')
        .from('manual_review_items')
        .select(manualReviewItemSelect)
        .eq('import_job_id', importJobId)

      if (reviewStatuses && reviewStatuses.length > 0) {
        request = request.in('review_status', reviewStatuses)
      }

      const { data, error } = await request

      if (error) {
        return err(mapQueryError(error, 'Failed to load manual review items.'))
      }

      return ok((data ?? []).map(mapManualReviewItemRow))
    },

    async listManualReviewItemsByNormalizationResultIds(
      normalizationResultIds,
    ) {
      if (normalizationResultIds.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('manual_review_items')
        .select(manualReviewItemSelect)
        .in('normalization_result_id', normalizationResultIds)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load manual review items by normalization result.',
          ),
        )
      }

      return ok((data ?? []).map(mapManualReviewItemRow))
    },

    async upsertManualReviewItems(input) {
      if (input.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('importer')
        .from('manual_review_items')
        .upsert(
          input.map((item) => ({
            import_job_id: item.importJobId,
            normalization_result_id: item.normalizationResultId,
            raw_card_printing_record_id: item.rawCardPrintingRecordId,
            raw_product_record_id: item.rawProductRecordId,
            review_reason: item.reviewReason,
            review_status: item.reviewStatus,
            summary: item.summary,
            context_payload: item.contextPayload,
            candidate_card_entity_ids: [...item.candidateCardEntityIds],
            proposed_card_entity_id: item.proposedCardEntityId,
            resolution_kind: item.resolutionKind,
            resolved_card_entity_id: item.resolvedCardEntityId,
            decision_notes: item.decisionNotes,
            opened_at: item.openedAt,
            started_review_at: item.startedReviewAt,
            resolved_at: item.resolvedAt,
            closed_at: item.closedAt,
            updated_at: item.updatedAt,
          })),
          {
            onConflict: 'normalization_result_id',
          },
        )
        .select(manualReviewItemSelect)

      if (error) {
        return err(mapQueryError(error, 'Failed to save manual review items.'))
      }

      return ok((data ?? []).map(mapManualReviewItemRow))
    },

    async updateManualReviewItemStatus(input) {
      const { data, error } = await client
        .schema('importer')
        .from('manual_review_items')
        .update({
          review_status: input.reviewStatus,
          resolution_kind: input.resolutionKind,
          resolved_card_entity_id: input.resolvedCardEntityId,
          decision_notes: input.decisionNotes,
          started_review_at: input.startedReviewAt,
          resolved_at: input.resolvedAt,
          closed_at: input.closedAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select(manualReviewItemSelect)
        .single()

      if (error) {
        return err(mapQueryError(error, 'Failed to update manual review item.'))
      }

      return ok(mapManualReviewItemRow(data))
    },

    async countAllRawRecordsForJob(importJobId) {
      const { error: rawProductError, count: rawProductCount } = await client
        .schema('importer')
        .from('raw_product_records')
        .select('id', { count: 'exact' })
        .eq('import_job_id', importJobId)

      if (rawProductError) {
        return err(
          mapQueryError(rawProductError, 'Failed to count raw import records.'),
        )
      }

      const { error: rawCardPrintingError, count: rawCardPrintingCount } =
        await client
          .schema('importer')
          .from('raw_card_printing_records')
          .select('id', { count: 'exact' })
          .eq('import_job_id', importJobId)

      if (rawCardPrintingError) {
        return err(
          mapQueryError(
            rawCardPrintingError,
            'Failed to count raw import records.',
          ),
        )
      }

      return ok((rawProductCount ?? 0) + (rawCardPrintingCount ?? 0))
    },
  }
}

function mapImportSourceRow(row: ImportSourceRow): ImportSourceRecord {
  return {
    id: row.id,
    sourceKey: row.source_key,
    sourceType: row.source_type,
    displayName: row.display_name,
    providerName: row.provider_name,
    originUri: row.origin_uri,
    configuration: row.configuration,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapImportJobRow(row: ImportJobRow): ImportJobRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    retryOfJobId: row.retry_of_job_id,
    jobStatus: row.job_status,
    currentStage: row.current_stage,
    pipelineVersion: row.pipeline_version,
    upstreamSnapshotKey: row.upstream_snapshot_key,
    inputFingerprint: row.input_fingerprint,
    scopeMetadata: row.scope_metadata,
    statusReason: row.status_reason,
    errorCode: row.error_code,
    rawRecordCount: row.raw_record_count,
    normalizedCandidateCount: row.normalized_candidate_count,
    conflictCount: row.conflict_count,
    publishedRecordCount: row.published_record_count,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    updatedAt: row.updated_at,
  }
}

function mapRawProductRow(row: RawProductRow): RawProductRecord {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    sourceProductId: row.source_product_id,
    payloadFingerprint: row.payload_fingerprint,
    rawName: row.raw_name,
    rawCode: row.raw_code,
    rawProductCategory: row.raw_product_category,
    rawProductKind: row.raw_product_kind,
    rawFamilyName: row.raw_family_name,
    rawReleaseDateText: row.raw_release_date_text,
    rawRegionCode: row.raw_region_code,
    sourcePayload: row.source_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRawCardPrintingRow(row: RawCardPrintingRow): RawCardPrintingRecord {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    sourcePrintingId: row.source_printing_id,
    sourceProductId: row.source_product_id,
    sourceProductCode: row.source_product_code,
    rawProductRecordId: row.raw_product_record_id,
    payloadFingerprint: row.payload_fingerprint,
    rawCardName: row.raw_card_name,
    rawPrintingCode: row.raw_printing_code,
    rawRarity: row.raw_rarity,
    rawLocaleCode: row.raw_locale_code,
    rawRegionCode: row.raw_region_code,
    rawCardType: row.raw_card_type,
    rawNation: row.raw_nation,
    rawClan: row.raw_clan,
    rawTriggerType: row.raw_trigger_type,
    rawGradeText: row.raw_grade_text,
    rawPowerText: row.raw_power_text,
    rawCriticalText: row.raw_critical_text,
    rawShieldText: row.raw_shield_text,
    rawRulesText: row.raw_rules_text,
    sourcePayload: row.source_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCatalogCardEntityNormalizationRow(
  row: CatalogCardEntityNormalizationRow,
): CatalogCardEntityNormalizationRecord {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    name: row.name,
    normalizedName: row.normalized_name,
    grade: row.grade,
    cardType: row.card_type,
    nation: row.nation,
    clan: row.clan,
    triggerType: row.trigger_type,
  }
}

function mapCardPrintingNormalizationResultRow(
  row: CardPrintingNormalizationResultRow,
): CardPrintingNormalizationResultRecord {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    rawCardPrintingRecordId: row.raw_card_printing_record_id,
    rawProductRecordId: row.raw_product_record_id,
    normalizationVersion: row.normalization_version,
    normalizationStatus: row.normalization_status,
    resolutionBasis: row.resolution_basis,
    proposedCardEntityId: row.proposed_card_entity_id,
    candidateCardEntityIds: row.candidate_card_entity_ids,
    candidateCount: row.candidate_count,
    normalizedName: row.normalized_name,
    normalizedGrade: row.normalized_grade,
    normalizedCardType: row.normalized_card_type,
    normalizedNation: row.normalized_nation,
    normalizedClan: row.normalized_clan,
    normalizedTriggerType: row.normalized_trigger_type,
    rawPayloadFingerprint: row.raw_payload_fingerprint,
    needsManualReview: row.needs_manual_review,
    statusReason: row.status_reason,
    conflictSummary: row.conflict_summary,
    resolutionEvidence: row.resolution_evidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapManualReviewItemRow(
  row: ManualReviewItemRow,
): ManualReviewItemRecord {
  return {
    id: row.id,
    importJobId: row.import_job_id,
    normalizationResultId: row.normalization_result_id,
    rawCardPrintingRecordId: row.raw_card_printing_record_id,
    rawProductRecordId: row.raw_product_record_id,
    reviewReason: row.review_reason,
    reviewStatus: row.review_status,
    summary: row.summary,
    contextPayload: row.context_payload,
    candidateCardEntityIds: row.candidate_card_entity_ids,
    proposedCardEntityId: row.proposed_card_entity_id,
    resolutionKind: row.resolution_kind,
    resolvedCardEntityId: row.resolved_card_entity_id,
    decisionNotes: row.decision_notes,
    openedAt: row.opened_at,
    startedReviewAt: row.started_review_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    updatedAt: row.updated_at,
  }
}
