# Application Layer Foundation

## 1. Purpose

Introduce a small, explicit application layer so orchestration and use-case
logic stop accumulating in server actions and server-local helpers.

## 2. Why application layer is needed now

The project already has strong domain and infrastructure boundaries, but
workflow logic had started to settle in transport-facing files:

- deck server actions previously owned create/delete/duplicate/mutate flows
- profile save and profile provisioning logic lived in server actions and
  server-local helpers

That made orchestration harder to reuse from anything outside Next.js entry
points and increased framework coupling at the edge.

## 3. What belongs where

Transport:

- server actions, route handlers, auth/session access
- form parsing
- Next.js redirects and cache revalidation

Application:

- use-case orchestration
- repository coordination
- ownership/profile resolution
- domain invocation and application result shaping

Domain:

- pure deck rules and mutations in `@web-vg/decks`
- catalog/domain logic in domain packages

Infrastructure:

- Supabase clients
- `@web-vg/db` repository implementations
- repository DTO/persistence concerns

## 4. Chosen placement in the repo

The first application-layer modules live in feature-local folders under
`apps/web/src/features/<feature>/application`.

This is intentional:

- it creates a visible layer boundary immediately
- it stays close to the web features currently under pressure
- it avoids introducing a premature central `packages/application` dumping
  ground before cross-feature reuse patterns are proven

The requirement for these modules is behavioral, not positional: they stay
framework-agnostic plain TypeScript even though they currently live inside the
web app package.

## 5. First extracted use cases

Representative extracted use cases now include:

- deck creation
- deck deletion
- deck duplication
- deck builder composition mutation
- deck draft save
- current-profile save
- auth/profile provisioning

## 6. Dependency direction

The intended direction is now:

- transport -> application
- application -> domain and repository contracts
- infrastructure -> database/Supabase

Application modules do not call `redirect`, `revalidatePath`, cookies, or other
Next.js transport concerns.

## 7. What is intentionally NOT done yet

This step does not:

- move every server action into the application layer
- create a central command bus or CQRS framework
- rewrite all profile/catalog/auth read flows
- extract a new workspace package for application logic

Some thinner read-side helpers and auth transport flows still sit in
`server/` because the current pressure is highest on write-side orchestration
and mutation workflows. That is acceptable for now as long as new
orchestration-heavy logic continues to move into `application/`.

## 8. Summary

The application layer now exists as a real, exercised layer instead of a
planned one-off idea. Deck and profile write-side workflows use plain
TypeScript use cases below transport, while Next.js concerns remain at the
edge. This gives the project a practical path for continued incremental
extraction without a big-bang architectural rewrite.
