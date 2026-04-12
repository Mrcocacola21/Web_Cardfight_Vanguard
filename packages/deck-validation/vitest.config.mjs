import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const packageRoot = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(packageRoot, '../..')

export default defineConfig({
  resolve: {
    alias: {
      '@web-vg/decks': path.resolve(repoRoot, 'packages/decks/src/index.ts'),
      '@web-vg/shared': path.resolve(repoRoot, 'packages/shared/src/index.ts'),
    },
  },
})
