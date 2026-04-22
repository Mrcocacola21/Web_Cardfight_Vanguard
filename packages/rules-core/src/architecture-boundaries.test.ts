import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

function collectNonTestSourceFiles(directoryPath: string): readonly string[] {
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap(
    (entry) => {
      const entryPath = path.join(directoryPath, entry.name)

      if (entry.isDirectory()) {
        return collectNonTestSourceFiles(entryPath)
      }

      if (!entry.isFile() || !entry.name.endsWith('.ts')) {
        return []
      }

      if (entry.name.endsWith('.test.ts')) {
        return []
      }

      return [entryPath]
    },
  )
}

function collectImportSpecifiers(source: string): readonly string[] {
  const fromImports = Array.from(
    source.matchAll(/from\s+['"]([^'"]+)['"]/g),
    (match) => match[1] ?? '',
  )
  const sideEffectImports = Array.from(
    source.matchAll(/import\s+['"]([^'"]+)['"]/g),
    (match) => match[1] ?? '',
  )

  return [...fromImports, ...sideEffectImports]
}

describe('@web-vg/rules-core architecture boundaries', () => {
  it('keeps package metadata scoped to a single public entrypoint and shared contracts only', () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>
      exports?: Record<string, string>
    }

    expect(Object.keys(packageJson.dependencies ?? {}).sort()).toEqual([
      '@web-vg/shared',
    ])
    expect(packageJson.exports).toEqual({
      '.': './src/index.ts',
    })
  })

  it('keeps source files free from framework and infrastructure imports', () => {
    const sourceFiles = collectNonTestSourceFiles(path.join(packageRoot, 'src'))

    expect(sourceFiles.length).toBeGreaterThan(0)

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, 'utf8')

      expect(source).not.toContain("'use client'")
      expect(source).not.toContain('"use client"')
      expect(source).not.toContain("'use server'")
      expect(source).not.toContain('"use server"')

      for (const specifier of collectImportSpecifiers(source)) {
        expect(
          specifier === '@web-vg/shared' || specifier.startsWith('.'),
        ).toBe(true)
      }
    }
  })
})
