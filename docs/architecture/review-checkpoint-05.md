# Review Checkpoint 05

## Executive Summary

The repository foundation is in a clean and implementation-ready state after a small but important cleanup pass.

The monorepo structure is coherent, package naming is consistent, core code-quality tooling is active, and the current application shell builds and type-checks successfully. The main issues found in this checkpoint were not domain-model problems; they were repository hygiene and developer-experience issues left over from foundation setup.

After cleanup, the repo is ready for the next phase of development.

Verified in this step:

- root lint passes;
- root typecheck passes;
- root format check passes;
- root build now completes successfully for the current web app.

## What Is Clean and Solid

- The `apps/` and `packages/` split is clear and matches the intended architecture.
- Package naming is consistent under the `@web-vg/*` scope.
- `apps/web` remains a composition layer and does not currently pull domain logic into React.
- The current UI foundation placement is appropriate for the project stage: generated shadcn/ui components stay app-local instead of forcing premature extraction into `packages/ui`.
- ESLint, Prettier, strict TypeScript, Husky, and lint-staged are configured consistently at the repo level.
- Package manifests are lightweight and aligned with the current scaffold stage.
- The repo README is short, honest, and usable for developer onboarding.

## Issues Found

### Critical

- None.

### Moderate

- Issue: root `dev` and `build` scripts were wired through Turbo in a way that failed in the current Corepack-driven environment.
  Why it matters: the main top-level workflow advertised by the repo was not reliable, which is a real DX problem before active development starts.

- Issue: root `test` existed even though no package-level tests exist yet.
  Why it matters: it gave a false impression that a meaningful repo-level test baseline already existed.

### Minor

- Issue: a stray `--help` directory existed at the repo root.
  Why it matters: it was a setup artifact and made the repo look dirtier than it was.

- Issue: generated build artifacts were left in the workspace during review (`.next`, `.turbo`, `tsconfig.tsbuildinfo`).
  Why it matters: they are ignored correctly, but keeping them around after setup noise makes review and navigation less clean.

- Issue: `apps/web` typecheck wrote `tsconfig.tsbuildinfo` on every run.
  Why it matters: a routine quality command should not dirty the working tree unless there is a deliberate reason.

- Issue: `apps/web/next-env.d.ts` was not formatted, so `format:check` failed.
  Why it matters: quality commands must pass cleanly before feature work begins.

## What Was Fixed in This Step

- Removed the stray repo-root `--help` directory.
- Removed generated local artifacts from the working tree:
  - `apps/web/.next`
  - `.turbo`
  - `apps/web/tsconfig.tsbuildinfo`
- Changed `apps/web` typecheck to run without incremental artifact output.
- Changed root `dev` to the current honest command path:
  - `corepack pnpm --filter @web-vg/web dev`
- Changed root `build` to the current honest command path:
  - `corepack pnpm --filter @web-vg/web build`
- Removed the misleading root `test` script.
- Removed the unused `test` task from `turbo.json`.
- Formatted `apps/web/next-env.d.ts` so repo-wide Prettier checks pass.

## Remaining Risks

- Package-boundary enforcement is still policy-driven rather than mechanically enforced. There is no import-boundary lint rule yet to stop future cross-context leakage automatically.
- `packages/shared` is still safe by convention rather than by hard technical guardrails. That is acceptable now, but it must stay narrow as real code arrives.
- Turbo remains installed and configured, but it is not currently the default execution path for top-level `dev` and `build`. If the repo grows into multi-package build workflows, orchestration should be revisited deliberately instead of growing ad hoc.

## Verdict

`GO`

The repository is clean enough, honest enough, and stable enough to move into active development. No blocking structural or tooling issue remains after this cleanup pass.
