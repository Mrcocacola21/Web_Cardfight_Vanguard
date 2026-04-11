import { describe, expect, it } from 'vitest'

import * as entry from './index'

describe('@web-vg/importer', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(entry.createRawProductImporter).toBeTypeOf('function')
    expect(entry.createRawCardPrintingImporter).toBeTypeOf('function')
    expect(entry.createCardPrintingNormalizer).toBeTypeOf('function')
    expect(entry.createManualReviewQueue).toBeTypeOf('function')
    expect(entry.createDevJsonImportRunner).toBeTypeOf('function')
    expect(entry.readDevJsonImportDocumentFromFile).toBeTypeOf('function')
  })
})
