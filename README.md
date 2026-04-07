# Web_VG

Early-stage monorepo for a Cardfight!! Vanguard web client / companion platform.

The repository foundation is ready: monorepo tooling, a Next.js frontend shell, UI baseline, and code-quality tooling. Product features are still largely unimplemented.

## Prerequisites

- Node.js `20.9+`
- Corepack enabled, or `pnpm 10.x` installed globally
- Git

If you do not have `pnpm` installed globally, use `corepack pnpm ...` in the commands below.

## Install

```bash
git clone <repo-url>
cd Web_VG
corepack enable
corepack pnpm install
```

## Run Locally

Start the current web app shell:

```bash
corepack pnpm --filter @web-vg/web dev
```

Open `http://localhost:3000`.

## Common Commands

```bash
# Start the web app
corepack pnpm --filter @web-vg/web dev

# Build the web app
corepack pnpm --filter @web-vg/web build

# Run repo-wide linting
corepack pnpm lint

# Run repo-wide type checking
corepack pnpm typecheck

# Format the repo
corepack pnpm format

# Check formatting without writing changes
corepack pnpm format:check

# Run package unit tests
corepack pnpm test:unit

# Run web component tests
corepack pnpm test:web

# Run the default fast test suite
corepack pnpm test

# Run Playwright e2e
corepack pnpm test:e2e
```

## Repository Layout

- `apps/web` - Next.js frontend app
- `packages/*` - domain and infrastructure packages
- `docs/` - product, engineering, and architecture documents

Current package set:

- `packages/ui`
- `packages/db`
- `packages/shared`
- `packages/catalog`
- `packages/decks`
- `packages/importer`
- `packages/legality`
- `packages/rules-core`
- `packages/social`

Import boundaries are lint-enforced:

- import workspace packages only through their root API, for example `@web-vg/catalog`
- do not deep import through another package's `src/*`
- package-to-package dependencies must follow the bounded-context rules in the repo

## Commit Quality

Pre-commit uses Husky + lint-staged. On staged files, it runs:

- Prettier
- ESLint with autofix

Full repo-wide checks such as build, test, and typecheck are not part of pre-commit.

## Test Baseline

Current test setup:

- Vitest for package unit tests
- Vitest + React Testing Library for `apps/web`
- Playwright for e2e foundation

This is an infrastructure baseline only. The project is not broadly covered by tests yet.

## Current Status

This README reflects the current repository state, not the final product.

Available now:

- monorepo/workspace foundation
- `apps/web` app shell
- Tailwind + shadcn/ui baseline
- linting, formatting, typecheck, and pre-commit checks

Not implemented yet:

- catalog features
- deck builder flows
- legality features
- gameplay features
- auth and social product flows
