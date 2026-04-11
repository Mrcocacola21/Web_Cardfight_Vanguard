import type { Tables } from '../../generated/database.types'

import type { DbClient } from '../shared/client'
import { err, mapQueryError, ok, type RepositoryResult } from '../shared/result'

type RawProductPublicationRow = Pick<
  Tables<{ schema: 'importer' }, 'raw_product_records'>,
  | 'id'
  | 'import_job_id'
  | 'source_product_id'
  | 'raw_name'
  | 'raw_code'
  | 'raw_product_category'
  | 'raw_product_kind'
  | 'raw_release_date_text'
  | 'raw_region_code'
>

type RawCardPrintingPublicationRow = Pick<
  Tables<{ schema: 'importer' }, 'raw_card_printing_records'>,
  | 'id'
  | 'import_job_id'
  | 'source_printing_id'
  | 'raw_product_record_id'
  | 'raw_card_name'
  | 'raw_printing_code'
  | 'raw_rarity'
  | 'raw_locale_code'
  | 'raw_region_code'
>

type NormalizationPublicationRow = Pick<
  Tables<{ schema: 'importer' }, 'card_printing_normalization_results'>,
  | 'id'
  | 'import_job_id'
  | 'raw_card_printing_record_id'
  | 'raw_product_record_id'
  | 'normalization_status'
  | 'proposed_card_entity_id'
>

type CatalogProductPublicationRow = Pick<
  Tables<{ schema: 'catalog' }, 'products'>,
  | 'id'
  | 'canonical_key'
  | 'family_id'
  | 'official_code'
  | 'name'
  | 'region_code'
  | 'source_import_job_id'
  | 'source_raw_product_record_id'
>

type CatalogCardPrintingPublicationRow = Pick<
  Tables<{ schema: 'catalog' }, 'card_printings'>,
  | 'id'
  | 'printing_key'
  | 'card_entity_id'
  | 'product_id'
  | 'source_normalization_result_id'
  | 'source_raw_card_printing_record_id'
>

export interface CatalogPublicationRawProductSourceRecord {
  readonly rawProductId: string
  readonly importJobId: string
  readonly sourceProductId: string
  readonly rawName: string
  readonly rawCode: string | null
  readonly rawProductCategory: string | null
  readonly rawProductKind: string | null
  readonly rawReleaseDateText: string | null
  readonly rawRegionCode: string | null
}

export interface CatalogPrintingPublicationSourceRecord {
  readonly importJobId: string
  readonly normalizationResultId: string
  readonly rawCardPrintingId: string
  readonly rawProductId: string | null
  readonly normalizationStatus:
    | 'auto_resolved'
    | 'unresolved'
    | 'ambiguous'
    | 'blocked_for_review'
    | 'superseded'
  readonly cardEntityId: string | null
  readonly sourcePrintingId: string
  readonly rawCardName: string
  readonly rawPrintingCode: string | null
  readonly rawRarity: string | null
  readonly rawLocaleCode: string | null
  readonly rawRegionCode: string | null
  readonly rawProduct: CatalogPublicationRawProductSourceRecord | null
}

export interface CatalogPublishedProductRecord {
  readonly id: string
  readonly canonicalKey: string
  readonly familyId: string
  readonly officialCode: string
  readonly name: string
  readonly regionCode: string | null
  readonly sourceImportJobId: string | null
  readonly sourceRawProductRecordId: string | null
}

export interface CatalogPublishedPrintingRecord {
  readonly id: string
  readonly printingKey: string
  readonly cardEntityId: string
  readonly productId: string
  readonly sourceNormalizationResultId: string | null
  readonly sourceRawCardPrintingRecordId: string | null
}

export interface CatalogProductIdentityLookup {
  readonly familyId: string
  readonly officialCode: string
  readonly regionCode: string | null
}

export interface UpsertCatalogPublishedProductInput {
  readonly id: string
  readonly canonicalKey: string
  readonly familyId: string
  readonly officialCode: string
  readonly name: string
  readonly productCategory: string
  readonly productKind: string
  readonly releaseDate: string
  readonly regionCode: string | null
  readonly cycleKey: string | null
  readonly sourceImportJobId: string
  readonly sourceRawProductRecordId: string
}

export interface UpsertCatalogPublishedPrintingInput {
  readonly id: string
  readonly printingKey: string
  readonly cardEntityId: string
  readonly productId: string
  readonly collectorNumber: string
  readonly rarity: string
  readonly localeCode: string
  readonly regionCode: string | null
  readonly printedName: string | null
  readonly artVariant: string | null
  readonly isAlternateArt: boolean
  readonly isPromoVariant: boolean
  readonly sourceImportJobId: string
  readonly sourceNormalizationResultId: string
  readonly sourceRawCardPrintingRecordId: string
  readonly sourceRawProductRecordId: string | null
}

export interface CatalogPublicationRepository {
  listRawProductsByImportJob(
    importJobId: string,
  ): Promise<
    RepositoryResult<readonly CatalogPublicationRawProductSourceRecord[]>
  >
  listPrintingPublicationSourcesByImportJob(input: {
    readonly importJobId: string
    readonly normalizationResultIds?: readonly string[]
  }): Promise<
    RepositoryResult<readonly CatalogPrintingPublicationSourceRecord[]>
  >
  listCatalogProductsByIdentity(
    identities: readonly CatalogProductIdentityLookup[],
  ): Promise<RepositoryResult<readonly CatalogPublishedProductRecord[]>>
  listCatalogPrintingsByKeys(
    printingKeys: readonly string[],
  ): Promise<RepositoryResult<readonly CatalogPublishedPrintingRecord[]>>
  upsertCatalogProducts(
    input: readonly UpsertCatalogPublishedProductInput[],
  ): Promise<RepositoryResult<readonly CatalogPublishedProductRecord[]>>
  upsertCatalogPrintings(
    input: readonly UpsertCatalogPublishedPrintingInput[],
  ): Promise<RepositoryResult<readonly CatalogPublishedPrintingRecord[]>>
}

const rawProductPublicationSelect =
  'id, import_job_id, source_product_id, raw_name, raw_code, raw_product_category, raw_product_kind, raw_release_date_text, raw_region_code'
const rawCardPrintingPublicationSelect =
  'id, import_job_id, source_printing_id, raw_product_record_id, raw_card_name, raw_printing_code, raw_rarity, raw_locale_code, raw_region_code'
const normalizationPublicationSelect =
  'id, import_job_id, raw_card_printing_record_id, raw_product_record_id, normalization_status, proposed_card_entity_id'
const catalogProductPublicationSelect =
  'id, canonical_key, family_id, official_code, name, region_code, source_import_job_id, source_raw_product_record_id'
const catalogCardPrintingPublicationSelect =
  'id, printing_key, card_entity_id, product_id, source_normalization_result_id, source_raw_card_printing_record_id'

export function createCatalogPublicationRepository(
  client: DbClient,
): CatalogPublicationRepository {
  return {
    async listRawProductsByImportJob(importJobId) {
      const { data, error } = await client
        .schema('importer')
        .from('raw_product_records')
        .select(rawProductPublicationSelect)
        .eq('import_job_id', importJobId)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load raw products for catalog publication.',
          ),
        )
      }

      return ok((data ?? []).map(mapRawProductPublicationRow))
    },

    async listPrintingPublicationSourcesByImportJob(input) {
      let normalizationRequest = client
        .schema('importer')
        .from('card_printing_normalization_results')
        .select(normalizationPublicationSelect)
        .eq('import_job_id', input.importJobId)

      if (
        input.normalizationResultIds &&
        input.normalizationResultIds.length > 0
      ) {
        normalizationRequest = normalizationRequest.in(
          'id',
          input.normalizationResultIds,
        )
      }

      const { data: normalizationRows, error: normalizationError } =
        await normalizationRequest

      if (normalizationError) {
        return err(
          mapQueryError(
            normalizationError,
            'Failed to load normalization results for catalog publication.',
          ),
        )
      }

      const mappedNormalizationRows = (normalizationRows ?? []).map(
        mapNormalizationPublicationRow,
      )

      if (mappedNormalizationRows.length === 0) {
        return ok([])
      }

      const rawCardPrintingIds = mappedNormalizationRows.map(
        (row) => row.rawCardPrintingId,
      )
      const { data: rawPrintingRows, error: rawPrintingError } = await client
        .schema('importer')
        .from('raw_card_printing_records')
        .select(rawCardPrintingPublicationSelect)
        .eq('import_job_id', input.importJobId)
        .in('id', rawCardPrintingIds)

      if (rawPrintingError) {
        return err(
          mapQueryError(
            rawPrintingError,
            'Failed to load raw printings for catalog publication.',
          ),
        )
      }

      const rawPrintingsById = new Map(
        (rawPrintingRows ?? [])
          .map(mapRawCardPrintingPublicationRow)
          .map((row) => [row.rawCardPrintingId, row] as const),
      )
      const rawProductIds = Array.from(
        new Set(
          mappedNormalizationRows
            .map((row) => row.rawProductId)
            .filter((value): value is string => value !== null),
        ),
      )

      let rawProductsById = new Map<
        string,
        CatalogPublicationRawProductSourceRecord
      >()

      if (rawProductIds.length > 0) {
        const { data: rawProductRows, error: rawProductError } = await client
          .schema('importer')
          .from('raw_product_records')
          .select(rawProductPublicationSelect)
          .eq('import_job_id', input.importJobId)
          .in('id', rawProductIds)

        if (rawProductError) {
          return err(
            mapQueryError(
              rawProductError,
              'Failed to load raw products for catalog publication.',
            ),
          )
        }

        rawProductsById = new Map(
          (rawProductRows ?? [])
            .map(mapRawProductPublicationRow)
            .map((row) => [row.rawProductId, row] as const),
        )
      }

      const composedSources: CatalogPrintingPublicationSourceRecord[] = []

      for (const normalizationRow of mappedNormalizationRows) {
        const rawPrinting = rawPrintingsById.get(
          normalizationRow.rawCardPrintingId,
        )

        if (!rawPrinting) {
          return err({
            code: 'query-failed',
            message:
              'Failed to compose publication sources for catalog publication.',
            details: `Normalization result ${normalizationRow.normalizationResultId} references missing raw printing ${normalizationRow.rawCardPrintingId}.`,
          })
        }

        composedSources.push({
          importJobId: normalizationRow.importJobId,
          normalizationResultId: normalizationRow.normalizationResultId,
          rawCardPrintingId: normalizationRow.rawCardPrintingId,
          rawProductId: normalizationRow.rawProductId,
          normalizationStatus: normalizationRow.normalizationStatus,
          cardEntityId: normalizationRow.cardEntityId,
          sourcePrintingId: rawPrinting.sourcePrintingId,
          rawCardName: rawPrinting.rawCardName,
          rawPrintingCode: rawPrinting.rawPrintingCode,
          rawRarity: rawPrinting.rawRarity,
          rawLocaleCode: rawPrinting.rawLocaleCode,
          rawRegionCode: rawPrinting.rawRegionCode,
          rawProduct:
            normalizationRow.rawProductId === null
              ? null
              : (rawProductsById.get(normalizationRow.rawProductId) ?? null),
        })
      }

      return ok(composedSources)
    },

    async listCatalogProductsByIdentity(identities) {
      if (identities.length === 0) {
        return ok([])
      }

      const officialCodes = Array.from(
        new Set(identities.map((identity) => identity.officialCode)),
      )
      const { data, error } = await client
        .schema('catalog')
        .from('products')
        .select(catalogProductPublicationSelect)
        .in('official_code', officialCodes)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load catalog products for publication identity resolution.',
          ),
        )
      }

      const identityKeys = new Set(
        identities.map((identity) => createProductIdentityKey(identity)),
      )

      return ok(
        (data ?? [])
          .map(mapCatalogProductPublicationRow)
          .filter((row) => identityKeys.has(createProductIdentityKey(row))),
      )
    },

    async listCatalogPrintingsByKeys(printingKeys) {
      if (printingKeys.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('catalog')
        .from('card_printings')
        .select(catalogCardPrintingPublicationSelect)
        .in('printing_key', printingKeys)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to load catalog printings for publication identity resolution.',
          ),
        )
      }

      return ok((data ?? []).map(mapCatalogCardPrintingPublicationRow))
    },

    async upsertCatalogProducts(input) {
      if (input.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('catalog')
        .from('products')
        .upsert(
          input.map((product) => ({
            id: product.id,
            canonical_key: product.canonicalKey,
            family_id: product.familyId,
            official_code: product.officialCode,
            name: product.name,
            product_category: product.productCategory,
            product_kind: product.productKind,
            release_date: product.releaseDate,
            region_code: product.regionCode,
            cycle_key: product.cycleKey,
            source_import_job_id: product.sourceImportJobId,
            source_raw_product_record_id: product.sourceRawProductRecordId,
          })),
          {
            onConflict: 'id',
          },
        )
        .select(catalogProductPublicationSelect)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to upsert catalog products for publication.',
          ),
        )
      }

      return ok((data ?? []).map(mapCatalogProductPublicationRow))
    },

    async upsertCatalogPrintings(input) {
      if (input.length === 0) {
        return ok([])
      }

      const { data, error } = await client
        .schema('catalog')
        .from('card_printings')
        .upsert(
          input.map((printing) => ({
            id: printing.id,
            printing_key: printing.printingKey,
            card_entity_id: printing.cardEntityId,
            product_id: printing.productId,
            collector_number: printing.collectorNumber,
            rarity: printing.rarity,
            locale_code: printing.localeCode,
            region_code: printing.regionCode,
            printed_name: printing.printedName,
            art_variant: printing.artVariant,
            is_alternate_art: printing.isAlternateArt,
            is_promo_variant: printing.isPromoVariant,
            source_import_job_id: printing.sourceImportJobId,
            source_normalization_result_id:
              printing.sourceNormalizationResultId,
            source_raw_card_printing_record_id:
              printing.sourceRawCardPrintingRecordId,
            source_raw_product_record_id: printing.sourceRawProductRecordId,
          })),
          {
            onConflict: 'printing_key',
          },
        )
        .select(catalogCardPrintingPublicationSelect)

      if (error) {
        return err(
          mapQueryError(
            error,
            'Failed to upsert catalog card printings for publication.',
          ),
        )
      }

      return ok((data ?? []).map(mapCatalogCardPrintingPublicationRow))
    },
  }
}

function createProductIdentityKey(input: {
  readonly familyId: string
  readonly officialCode: string
  readonly regionCode: string | null
}): string {
  return `${input.familyId}::${input.officialCode.toUpperCase()}::${input.regionCode ?? ''}`
}

function mapRawProductPublicationRow(
  row: RawProductPublicationRow,
): CatalogPublicationRawProductSourceRecord {
  return {
    rawProductId: row.id,
    importJobId: row.import_job_id,
    sourceProductId: row.source_product_id,
    rawName: row.raw_name,
    rawCode: row.raw_code,
    rawProductCategory: row.raw_product_category,
    rawProductKind: row.raw_product_kind,
    rawReleaseDateText: row.raw_release_date_text,
    rawRegionCode: row.raw_region_code,
  }
}

function mapRawCardPrintingPublicationRow(row: RawCardPrintingPublicationRow) {
  return {
    rawCardPrintingId: row.id,
    importJobId: row.import_job_id,
    sourcePrintingId: row.source_printing_id,
    rawProductId: row.raw_product_record_id,
    rawCardName: row.raw_card_name,
    rawPrintingCode: row.raw_printing_code,
    rawRarity: row.raw_rarity,
    rawLocaleCode: row.raw_locale_code,
    rawRegionCode: row.raw_region_code,
  }
}

function mapNormalizationPublicationRow(row: NormalizationPublicationRow) {
  return {
    importJobId: row.import_job_id,
    normalizationResultId: row.id,
    rawCardPrintingId: row.raw_card_printing_record_id,
    rawProductId: row.raw_product_record_id,
    normalizationStatus: row.normalization_status,
    cardEntityId: row.proposed_card_entity_id,
  }
}

function mapCatalogProductPublicationRow(
  row: CatalogProductPublicationRow,
): CatalogPublishedProductRecord {
  return {
    id: row.id,
    canonicalKey: row.canonical_key,
    familyId: row.family_id,
    officialCode: row.official_code,
    name: row.name,
    regionCode: row.region_code,
    sourceImportJobId: row.source_import_job_id,
    sourceRawProductRecordId: row.source_raw_product_record_id,
  }
}

function mapCatalogCardPrintingPublicationRow(
  row: CatalogCardPrintingPublicationRow,
): CatalogPublishedPrintingRecord {
  return {
    id: row.id,
    printingKey: row.printing_key,
    cardEntityId: row.card_entity_id,
    productId: row.product_id,
    sourceNormalizationResultId: row.source_normalization_result_id,
    sourceRawCardPrintingRecordId: row.source_raw_card_printing_record_id,
  }
}
