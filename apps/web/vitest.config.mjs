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
      '@web-vg/db': path.resolve(rootDir, '../../packages/db/src/index.ts'),
      '@web-vg/decks': path.resolve(
        rootDir,
        '../../packages/decks/src/index.ts',
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
