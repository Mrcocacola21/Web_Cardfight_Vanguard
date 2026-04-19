import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { expectTypeOf } from 'vitest'

import type { TablesInsert } from '../index'
import type { CardId, CardPrintingId, DeckEntry } from '@web-vg/shared'

type HasKey<TValue, TKey extends PropertyKey> = TKey extends keyof TValue
  ? true
  : false

type DeckCardInsert = TablesInsert<{ schema: 'user_data' }, 'deck_cards'>
type CollectionItemInsert = TablesInsert<
  { schema: 'user_data' },
  'collection_items'
>

describe('domain boundaries', () => {
  it('keeps deck composition canonical-card based instead of printing based', () => {
    expectTypeOf<DeckEntry['cardId']>().toEqualTypeOf<CardId>()
    expectTypeOf<HasKey<DeckEntry, 'printingId'>>().toEqualTypeOf<false>()
    expectTypeOf<DeckCardInsert['card_entity_id']>().toEqualTypeOf<string>()
    expectTypeOf<
      HasKey<DeckCardInsert, 'card_printing_id'>
    >().toEqualTypeOf<false>()
  })

  it('keeps collection persistence printing-based instead of canonical-card based', () => {
    expectTypeOf<CardPrintingId>().toMatchTypeOf<string>()
    expectTypeOf<
      CollectionItemInsert['card_printing_id']
    >().toEqualTypeOf<string>()
    expectTypeOf<
      HasKey<CollectionItemInsert, 'card_entity_id'>
    >().toEqualTypeOf<false>()
  })

  it('keeps importer writes out of catalog write paths', () => {
    const importerRepositorySource = readFileSync(
      new URL('./importer/importer.repository.ts', import.meta.url),
      'utf8',
    )
    const catalogSnippets =
      importerRepositorySource.match(
        /client\s*\.\s*schema\('catalog'\)[\s\S]{0,400}?/g,
      ) ?? []

    expect(catalogSnippets.length).toBeGreaterThan(0)

    for (const snippet of catalogSnippets) {
      expect(snippet).not.toMatch(/\.(insert|update|upsert|delete)\(/)
    }
  })

  it('keeps catalog read-side flows out of importer workflow tables', () => {
    const catalogRepositorySource = readFileSync(
      new URL('./catalog/catalog.repository.ts', import.meta.url),
      'utf8',
    )

    expect(catalogRepositorySource).not.toContain(".schema('importer')")
  })

  it('keeps user-facing web code out of importer and publication-write entrypoints', () => {
    const webCatalogReadSource = readFileSync(
      new URL(
        '../../../../apps/web/src/features/catalog/server/catalog-read.ts',
        import.meta.url,
      ),
      'utf8',
    )
    const webDeckReadSource = readFileSync(
      new URL(
        '../../../../apps/web/src/features/decks/server/deck-read.ts',
        import.meta.url,
      ),
      'utf8',
    )
    const webProductReadSource = readFileSync(
      new URL(
        '../../../../apps/web/src/features/catalog/server/catalog-product-read.ts',
        import.meta.url,
      ),
      'utf8',
    )

    for (const source of [
      webCatalogReadSource,
      webDeckReadSource,
      webProductReadSource,
    ]) {
      expect(source).not.toContain('@web-vg/importer')
      expect(source).not.toContain('createImporterRepository')
      expect(source).not.toContain('createCatalogPublicationRepository')
    }
  })

  it('keeps publication as the only catalog write bridge in db repositories', () => {
    const catalogPublicationRepositorySource = readFileSync(
      new URL('./catalog/catalog.publication.repository.ts', import.meta.url),
      'utf8',
    )

    expect(catalogPublicationRepositorySource).toMatch(
      /\.schema\('catalog'\)[\s\S]{0,400}?\.(insert|upsert|update)\(/,
    )

    const repositoryFiles = [
      './catalog/catalog.repository.ts',
      './importer/importer.repository.ts',
      './decks/decks.repository.ts',
      './matches/matches.repository.ts',
      './profiles/profiles.repository.ts',
      './social/social.repository.ts',
    ]

    for (const relativePath of repositoryFiles) {
      const source = readFileSync(
        new URL(relativePath, import.meta.url),
        'utf8',
      )

      expect(source).not.toMatch(
        /\.schema\('catalog'\)[\s\S]{0,400}?\.(insert|upsert|update|delete)\(/,
      )
    }
  })

  it('keeps user-facing match history persistence out of gameplay runtime tables', () => {
    const matchesRepositorySource = readFileSync(
      new URL('./matches/matches.repository.ts', import.meta.url),
      'utf8',
    )

    expect(matchesRepositorySource).toContain(".schema('social')")
    expect(matchesRepositorySource).not.toContain(".schema('gameplay')")
  })
})
