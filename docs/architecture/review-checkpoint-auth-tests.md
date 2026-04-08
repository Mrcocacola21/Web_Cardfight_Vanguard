# Auth Tests Checkpoint

Date: 2026-04-08
Verdict: GO WITH CONDITIONS

## 1. Scope of This Checkpoint

This checkpoint verifies the current auth foundation at three practical test
layers:

- unit coverage for auth/session helper logic;
- integration coverage for server-aware auth flows;
- e2e smoke coverage for user-visible auth journeys where the local environment
  can support them.

Included:

- sign up
- sign in
- sign out
- protected-route behavior
- auth-page redirect behavior for authenticated users
- auth callback / email-confirmation handling at helper and route-handler level
- profile provisioning only where it directly affects auth correctness

Intentionally not included:

- full security audit
- exhaustive edge-case matrix
- multi-provider auth
- password reset
- full email-confirmation browser automation

## 2. What Was Tested

Unit and integration coverage now lives in the `apps/web` Vitest suite.

Added or strengthened tests:

- `apps/web/src/features/auth/server/auth-session.test.ts`
- `apps/web/src/features/auth/server/route-guards.server.test.ts`
- `apps/web/src/features/auth/server/auth-actions.test.ts`
- `apps/web/src/features/auth/server/auth-callback.test.ts`
- `apps/web/src/app/auth/callback/route.test.ts`
- existing auth/helper tests remained in place:
  - `auth-validation.test.ts`
  - `route-guards.test.ts`
  - `profile-provisioning.test.ts`
  - auth form render tests

Added e2e smoke assets:

- `tests/e2e/auth.spec.ts`
- `apps/web/scripts/test-auth-e2e.mjs`
- root scripts:
  - `pnpm test:auth`
  - `pnpm test:auth:e2e`

## 3. Unit Coverage

The unit/helper layer now verifies:

- `getCurrentAuthState`
  - signed-out path
  - authenticated path
  - failed session resolution path
- route-guard decision helpers
  - signed-out -> protected redirect
  - authenticated -> auth-page redirect
- auth callback helper logic
  - safe redirect sanitization
  - missing callback data
  - provider-reported callback failure
  - successful callback flow
  - profile-setup failure after callback
- auth validation
  - sign-in draft validation
  - sign-up draft validation
- initial profile draft derivation
  - explicit display name
  - email-local-part fallback

## 4. Integration Coverage

The server-aware integration layer now verifies:

- `signUpAction`
  - successful registration path when Supabase returns a user but no session
  - callback URL wiring
  - profile provisioning handoff
  - clean failure when callback URL cannot be prepared
- `signInAction`
  - successful login redirect to `/profile`
  - invalid credentials -> friendly error
  - profile provisioning still required on sign-in
- `signOutAction`
  - sign-out mutation runs
  - redirect to `/login`
- `requireProtectedRouteAccess`
  - signed-out users are redirected server-side
  - authenticated users are allowed
- `requireAuthPageAccess`
  - authenticated users are redirected away from auth pages
  - auth resolution failures surface as explicit error states
- `GET /auth/callback`
  - code-exchange path redirects correctly
  - response carries session cookie writes
  - missing callback parameters redirect to `/login` with an explicit error code

This is materially stronger than the previous state where auth tests mostly
stopped at helper logic and form rendering.

## 5. E2E Coverage

Added Playwright auth smoke coverage in `tests/e2e/auth.spec.ts`:

- unauthenticated user -> `/profile` -> redirected to `/login`
- local Supabase-backed end-to-end flow:
  - register
  - land on `/profile`
  - redirect away from `/login`
  - sign out
  - protected route denied after sign-out
  - sign back in
  - redirect away from `/register`

Current validation result:

- the e2e smoke suite was added and wired through `pnpm test:auth:e2e`
- in this environment it could not be completed, because local Supabase
  `auth/api` services are not running; only the local Postgres container is up
  (`supabase status -o env` exposes `DB_URL`, but not `API_URL` / `ANON_KEY`)

This means the browser-auth smoke layer is present and honest, but not yet
validated locally in this checkpoint run.

## 6. What Is Still Not Covered

- full browser automation of email confirmation/callback, because local auth
  config disables email confirmations and there is no mailbox-driven flow in
  this checkpoint
- live SSR cookie refresh behavior against a fully running local Supabase auth
  stack in this environment
- multi-provider auth
- password reset / recovery
- authorization beyond authenticated-vs-unauthenticated route protection

## 7. Current Risks

### Issue: live auth e2e requires a full local Supabase stack, but only DB is running here

- Severity: MEDIUM
- Why it matters: browser-level auth smoke cannot currently validate the real
  Next.js + Supabase auth handshake in this environment.
- Recommendation: before treating auth browser smoke as green, ensure local
  Supabase `auth/api` services expose `API_URL` and `ANON_KEY`, then rerun
  `pnpm test:auth:e2e`.

### Issue: email-confirmation path is covered at helper/route level, not as full browser automation

- Severity: LOW
- Why it matters: callback correctness is now tested, but not via real mailbox
  interaction.
- Recommendation: acceptable for this stage; keep helper/integration coverage
  and add mailbox-level automation only if confirmation UX becomes a delivery
  risk.

### Issue: auth test command is environment-sensitive by design

- Severity: LOW
- Why it matters: `pnpm test:auth:e2e` is honest and fails when local auth
  infra is incomplete; it is not a pure mocked test.
- Recommendation: keep this behavior. Do not convert missing local auth infra
  into a silent skip that would create fake confidence.

## 8. Verdict

`GO WITH CONDITIONS`

Why:

- auth helper logic is meaningfully covered;
- server-side auth actions and callback route now have focused integration
  coverage;
- route protection and sign-out are no longer effectively untested paths;
- the e2e layer exists and is realistic rather than theatrical.

Conditions:

- do not treat local browser-auth smoke as validated until the full local
  Supabase auth/api stack is available and `pnpm test:auth:e2e` passes;
- do not claim full end-to-end email-confirmation browser coverage;
- keep auth growth on the current server-aware path and preserve repository /
  session boundaries already reinforced by the tests.
