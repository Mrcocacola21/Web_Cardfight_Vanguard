import { afterEach, describe, expect, it } from 'vitest'

import { createSequentialMockDbClient } from '../shared/mock-db-client'
import { createImporterRepository } from './importer.repository'

describe('importer repository', () => {
  const cleanups: Array<() => void> = []

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.()
    }
  })

  it('loads import jobs through importer persistence only', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('import_jobs')
          expect(query.operation).toBe('select')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'job-1',
            },
          ])
          expect(query.cardinality).toBe('maybeSingle')
        },
        response: {
          data: {
            id: 'job-1',
            source_id: 'source-1',
            retry_of_job_id: null,
            job_status: 'pending',
            current_stage: 'source',
            pipeline_version: 'v1',
            upstream_snapshot_key: 'snapshot-1',
            input_fingerprint: 'hash-1',
            scope_metadata: {
              slice: 'd-bt01',
            },
            status_reason: null,
            error_code: null,
            raw_record_count: 0,
            normalized_candidate_count: 0,
            conflict_count: 0,
            published_record_count: 0,
            created_at: '2026-04-09T10:00:00.000Z',
            started_at: null,
            finished_at: null,
            updated_at: '2026-04-09T10:00:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const result = await repository.getImportJobById('job-1')

    expect(result).toEqual({
      ok: true,
      data: {
        id: 'job-1',
        sourceId: 'source-1',
        retryOfJobId: null,
        jobStatus: 'pending',
        currentStage: 'source',
        pipelineVersion: 'v1',
        upstreamSnapshotKey: 'snapshot-1',
        inputFingerprint: 'hash-1',
        scopeMetadata: {
          slice: 'd-bt01',
        },
        statusReason: null,
        errorCode: null,
        rawRecordCount: 0,
        normalizedCandidateCount: 0,
        conflictCount: 0,
        publishedRecordCount: 0,
        createdAt: '2026-04-09T10:00:00.000Z',
        startedAt: null,
        finishedAt: null,
        updatedAt: '2026-04-09T10:00:00.000Z',
      },
    })
  })

  it('upserts import sources, creates import jobs, and finalizes them under importer schema', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('import_sources')
          expect(query.operation).toBe('upsert')
          expect(query.onConflict).toBe('source_type,source_key')
          const values = expectQueryValuesObject(query.values)

          expect(values).toMatchObject({
            source_key: 'dev-json.sample-standard-with-review',
            source_type: 'dev_json',
            display_name: 'Dev JSON sample: standard with review',
            provider_name: 'local-dev',
            origin_uri:
              'file:///C:/codes/Web_VG/packages/importer/fixtures/dev-json/sample-standard-with-review.json',
            configuration: {
              mode: 'dev-json',
              contractVersion: 'v1',
            },
            is_active: true,
          })
          expect(typeof values.updated_at).toBe('string')
        },
        response: {
          data: {
            id: 'source-1',
            source_key: 'dev-json.sample-standard-with-review',
            source_type: 'dev_json',
            display_name: 'Dev JSON sample: standard with review',
            provider_name: 'local-dev',
            origin_uri:
              'file:///C:/codes/Web_VG/packages/importer/fixtures/dev-json/sample-standard-with-review.json',
            configuration: {
              mode: 'dev-json',
              contractVersion: 'v1',
            },
            is_active: true,
            created_at: '2026-04-09T10:00:00.000Z',
            updated_at: '2026-04-09T10:05:00.000Z',
          },
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('import_jobs')
          expect(query.operation).toBe('insert')
          expect(query.values).toEqual({
            source_id: 'source-1',
            retry_of_job_id: null,
            job_status: 'pending',
            current_stage: 'source',
            pipeline_version: 'dev-json-importer/v1',
            upstream_snapshot_key: 'sample-v1',
            input_fingerprint: 'fixture-hash',
            scope_metadata: {
              filePath:
                'C:\\codes\\Web_VG\\packages\\importer\\fixtures\\dev-json\\sample-standard-with-review.json',
              productCount: 1,
              printingCount: 2,
            },
          })
        },
        response: {
          data: {
            id: 'job-1',
            source_id: 'source-1',
            retry_of_job_id: null,
            job_status: 'pending',
            current_stage: 'source',
            pipeline_version: 'dev-json-importer/v1',
            upstream_snapshot_key: 'sample-v1',
            input_fingerprint: 'fixture-hash',
            scope_metadata: {
              filePath:
                'C:\\codes\\Web_VG\\packages\\importer\\fixtures\\dev-json\\sample-standard-with-review.json',
              productCount: 1,
              printingCount: 2,
            },
            status_reason: null,
            error_code: null,
            raw_record_count: 0,
            normalized_candidate_count: 0,
            conflict_count: 0,
            published_record_count: 0,
            created_at: '2026-04-09T10:05:00.000Z',
            started_at: null,
            finished_at: null,
            updated_at: '2026-04-09T10:05:00.000Z',
          },
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('import_jobs')
          expect(query.operation).toBe('update')
          expect(query.values).toMatchObject({
            job_status: 'partially_completed',
            current_stage: 'normalization',
            status_reason:
              'Dev JSON import completed through normalization. Publication was not run.',
            error_code: null,
            finished_at: '2026-04-09T10:10:00.000Z',
            updated_at: '2026-04-09T10:10:00.000Z',
          })
        },
        response: {
          data: {
            id: 'job-1',
            source_id: 'source-1',
            retry_of_job_id: null,
            job_status: 'partially_completed',
            current_stage: 'normalization',
            pipeline_version: 'dev-json-importer/v1',
            upstream_snapshot_key: 'sample-v1',
            input_fingerprint: 'fixture-hash',
            scope_metadata: {
              filePath:
                'C:\\codes\\Web_VG\\packages\\importer\\fixtures\\dev-json\\sample-standard-with-review.json',
              productCount: 1,
              printingCount: 2,
            },
            status_reason:
              'Dev JSON import completed through normalization. Publication was not run.',
            error_code: null,
            raw_record_count: 3,
            normalized_candidate_count: 2,
            conflict_count: 1,
            published_record_count: 0,
            created_at: '2026-04-09T10:05:00.000Z',
            started_at: '2026-04-09T10:06:00.000Z',
            finished_at: '2026-04-09T10:10:00.000Z',
            updated_at: '2026-04-09T10:10:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const sourceResult = await repository.upsertImportSource({
      sourceKey: 'dev-json.sample-standard-with-review',
      sourceType: 'dev_json',
      displayName: 'Dev JSON sample: standard with review',
      providerName: 'local-dev',
      originUri:
        'file:///C:/codes/Web_VG/packages/importer/fixtures/dev-json/sample-standard-with-review.json',
      configuration: {
        mode: 'dev-json',
        contractVersion: 'v1',
      },
      isActive: true,
    })
    const jobResult = await repository.createImportJob({
      sourceId: 'source-1',
      retryOfJobId: null,
      pipelineVersion: 'dev-json-importer/v1',
      upstreamSnapshotKey: 'sample-v1',
      inputFingerprint: 'fixture-hash',
      scopeMetadata: {
        filePath:
          'C:\\codes\\Web_VG\\packages\\importer\\fixtures\\dev-json\\sample-standard-with-review.json',
        productCount: 1,
        printingCount: 2,
      },
    })
    const finalizeResult = await repository.finalizeImportJob({
      id: 'job-1',
      jobStatus: 'partially_completed',
      currentStage: 'normalization',
      statusReason:
        'Dev JSON import completed through normalization. Publication was not run.',
      finishedAt: '2026-04-09T10:10:00.000Z',
    })

    expect(sourceResult.ok).toBe(true)
    expect(jobResult.ok).toBe(true)
    expect(finalizeResult.ok).toBe(true)
  })

  it('tracks publication-stage completion with published record accounting', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('import_jobs')
          expect(query.operation).toBe('update')
          expect(query.values).toMatchObject({
            job_status: 'running',
            current_stage: 'publication',
            started_at: '2026-04-10T12:00:00.000Z',
            finished_at: null,
            error_code: null,
            status_reason: null,
          })
        },
        response: {
          data: {
            id: 'job-1',
            source_id: 'source-1',
            retry_of_job_id: null,
            job_status: 'running',
            current_stage: 'publication',
            pipeline_version: 'dev-json-importer/v1',
            upstream_snapshot_key: 'wave-1',
            input_fingerprint: 'fixture-hash',
            scope_metadata: {},
            status_reason: null,
            error_code: null,
            raw_record_count: 7,
            normalized_candidate_count: 4,
            conflict_count: 1,
            published_record_count: 0,
            created_at: '2026-04-10T11:55:00.000Z',
            started_at: '2026-04-10T12:00:00.000Z',
            finished_at: null,
            updated_at: '2026-04-10T12:00:00.000Z',
          },
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('import_jobs')
          expect(query.operation).toBe('update')
          expect(query.values).toMatchObject({
            job_status: 'partially_completed',
            current_stage: 'published',
            status_reason:
              'Publication published 3 printing record(s); 1 normalization result(s) remained unpublished.',
            published_record_count: 3,
            finished_at: '2026-04-10T12:01:00.000Z',
            updated_at: '2026-04-10T12:01:00.000Z',
          })
        },
        response: {
          data: {
            id: 'job-1',
            source_id: 'source-1',
            retry_of_job_id: null,
            job_status: 'partially_completed',
            current_stage: 'published',
            pipeline_version: 'dev-json-importer/v1',
            upstream_snapshot_key: 'wave-1',
            input_fingerprint: 'fixture-hash',
            scope_metadata: {},
            status_reason:
              'Publication published 3 printing record(s); 1 normalization result(s) remained unpublished.',
            error_code: null,
            raw_record_count: 7,
            normalized_candidate_count: 4,
            conflict_count: 1,
            published_record_count: 3,
            created_at: '2026-04-10T11:55:00.000Z',
            started_at: '2026-04-10T12:00:00.000Z',
            finished_at: '2026-04-10T12:01:00.000Z',
            updated_at: '2026-04-10T12:01:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const runningResult = await repository.markImportJobRunning({
      id: 'job-1',
      currentStage: 'publication',
      startedAt: '2026-04-10T12:00:00.000Z',
    })
    const finalizeResult = await repository.finalizeImportJob({
      id: 'job-1',
      jobStatus: 'partially_completed',
      currentStage: 'published',
      statusReason:
        'Publication published 3 printing record(s); 1 normalization result(s) remained unpublished.',
      publishedRecordCount: 3,
      finishedAt: '2026-04-10T12:01:00.000Z',
    })

    expect(runningResult.ok).toBe(true)
    expect(finalizeResult).toEqual({
      ok: true,
      data: {
        id: 'job-1',
        sourceId: 'source-1',
        retryOfJobId: null,
        jobStatus: 'partially_completed',
        currentStage: 'published',
        pipelineVersion: 'dev-json-importer/v1',
        upstreamSnapshotKey: 'wave-1',
        inputFingerprint: 'fixture-hash',
        scopeMetadata: {},
        statusReason:
          'Publication published 3 printing record(s); 1 normalization result(s) remained unpublished.',
        errorCode: null,
        rawRecordCount: 7,
        normalizedCandidateCount: 4,
        conflictCount: 1,
        publishedRecordCount: 3,
        createdAt: '2026-04-10T11:55:00.000Z',
        startedAt: '2026-04-10T12:00:00.000Z',
        finishedAt: '2026-04-10T12:01:00.000Z',
        updatedAt: '2026-04-10T12:01:00.000Z',
      },
    })
  })

  it('lists raw product records by source ids and codes under importer schema', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('raw_product_records')
          expect(query.operation).toBe('select')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'import_job_id',
              value: 'job-1',
            },
            {
              type: 'in',
              column: 'source_product_id',
              value: ['prod-1'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'raw-product-1',
              import_job_id: 'job-1',
              source_product_id: 'prod-1',
              payload_fingerprint: 'hash-1',
              raw_name: 'D-BT01 Genesis of the Five Greats',
              raw_code: 'D-BT01',
              raw_product_category: 'booster',
              raw_product_kind: 'main',
              raw_family_name: 'Standard Booster',
              raw_release_date_text: '2021-05-14',
              raw_region_code: 'jp',
              source_payload: {
                title: 'D-BT01 Genesis of the Five Greats',
              },
              created_at: '2026-04-09T10:00:00.000Z',
              updated_at: '2026-04-09T10:00:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('raw_product_records')
          expect(query.operation).toBe('select')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'import_job_id',
              value: 'job-1',
            },
            {
              type: 'in',
              column: 'raw_code',
              value: ['D-BT01'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'raw-product-1',
              import_job_id: 'job-1',
              source_product_id: 'prod-1',
              payload_fingerprint: 'hash-1',
              raw_name: 'D-BT01 Genesis of the Five Greats',
              raw_code: 'D-BT01',
              raw_product_category: 'booster',
              raw_product_kind: 'main',
              raw_family_name: 'Standard Booster',
              raw_release_date_text: '2021-05-14',
              raw_region_code: 'jp',
              source_payload: {
                title: 'D-BT01 Genesis of the Five Greats',
              },
              created_at: '2026-04-09T10:00:00.000Z',
              updated_at: '2026-04-09T10:00:00.000Z',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const byIdResult = await repository.listRawProductRecordsByJobAndSourceIds(
      'job-1',
      ['prod-1'],
    )
    const byCodeResult = await repository.listRawProductRecordsByJobAndCodes(
      'job-1',
      ['D-BT01'],
    )

    expect(byIdResult.ok).toBe(true)
    expect(byCodeResult.ok).toBe(true)
  })

  it('lists and upserts raw printing records under importer schema', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('raw_card_printing_records')
          expect(query.operation).toBe('select')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'import_job_id',
              value: 'job-1',
            },
            {
              type: 'in',
              column: 'source_printing_id',
              value: ['printing-1'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'raw-printing-1',
              import_job_id: 'job-1',
              source_printing_id: 'printing-1',
              source_product_id: 'prod-1',
              source_product_code: 'D-BT01',
              raw_product_record_id: 'raw-product-1',
              payload_fingerprint: 'hash-1',
              raw_card_name: 'Apex Ruler, Bastion',
              raw_printing_code: '001',
              raw_rarity: 'RRR',
              raw_locale_code: 'jp',
              raw_region_code: 'jp',
              raw_card_type: 'normal-unit',
              raw_nation: 'Keter Sanctuary',
              raw_clan: null,
              raw_trigger_type: null,
              raw_grade_text: '3',
              raw_power_text: '13000',
              raw_critical_text: '1',
              raw_shield_text: '0',
              raw_rules_text: '[AUTO]: When this unit attacks...',
              source_payload: {
                title: 'Apex Ruler, Bastion',
              },
              created_at: '2026-04-09T10:00:00.000Z',
              updated_at: '2026-04-09T10:00:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('raw_card_printing_records')
          expect(query.operation).toBe('upsert')
          expect(query.onConflict).toBe('import_job_id,source_printing_id')
          expect(query.values).toEqual([
            {
              import_job_id: 'job-1',
              source_printing_id: 'printing-1',
              source_product_id: 'prod-1',
              source_product_code: 'D-BT01',
              raw_product_record_id: 'raw-product-1',
              payload_fingerprint: 'hash-2',
              raw_card_name: 'Apex Ruler, Bastion',
              raw_printing_code: '001',
              raw_rarity: 'RRR',
              raw_locale_code: 'jp',
              raw_region_code: 'jp',
              raw_card_type: 'normal-unit',
              raw_nation: 'Keter Sanctuary',
              raw_clan: null,
              raw_trigger_type: null,
              raw_grade_text: '3',
              raw_power_text: '13000',
              raw_critical_text: '1',
              raw_shield_text: '0',
              raw_rules_text: '[AUTO]: When this unit attacks...',
              source_payload: {
                title: 'Apex Ruler, Bastion',
                revision: '2',
              },
              updated_at: '2026-04-09T11:00:00.000Z',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'raw-printing-1',
              import_job_id: 'job-1',
              source_printing_id: 'printing-1',
              source_product_id: 'prod-1',
              source_product_code: 'D-BT01',
              raw_product_record_id: 'raw-product-1',
              payload_fingerprint: 'hash-2',
              raw_card_name: 'Apex Ruler, Bastion',
              raw_printing_code: '001',
              raw_rarity: 'RRR',
              raw_locale_code: 'jp',
              raw_region_code: 'jp',
              raw_card_type: 'normal-unit',
              raw_nation: 'Keter Sanctuary',
              raw_clan: null,
              raw_trigger_type: null,
              raw_grade_text: '3',
              raw_power_text: '13000',
              raw_critical_text: '1',
              raw_shield_text: '0',
              raw_rules_text: '[AUTO]: When this unit attacks...',
              source_payload: {
                title: 'Apex Ruler, Bastion',
                revision: '2',
              },
              created_at: '2026-04-09T10:00:00.000Z',
              updated_at: '2026-04-09T11:00:00.000Z',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const listResult =
      await repository.listRawCardPrintingRecordsByJobAndSourceIds('job-1', [
        'printing-1',
      ])
    const upsertResult = await repository.upsertRawCardPrintingRecords([
      {
        importJobId: 'job-1',
        sourcePrintingId: 'printing-1',
        sourceProductId: 'prod-1',
        sourceProductCode: 'D-BT01',
        rawProductRecordId: 'raw-product-1',
        payloadFingerprint: 'hash-2',
        rawCardName: 'Apex Ruler, Bastion',
        rawPrintingCode: '001',
        rawRarity: 'RRR',
        rawLocaleCode: 'jp',
        rawRegionCode: 'jp',
        rawCardType: 'normal-unit',
        rawNation: 'Keter Sanctuary',
        rawClan: null,
        rawTriggerType: null,
        rawGradeText: '3',
        rawPowerText: '13000',
        rawCriticalText: '1',
        rawShieldText: '0',
        rawRulesText: '[AUTO]: When this unit attacks...',
        sourcePayload: {
          title: 'Apex Ruler, Bastion',
          revision: '2',
        },
        updatedAt: '2026-04-09T11:00:00.000Z',
      },
    ])

    expect(listResult.ok).toBe(true)
    expect(upsertResult.ok).toBe(true)
  })

  it('counts all raw records for a job across products and printings', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('raw_product_records')
          expect(query.count).toBe('exact')
        },
        response: {
          data: [],
          count: 2,
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('raw_card_printing_records')
          expect(query.count).toBe('exact')
        },
        response: {
          data: [],
          count: 5,
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const result = await repository.countAllRawRecordsForJob('job-1')

    expect(result).toEqual({
      ok: true,
      data: 7,
    })
  })

  it('lists canonical card entities and persists card-printing normalization results', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('catalog')
          expect(query.table).toBe('card_entities')
          expect(query.operation).toBe('select')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'normalized_name',
              value: ['apex ruler, bastion'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'entity-1',
              canonical_key: 'apex-ruler-bastion',
              name: 'Apex Ruler, Bastion',
              normalized_name: 'apex ruler, bastion',
              grade: 3,
              card_type: 'normal-unit',
              nation: 'Keter Sanctuary',
              clan: null,
              trigger_type: null,
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('card_printing_normalization_results')
          expect(query.operation).toBe('upsert')
          expect(query.onConflict).toBe(
            'raw_card_printing_record_id,normalization_version',
          )
          expect(query.values).toEqual([
            {
              import_job_id: 'job-1',
              raw_card_printing_record_id: 'raw-printing-1',
              raw_product_record_id: 'raw-product-1',
              normalization_version: 'card-printing-normalizer/v1',
              normalization_status: 'auto_resolved',
              resolution_basis: 'exact_name_with_attributes',
              proposed_card_entity_id: 'entity-1',
              candidate_card_entity_ids: ['entity-1'],
              candidate_count: 1,
              normalized_name: 'apex ruler, bastion',
              normalized_grade: 3,
              normalized_card_type: 'normal-unit',
              normalized_nation: 'keter sanctuary',
              normalized_clan: null,
              normalized_trigger_type: null,
              raw_payload_fingerprint: 'hash-1',
              needs_manual_review: false,
              status_reason:
                'Resolved by exact normalized name and compatible structural fields.',
              conflict_summary: null,
              resolution_evidence: {
                matchedFields: ['name', 'grade', 'cardType', 'nation'],
                conflictingFields: [],
              },
              updated_at: '2026-04-09T12:00:00.000Z',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'normalization-1',
              import_job_id: 'job-1',
              raw_card_printing_record_id: 'raw-printing-1',
              raw_product_record_id: 'raw-product-1',
              normalization_version: 'card-printing-normalizer/v1',
              normalization_status: 'auto_resolved',
              resolution_basis: 'exact_name_with_attributes',
              proposed_card_entity_id: 'entity-1',
              candidate_card_entity_ids: ['entity-1'],
              candidate_count: 1,
              normalized_name: 'apex ruler, bastion',
              normalized_grade: 3,
              normalized_card_type: 'normal-unit',
              normalized_nation: 'keter sanctuary',
              normalized_clan: null,
              normalized_trigger_type: null,
              raw_payload_fingerprint: 'hash-1',
              needs_manual_review: false,
              status_reason:
                'Resolved by exact normalized name and compatible structural fields.',
              conflict_summary: null,
              resolution_evidence: {
                matchedFields: ['name', 'grade', 'cardType', 'nation'],
                conflictingFields: [],
              },
              created_at: '2026-04-09T12:00:00.000Z',
              updated_at: '2026-04-09T12:00:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('card_printing_normalization_results')
          expect(query.operation).toBe('select')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'import_job_id',
              value: 'job-1',
            },
            {
              type: 'in',
              column: 'raw_card_printing_record_id',
              value: ['raw-printing-1'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'normalization-1',
              import_job_id: 'job-1',
              raw_card_printing_record_id: 'raw-printing-1',
              raw_product_record_id: 'raw-product-1',
              normalization_version: 'card-printing-normalizer/v1',
              normalization_status: 'auto_resolved',
              resolution_basis: 'exact_name_with_attributes',
              proposed_card_entity_id: 'entity-1',
              candidate_card_entity_ids: ['entity-1'],
              candidate_count: 1,
              normalized_name: 'apex ruler, bastion',
              normalized_grade: 3,
              normalized_card_type: 'normal-unit',
              normalized_nation: 'keter sanctuary',
              normalized_clan: null,
              normalized_trigger_type: null,
              raw_payload_fingerprint: 'hash-1',
              needs_manual_review: false,
              status_reason:
                'Resolved by exact normalized name and compatible structural fields.',
              conflict_summary: null,
              resolution_evidence: {
                matchedFields: ['name', 'grade', 'cardType', 'nation'],
                conflictingFields: [],
              },
              created_at: '2026-04-09T12:00:00.000Z',
              updated_at: '2026-04-09T12:00:00.000Z',
            },
          ],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const entityResult =
      await repository.listCatalogCardEntitiesByNormalizedNames([
        'apex ruler, bastion',
      ])
    const upsertResult =
      await repository.upsertCardPrintingNormalizationResults([
        {
          importJobId: 'job-1',
          rawCardPrintingRecordId: 'raw-printing-1',
          rawProductRecordId: 'raw-product-1',
          normalizationVersion: 'card-printing-normalizer/v1',
          normalizationStatus: 'auto_resolved',
          resolutionBasis: 'exact_name_with_attributes',
          proposedCardEntityId: 'entity-1',
          candidateCardEntityIds: ['entity-1'],
          candidateCount: 1,
          normalizedName: 'apex ruler, bastion',
          normalizedGrade: 3,
          normalizedCardType: 'normal-unit',
          normalizedNation: 'keter sanctuary',
          normalizedClan: null,
          normalizedTriggerType: null,
          rawPayloadFingerprint: 'hash-1',
          needsManualReview: false,
          statusReason:
            'Resolved by exact normalized name and compatible structural fields.',
          conflictSummary: null,
          resolutionEvidence: {
            matchedFields: ['name', 'grade', 'cardType', 'nation'],
            conflictingFields: [],
          },
          updatedAt: '2026-04-09T12:00:00.000Z',
        },
      ])
    const listResult =
      await repository.listCardPrintingNormalizationResultsByJobAndRawIds(
        'job-1',
        ['raw-printing-1'],
      )

    expect(entityResult.ok).toBe(true)
    expect(upsertResult.ok).toBe(true)
    expect(listResult.ok).toBe(true)
  })

  it('updates job normalization state and can supersede older normalization results', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('import_jobs')
          expect(query.operation).toBe('update')
          const values = expectQueryValuesObject(query.values)

          expect(values).toMatchObject({
            job_status: 'blocked_for_review',
            current_stage: 'normalization',
            normalized_candidate_count: 4,
            conflict_count: 2,
            status_reason:
              'Normalization produced records that require manual review.',
            error_code: null,
          })
          expect(typeof values.finished_at).toBe('string')
        },
        response: {
          data: {
            id: 'job-1',
            source_id: 'source-1',
            retry_of_job_id: null,
            job_status: 'blocked_for_review',
            current_stage: 'normalization',
            pipeline_version: 'v1',
            upstream_snapshot_key: null,
            input_fingerprint: null,
            scope_metadata: {},
            status_reason:
              'Normalization produced records that require manual review.',
            error_code: null,
            raw_record_count: 10,
            normalized_candidate_count: 4,
            conflict_count: 2,
            published_record_count: 0,
            created_at: '2026-04-09T10:00:00.000Z',
            started_at: '2026-04-09T10:01:00.000Z',
            finished_at: '2026-04-09T10:05:00.000Z',
            updated_at: '2026-04-09T10:05:00.000Z',
          },
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('card_printing_normalization_results')
          expect(query.operation).toBe('update')
          expect(query.filters).toEqual([
            {
              type: 'in',
              column: 'id',
              value: ['normalization-1'],
            },
          ])
        },
        response: {
          data: [{ id: 'normalization-1' }],
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const jobResult = await repository.updateImportJobNormalizationState({
      id: 'job-1',
      jobStatus: 'blocked_for_review',
      currentStage: 'normalization',
      normalizedCandidateCount: 4,
      conflictCount: 2,
      statusReason:
        'Normalization produced records that require manual review.',
    })
    const supersedeResult =
      await repository.markCardPrintingNormalizationResultsSuperseded([
        'normalization-1',
      ])

    expect(jobResult.ok).toBe(true)
    expect(supersedeResult).toEqual({
      ok: true,
      data: 1,
    })
  })

  it('lists, upserts, and updates manual review items under importer schema', async () => {
    const mock = createSequentialMockDbClient([
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('manual_review_items')
          expect(query.operation).toBe('select')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'import_job_id',
              value: 'job-1',
            },
            {
              type: 'in',
              column: 'review_status',
              value: ['open'],
            },
          ])
        },
        response: {
          data: [
            {
              id: 'review-1',
              import_job_id: 'job-1',
              normalization_result_id: 'normalization-1',
              raw_card_printing_record_id: 'raw-printing-1',
              raw_product_record_id: 'raw-product-1',
              review_reason: 'ambiguous_mapping',
              review_status: 'open',
              summary:
                'Multiple canonical card entities matched "blaster dark".',
              context_payload: {
                normalizationStatus: 'ambiguous',
                normalizedName: 'blaster dark',
              },
              candidate_card_entity_ids: ['entity-1', 'entity-2'],
              proposed_card_entity_id: null,
              resolution_kind: null,
              resolved_card_entity_id: null,
              decision_notes: null,
              opened_at: '2026-04-09T12:00:00.000Z',
              started_review_at: null,
              resolved_at: null,
              closed_at: null,
              updated_at: '2026-04-09T12:00:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('manual_review_items')
          expect(query.operation).toBe('upsert')
          expect(query.onConflict).toBe('normalization_result_id')
          expect(query.values).toEqual([
            {
              import_job_id: 'job-1',
              normalization_result_id: 'normalization-1',
              raw_card_printing_record_id: 'raw-printing-1',
              raw_product_record_id: 'raw-product-1',
              review_reason: 'ambiguous_mapping',
              review_status: 'open',
              summary:
                'Multiple canonical card entities matched "blaster dark".',
              context_payload: {
                normalizationStatus: 'ambiguous',
                normalizedName: 'blaster dark',
              },
              candidate_card_entity_ids: ['entity-1', 'entity-2'],
              proposed_card_entity_id: null,
              resolution_kind: null,
              resolved_card_entity_id: null,
              decision_notes: null,
              opened_at: '2026-04-09T12:00:00.000Z',
              started_review_at: null,
              resolved_at: null,
              closed_at: null,
              updated_at: '2026-04-09T12:05:00.000Z',
            },
          ])
        },
        response: {
          data: [
            {
              id: 'review-1',
              import_job_id: 'job-1',
              normalization_result_id: 'normalization-1',
              raw_card_printing_record_id: 'raw-printing-1',
              raw_product_record_id: 'raw-product-1',
              review_reason: 'ambiguous_mapping',
              review_status: 'open',
              summary:
                'Multiple canonical card entities matched "blaster dark".',
              context_payload: {
                normalizationStatus: 'ambiguous',
                normalizedName: 'blaster dark',
              },
              candidate_card_entity_ids: ['entity-1', 'entity-2'],
              proposed_card_entity_id: null,
              resolution_kind: null,
              resolved_card_entity_id: null,
              decision_notes: null,
              opened_at: '2026-04-09T12:00:00.000Z',
              started_review_at: null,
              resolved_at: null,
              closed_at: null,
              updated_at: '2026-04-09T12:05:00.000Z',
            },
          ],
          error: null,
        },
      },
      {
        assert(query) {
          expect(query.schema).toBe('importer')
          expect(query.table).toBe('manual_review_items')
          expect(query.operation).toBe('update')
          expect(query.filters).toEqual([
            {
              type: 'eq',
              column: 'id',
              value: 'review-1',
            },
          ])
        },
        response: {
          data: {
            id: 'review-1',
            import_job_id: 'job-1',
            normalization_result_id: 'normalization-1',
            raw_card_printing_record_id: 'raw-printing-1',
            raw_product_record_id: 'raw-product-1',
            review_reason: 'ambiguous_mapping',
            review_status: 'resolved',
            summary: 'Multiple canonical card entities matched "blaster dark".',
            context_payload: {
              normalizationStatus: 'ambiguous',
              normalizedName: 'blaster dark',
            },
            candidate_card_entity_ids: ['entity-1', 'entity-2'],
            proposed_card_entity_id: null,
            resolution_kind: 'select_candidate_match',
            resolved_card_entity_id: 'entity-2',
            decision_notes: 'Use the later canonical mapping.',
            opened_at: '2026-04-09T12:00:00.000Z',
            started_review_at: '2026-04-09T12:10:00.000Z',
            resolved_at: '2026-04-09T12:15:00.000Z',
            closed_at: '2026-04-09T12:15:00.000Z',
            updated_at: '2026-04-09T12:15:00.000Z',
          },
          error: null,
        },
      },
    ])

    cleanups.push(mock.assertConsumed)

    const repository = createImporterRepository(mock.client)
    const listResult = await repository.listManualReviewItemsByJob('job-1', [
      'open',
    ])
    const upsertResult = await repository.upsertManualReviewItems([
      {
        importJobId: 'job-1',
        normalizationResultId: 'normalization-1',
        rawCardPrintingRecordId: 'raw-printing-1',
        rawProductRecordId: 'raw-product-1',
        reviewReason: 'ambiguous_mapping',
        reviewStatus: 'open',
        summary: 'Multiple canonical card entities matched "blaster dark".',
        contextPayload: {
          normalizationStatus: 'ambiguous',
          normalizedName: 'blaster dark',
        },
        candidateCardEntityIds: ['entity-1', 'entity-2'],
        proposedCardEntityId: null,
        resolutionKind: null,
        resolvedCardEntityId: null,
        decisionNotes: null,
        openedAt: '2026-04-09T12:00:00.000Z',
        startedReviewAt: null,
        resolvedAt: null,
        closedAt: null,
        updatedAt: '2026-04-09T12:05:00.000Z',
      },
    ])
    const updateResult = await repository.updateManualReviewItemStatus({
      id: 'review-1',
      reviewStatus: 'resolved',
      resolutionKind: 'select_candidate_match',
      resolvedCardEntityId: 'entity-2',
      decisionNotes: 'Use the later canonical mapping.',
      startedReviewAt: '2026-04-09T12:10:00.000Z',
      resolvedAt: '2026-04-09T12:15:00.000Z',
      closedAt: '2026-04-09T12:15:00.000Z',
    })

    expect(listResult.ok).toBe(true)
    expect(upsertResult.ok).toBe(true)
    expect(updateResult.ok).toBe(true)
  })
})

function expectQueryValuesObject(values: unknown): Record<string, unknown> {
  if (!values || Array.isArray(values) || typeof values !== 'object') {
    throw new Error('Expected mock query values to be a plain object.')
  }

  return values as Record<string, unknown>
}
