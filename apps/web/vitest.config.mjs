import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
      '@web-vg/catalog': path.resolve(
        rootDir,
        '../../packages/catalog/src/index.ts',
      ),
      '@web-vg/db/repositories': path.resolve(
        rootDir,
        '../../packages/db/src/repositories/index.ts',
      ),
      '@web-vg/db/repositories/catalog': path.resolve(
        rootDir,
        '../../packages/db/src/repositories/catalog/index.ts',
      ),
      '@web-vg/db/repositories/decks': path.resolve(
        rootDir,
        '../../packages/db/src/repositories/decks/index.ts',
      ),
      '@web-vg/db/repositories/importer': path.resolve(
        rootDir,
        '../../packages/db/src/repositories/importer/index.ts',
      ),
      '@web-vg/db/repositories/profiles': path.resolve(
        rootDir,
        '../../packages/db/src/repositories/profiles/index.ts',
      ),
      '@web-vg/db/repositories/social': path.resolve(
        rootDir,
        '../../packages/db/src/repositories/social/index.ts',
      ),
      '@web-vg/db': path.resolve(rootDir, '../../packages/db/src/index.ts'),
      '@web-vg/deck-validation': path.resolve(
        rootDir,
        '../../packages/deck-validation/src/index.ts',
      ),
      '@web-vg/decks': path.resolve(
        rootDir,
        '../../packages/decks/src/index.ts',
      ),
      '@web-vg/legality': path.resolve(
        rootDir,
        '../../packages/legality/src/index.ts',
      ),
      '@web-vg/match-session': path.resolve(
        rootDir,
        '../../packages/match-session/src/index.ts',
      ),
      '@web-vg/rules-core': path.resolve(
        rootDir,
        '../../packages/rules-core/src/index.ts',
      ),
      '@web-vg/shared': path.resolve(
        rootDir,
        '../../packages/shared/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
