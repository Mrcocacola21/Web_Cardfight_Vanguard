# Rules-Core Foundation

## 1. Purpose

`packages/rules-core` is the pure domain package reserved for future gameplay and rules execution logic.

## 2. Why rules-core is a separate package

Gameplay rules will grow into a high-complexity domain with its own state model, transition semantics, event flow, and effect resolution. Keeping that logic in a dedicated package prevents the web app, DB layer, and content tooling from becoming accidental owners of game rules.

## 3. What belongs in rules-core

- gameplay state contracts;
- action and request contracts;
- event contracts;
- transition contracts;
- invariant-safe state evolution primitives;
- format-agnostic rules-engine foundations.

## 4. What does NOT belong in rules-core

- Next.js, React, or UI state;
- Supabase, repositories, or persistence logic;
- fetch, transport, or server action wiring;
- importer workflow or publication logic;
- collection, social, or match-history application concerns;
- format adapters and card-specific handlers.

## 5. Package structure

- `src/contracts.ts`: branded identifiers for the rules domain.
- `src/errors.ts`: domain error and invariant helpers.
- `src/state/`: minimal gameplay state contracts.
- `src/actions/`: action and request contracts.
- `src/events/`: event contracts.
- `src/transitions/`: transition contracts and small state-evolution helpers.
- `src/index.ts`: stable public surface.

## 6. Public API surface

The package exports only its root entrypoint. The current public API contains:

- rules-domain identifiers;
- state, action, event, and transition contracts;
- `assertRulesInvariant`;
- `assertActionRequestRevision`;
- `advanceGameStateRevision`;
- `createTransitionResult`.

## 7. Architectural boundaries

`rules-core` depends only on `@web-vg/shared` for safe shared identifiers/contracts. ESLint package-boundary rules and package-local boundary tests protect it from `next/*`, React, Supabase, DB, and other infrastructure imports.

## 8. What is intentionally NOT implemented yet

- executable gameplay rules;
- draw, ride, attack, and effect resolution;
- format adapters;
- card-specific effect handlers;
- persistence or match-room runtime orchestration;
- final detailed `GameState` / `PlayerState` / `ZoneState` modeling.

## 9. Summary

`packages/rules-core` now exists as a first-class monorepo package with a clean public surface, explicit ownership, isolation guardrails, smoke coverage, and room to grow into the gameplay rules engine without leaking infrastructure concerns into the domain core.
