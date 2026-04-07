import { describe, expect, it } from 'vitest'

import * as entry from './index'

describe('@web-vg/importer', () => {
  it('exposes an importable package entrypoint', () => {
    expect(entry).toBeDefined()
    expect(Object.keys(entry)).toEqual([])
  })
})
