import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const publicWorkspaceImportPatterns = [
  {
    group: [
      '@web-vg/*/*',
      '!@web-vg/db/repositories',
      '!@web-vg/db/repositories/*',
    ],
    message:
      'Import workspace packages only through their public root entrypoint, except documented @web-vg/db repository subpaths.',
  },
  {
    group: ['../**/src', '../**/src/**'],
    message:
      'Do not import another workspace package through its src tree or a relative cross-package path.',
  },
]

function restrictWorkspaceImports(disallowedPackages, options = {}) {
  const extraPaths = options.extraPaths ?? []
  const extraPatterns = options.extraPatterns ?? []

  return [
    'error',
    {
      paths: [
        ...disallowedPackages.map((name) => ({
          name,
          message: `Package boundary violation: ${name} is not an allowed dependency here.`,
        })),
        ...extraPaths,
      ],
      patterns: [
        ...disallowedPackages.map((name) => ({
          group: [`${name}/*`],
          message: `Package boundary violation: ${name} subpaths are not an allowed dependency here.`,
        })),
        ...publicWorkspaceImportPatterns,
        ...extraPatterns,
      ],
    },
  ]
}

const tsTypeCheckedConfig = tseslint.configs.recommendedTypeChecked.map(
  (config) => ({
    ...config,
    files: ['**/*.{ts,tsx,mts,cts}'],
  }),
)

const nextAppConfig = nextVitals.map((config) => ({
  ...config,
  basePath: 'apps/web',
  settings: {
    ...config.settings,
    next: {
      ...(config.settings?.next ?? {}),
      rootDir: 'apps/web',
    },
  },
}))

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/*.tsbuildinfo',
    'pnpm-lock.yaml',
  ]),
  js.configs.recommended,
  ...tsTypeCheckedConfig,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['playwright.config.ts', 'tests/e2e/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['scripts/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  ...nextAppConfig,
  {
    files: ['apps/web/**/*.{ts,tsx,js,jsx}'],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
      'no-restricted-imports': restrictWorkspaceImports(
        ['@web-vg/importer', '@web-vg/web'],
        {
          extraPaths: [
            {
              name: '@web-vg/rules-core',
              importNames: [
                'ActionTransitionInput',
                'AppliedTransitionResult',
                'advanceGameStateRevision',
                'applyGameAction',
                'applyGameChoiceResponse',
                'assertActionSubmissionRevision',
                'assertChoiceResponseMatchesRequest',
                'assertChoiceResponseSubmissionRevision',
                'assertGameChoiceRequestInvariant',
                'assertGameChoiceResponseInvariant',
                'assertGameStateInvariant',
                'assertPlayerStateInvariant',
                'assertRulesInvariant',
                'assertZoneStateInvariant',
                'BlockedTransitionResult',
                'createBlockedTransitionResult',
                'createEngineDispatchResult',
                'createInvalidTransitionResult',
                'createTransitionResult',
                'ChoiceResponseTransitionInput',
                'InvalidTransitionResult',
                'isAppliedTransitionResult',
                'isBlockedTransitionResult',
                'isInvalidTransitionResult',
                'reduceGameState',
                'RulesCoreError',
                'RulesInvariantError',
                'StateTransition',
                'TransitionInput',
                'TransitionResult',
                'TransitionResultStatus',
              ],
              message:
                'UI must use the rules-engine boundary facade (`dispatchEngineCommand` or `rulesEngineBoundary`) instead of reducer and invariant internals.',
            },
          ],
        },
      ),
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value='@web-vg/rules-core'] > ImportNamespaceSpecifier",
          message:
            'UI must not namespace-import @web-vg/rules-core; use explicit boundary and domain named imports so reducer internals stay restricted.',
        },
      ],
    },
  },
  {
    files: ['packages/shared/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports([
        '@web-vg/catalog',
        '@web-vg/db',
        '@web-vg/decks',
        '@web-vg/importer',
        '@web-vg/legality',
        '@web-vg/rules-core',
        '@web-vg/social',
        '@web-vg/ui',
        '@web-vg/web',
      ]),
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports([
        '@web-vg/catalog',
        '@web-vg/db',
        '@web-vg/decks',
        '@web-vg/importer',
        '@web-vg/legality',
        '@web-vg/rules-core',
        '@web-vg/social',
        '@web-vg/ui',
        '@web-vg/web',
      ]),
    },
  },
  {
    files: ['packages/catalog/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports([
        '@web-vg/db',
        '@web-vg/decks',
        '@web-vg/importer',
        '@web-vg/legality',
        '@web-vg/rules-core',
        '@web-vg/social',
        '@web-vg/ui',
        '@web-vg/web',
      ]),
    },
  },
  {
    files: ['packages/decks/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports([
        '@web-vg/db',
        '@web-vg/importer',
        '@web-vg/legality',
        '@web-vg/rules-core',
        '@web-vg/social',
        '@web-vg/ui',
        '@web-vg/web',
      ]),
    },
  },
  {
    files: ['packages/importer/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports([
        '@web-vg/decks',
        '@web-vg/legality',
        '@web-vg/rules-core',
        '@web-vg/social',
        '@web-vg/ui',
        '@web-vg/web',
      ]),
    },
  },
  {
    files: ['packages/legality/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports([
        '@web-vg/db',
        '@web-vg/decks',
        '@web-vg/importer',
        '@web-vg/rules-core',
        '@web-vg/social',
        '@web-vg/ui',
        '@web-vg/web',
      ]),
    },
  },
  {
    files: ['packages/rules-core/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports(
        [
          '@web-vg/catalog',
          '@web-vg/db',
          '@web-vg/decks',
          '@web-vg/importer',
          '@web-vg/legality',
          '@web-vg/social',
          '@web-vg/ui',
          '@web-vg/web',
        ],
        {
          extraPaths: [
            {
              name: 'next',
              message:
                'Package boundary violation: rules-core must stay framework-agnostic and cannot depend on Next.js.',
            },
            {
              name: 'react',
              message:
                'Package boundary violation: rules-core must stay framework-agnostic and cannot depend on React.',
            },
            {
              name: 'react-dom',
              message:
                'Package boundary violation: rules-core must stay framework-agnostic and cannot depend on React DOM.',
            },
            {
              name: 'server-only',
              message:
                'Package boundary violation: rules-core cannot depend on server-only runtime markers.',
            },
            {
              name: 'client-only',
              message:
                'Package boundary violation: rules-core cannot depend on client-only runtime markers.',
            },
          ],
          extraPatterns: [
            {
              group: ['next/*'],
              message:
                'Package boundary violation: rules-core must stay framework-agnostic and cannot depend on Next.js.',
            },
            {
              group: ['react/*', 'react-dom/*'],
              message:
                'Package boundary violation: rules-core must stay framework-agnostic and cannot depend on React runtime modules.',
            },
            {
              group: ['@supabase/*'],
              message:
                'Package boundary violation: rules-core must stay persistence-free and cannot depend on Supabase.',
            },
          ],
        },
      ),
    },
  },
  {
    files: ['packages/social/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports([
        '@web-vg/catalog',
        '@web-vg/db',
        '@web-vg/decks',
        '@web-vg/importer',
        '@web-vg/legality',
        '@web-vg/rules-core',
        '@web-vg/ui',
        '@web-vg/web',
      ]),
    },
  },
  {
    files: ['packages/db/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': restrictWorkspaceImports([
        '@web-vg/catalog',
        '@web-vg/db',
        '@web-vg/decks',
        '@web-vg/importer',
        '@web-vg/legality',
        '@web-vg/rules-core',
        '@web-vg/social',
        '@web-vg/ui',
        '@web-vg/web',
      ]),
    },
  },
  prettier,
])
