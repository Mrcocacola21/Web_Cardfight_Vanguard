import type { DbClient } from '@web-vg/db'

import type { StandardSliceQaCatalogBootstrapRepository } from '@/features/decks/application/standard-slice-qa-bootstrap-use-cases'
import {
  listStandardSliceQaCardPrintings,
  listStandardSliceQaCatalogCards,
  STANDARD_SLICE_QA_PRODUCT,
} from '@/features/decks/standard-slice-qa-decks'

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

export function createStandardSliceQaCatalogRepository(
  client: DbClient,
): StandardSliceQaCatalogBootstrapRepository {
  return {
    async ensureStandardSliceQaCatalog(): Promise<RepositoryResult<void>> {
      const productResult = await client
        .schema('catalog')
        .from('products')
        .upsert(
          {
            id: STANDARD_SLICE_QA_PRODUCT.id,
            canonical_key: STANDARD_SLICE_QA_PRODUCT.canonicalKey,
            family_id: STANDARD_SLICE_QA_PRODUCT.familyId,
            official_code: STANDARD_SLICE_QA_PRODUCT.officialCode,
            name: STANDARD_SLICE_QA_PRODUCT.name,
            product_category: STANDARD_SLICE_QA_PRODUCT.productCategory,
            product_kind: STANDARD_SLICE_QA_PRODUCT.productKind,
            release_date: STANDARD_SLICE_QA_PRODUCT.releaseDate,
            region_code: STANDARD_SLICE_QA_PRODUCT.regionCode,
            cycle_key: STANDARD_SLICE_QA_PRODUCT.cycleKey,
          },
          {
            onConflict: 'id',
          },
        )

      if (productResult.error) {
        return repositoryFailure(
          'Failed to upsert the Standard slice QA catalog product.',
          productResult.error.message,
        )
      }

      const cardRows = listStandardSliceQaCatalogCards().map((card) => ({
        id: card.id,
        canonical_key: card.canonicalKey,
        name: card.name,
        normalized_name: card.normalizedName,
        grade: card.grade,
        card_type: card.cardType,
        nation: card.nation,
        clan: card.clan,
        race: card.race,
        trigger_type: card.triggerType,
        base_power: card.basePower,
        base_critical: card.baseCritical,
        base_shield: card.baseShield,
        keywords: [...card.keywords],
        effect_refs: [...card.effectRefs],
      }))
      const cardsResult = await client
        .schema('catalog')
        .from('card_entities')
        .upsert(cardRows, {
          onConflict: 'id',
        })

      if (cardsResult.error) {
        return repositoryFailure(
          'Failed to upsert the Standard slice QA card entities.',
          cardsResult.error.message,
        )
      }

      const printingRows = listStandardSliceQaCardPrintings().map(
        (printing) => ({
          id: printing.id,
          printing_key: printing.printingKey,
          card_entity_id: printing.cardEntityId,
          product_id: printing.productId,
          collector_number: printing.collectorNumber,
          rarity: printing.rarity,
          locale_code: printing.localeCode,
          region_code: printing.regionCode,
          printed_name: printing.printedName,
          art_variant: null,
          is_alternate_art: false,
          is_promo_variant: false,
        }),
      )
      const printingsResult = await client
        .schema('catalog')
        .from('card_printings')
        .upsert(printingRows, {
          onConflict: 'id',
        })

      if (printingsResult.error) {
        return repositoryFailure(
          'Failed to upsert the Standard slice QA printings.',
          printingsResult.error.message,
        )
      }

      return {
        ok: true,
        data: undefined,
      }
    },
  }
}

function repositoryFailure(
  prefix: string,
  details: string,
): RepositoryResult<never> {
  return {
    ok: false,
    error: {
      message: `${prefix} ${details}`,
    },
  }
}
