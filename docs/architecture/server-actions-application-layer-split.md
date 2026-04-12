# Server Actions and Application Layer Split

## 1. Purpose

Keep Next.js server actions as transport adapters while moving reusable use-case orchestration into plain TypeScript application modules.

## 2. What problem existed before

Load-bearing deck server actions had started to own the full workflow: auth-aware profile resolution, repository creation, ownership checks, domain mapping, persistence coordination, error mapping, and Next.js cache handling. That made the use-case flow framework-coupled and harder to reuse outside server actions.

## 3. What now remains in server actions

Server actions now handle:

- form/input parsing
- auth/session resolution
- invocation of application use cases
- Next.js-specific `revalidatePath` and `redirect`
- UI-facing error adaptation

## 4. What moved into use-case/application layer

The new deck application layer now owns:

- profile and deck ownership resolution
- repository coordination
- create/delete/duplicate deck workflows
- deck builder mutation/save orchestration
- domain-to-persistence mapping and persistence reload flow
- application error/result shaping

## 5. Example extracted flow(s)

Representative extracted flows:

- deck creation
- deck deletion
- deck duplication
- deck builder composition mutation
- deck draft save

These flows are now executable through plain TypeScript use-case modules without any dependency on Next.js server actions.

## 6. Dependency direction

The dependency direction is now:

- server actions -> application use cases
- application use cases -> domain packages / repository interfaces
- repositories -> database infrastructure

Next.js concerns stay at the edge and do not flow back into the application layer.

## 7. Behavioral compatibility

The refactor preserves current user-facing behavior. Redirect and cache revalidation still happen in the server action layer, while the extracted use cases keep the same ownership checks, validation messages, domain mutation behavior, and persistence semantics.

## 8. Summary

This split removes mature transport-layer smell without introducing a heavy framework. Server actions remain the entrypoints for the web app, while reusable deck workflows now live below transport in a framework-agnostic application layer.
