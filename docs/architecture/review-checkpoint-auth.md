# Auth Review Checkpoint

Date: 2026-04-08
Verdict: GO WITH CONDITIONS

## 1. Executive Summary

The current auth foundation is architecturally coherent and usable for the current stage. Security-critical decisions stay on the server path, session resolution has a single canonical entry point, protected routes are guarded server-side, and profile persistence remains separated from Supabase Auth identity.

The main remaining concern is not a client-side hack or a broken route guard. It is privacy and completeness: profiles currently default to `public`, while profile visibility controls are not implemented yet. The foundation is therefore safe enough to continue with the next user-facing/private feature wave, but not safe enough to forget about visibility, confirmation-flow completeness, and deeper auth-path testing.

## 2. Scope Reviewed

Reviewed areas:

- sign up and sign in server actions
- SSR session refresh and current-user resolution
- auth/public/private route behavior
- profile auto-creation handoff after auth
- own-profile and public-profile access paths
- profile repository usage inside app auth/profile flows
- auth-related env exposure and docs alignment

Key files reviewed included:

- `apps/web/src/lib/supabase/*`
- `apps/web/proxy.ts`
- `apps/web/src/features/auth/server/*`
- `apps/web/src/features/profiles/server/*`
- `apps/web/src/app/(auth)/*`
- `apps/web/src/app/(protected)/*`
- `apps/web/src/app/users/[profileId]/*`
- `packages/db/src/repositories/profiles/*`

## 3. What Looks Strong

- Auth-critical mutations run in server actions, not in client components.
- Current-user resolution is centralized in `getCurrentAuthState()`.
- Protected-route decisions are server-aware and implemented in App Router route-group layouts.
- Auth pages redirect authenticated users away from `/login` and `/register`.
- Profile persistence is cleanly separated from auth identity and goes through the repository layer.
- Public profile rendering uses a dedicated public read model and does not expose auth-only fields.
- Browser Supabase client exists, but is not currently used as a parallel source of auth truth.

## 4. Server/Client Boundary Review

Status: strong

Observations:

- `signInAction`, `signUpAction`, and `signOutAction` are server actions and own the auth mutations.
- `getCurrentAuthState()` is the canonical server-side session accessor.
- Private-route decisions are not delegated to client hooks or client redirects.
- React components own form handling and presentation only; they do not call repositories or issue direct Supabase queries.

No evidence was found of client-only protection masquerading as real protection.

## 5. Session Handling Review

Status: acceptable with conditions

Strengths:

- `proxy.ts` and `src/lib/supabase/proxy.ts` keep the SSR cookie/session refresh path aligned with App Router.
- `getCurrentAuthState()` uses `auth.getUser()` on the server path instead of relying on client state.
- Server helpers reuse a shared server client when possible to avoid split-brain request state.

Conditions:

- There is no implemented auth callback / confirmation completion path yet.
- The current test posture does not exercise the live cookie refresh + server redirect path end-to-end.

This is not fragile, but it is not fully closed for broader real-world auth flows yet.

## 6. Route Protection Review

Status: strong for authenticated-vs-unauthenticated boundaries

Strengths:

- `/profile`, `/decks`, and `/decks/[deckId]` live behind the protected route group.
- `/login` and `/register` are guarded in the opposite direction for already-authenticated users.
- Unauthenticated users are redirected server-side to `/login`.
- Current private deck detail flow already adds an ownership check on top of route protection.

Limit:

- Fine-grained authorization is intentionally out of scope, so this remains a baseline auth boundary, not a full authorization system.

## 7. Auth/Profile Separation Review

Status: strong with one privacy caveat

Strengths:

- Supabase auth user and application profile are modeled separately.
- App profile truth lives in `user_data.profiles`, not in auth metadata.
- Auth metadata is used only as a bootstrap hint for initial `display_name`, not as long-term profile storage.
- Own-profile and public-profile flows return mapped profile read models rather than auth/provider objects.

Privacy caveat:

- Profiles default to `public`, but the current app does not yet expose profile visibility controls.

## 8. Public Profile Exposure Review

Status: acceptable with conditions

Strengths:

- Public profile route is intentionally public.
- Public fetch path uses a public read model and filters by `visibility = 'public'`.
- Not-found handling is explicit.
- The page renders only `display_name`, `avatar_url`, and `bio`.

Conditions:

- Public URL identity currently uses raw `profileId`, which is a pragmatic but coarse public identifier strategy.
- Because profile visibility controls are not implemented, the public profile surface currently follows the persisted default rather than an explicit user choice.

## 9. Repository/Persistence Boundary Review

Status: strong

Observations:

- App auth/profile flows use `@web-vg/db` repositories instead of page-local persistence logic.
- Profile reads and writes remain in repository-backed server helpers and server actions.
- No raw DB rows are intentionally leaked into UI-facing auth/profile surfaces.
- `apps/web` orchestrates auth-to-profile handoff but does not become the persistence owner.

## 10. Security Posture Review

Status: acceptable with conditions

Strengths:

- `apps/web` uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- No service-role key is used in the app auth/profile path.
- Error messages shown to users are normalized and do not surface raw DB internals.
- Broken auth/profile states are handled explicitly rather than silently ignored.

Conditions:

- Confirmation/recovery flows are not implemented.
- Current testing does not yet provide high confidence in live SSR session refresh behavior under edge conditions.

## 11. Risks and Weak Points

### Issue: Profiles default to public while profile visibility controls are not implemented

- Severity: HIGH
- Why it matters: new accounts can receive an application profile that is publicly exposable before the user has any in-app control over profile visibility.
- Evidence:
  - `supabase/migrations/20260408121300_create_profiles.sql:10`
  - `apps/web/src/features/profiles/server/profile-actions.ts:46`
  - `apps/web/README.md:51`
- Recommendation: before wider social/private expansion, implement explicit profile visibility controls or revisit the default visibility policy.

### Issue: Email confirmation / auth callback flow is still incomplete

- Severity: MEDIUM
- Why it matters: in environments where email confirmation is enabled, the registration path is only partially complete and relies on later sign-in retry instead of a fully closed confirmation return path.
- Evidence:
  - `apps/web/src/features/auth/server/auth-actions.ts:193`
  - `apps/web/src/features/auth/server/auth-actions.ts:205`
  - `apps/web/README.md:90`
- Recommendation: add a clean auth callback / confirmation completion route before treating auth as broadly production-ready.

### Issue: Auth test posture does not cover live SSR session/redirect behavior end-to-end

- Severity: MEDIUM
- Why it matters: current tests prove helper logic and UI rendering, but they do not fully exercise cookie refresh, server actions, or App Router redirect integration.
- Evidence:
  - `apps/web/src/features/auth/server/route-guards.test.ts:8`
  - `apps/web/src/features/profiles/server/profile-provisioning.test.ts:5`
  - `apps/web/src/components/auth/sign-in-form.test.tsx:6`
- Recommendation: add a thin integration layer for auth server helpers/actions before expanding private/social feature surface.

### Issue: Public profile route uses raw profile IDs as the public identifier

- Severity: LOW
- Why it matters: this is workable now, but it exposes a coarse internal identifier strategy into the public URL surface and is not ideal for long-term public identity design.
- Evidence:
  - `apps/web/src/app/users/[profileId]/page.tsx:17`
- Recommendation: keep as-is for now, but move to an intentional public identifier later if public profile discovery becomes more important.

### Issue: Auth/profile provisioning can leave dormant profile rows for unconfirmed accounts

- Severity: LOW
- Why it matters: because profile creation is intentionally app-driven after sign-up, unconfirmed accounts can still produce app-level profile rows.
- Evidence:
  - `apps/web/src/features/auth/server/auth-actions.ts:174`
- Recommendation: acceptable for current stage; revisit if unconfirmed-account cleanup becomes operationally relevant.

## 12. Fixes Applied

- Updated `apps/web/README.md` to explicitly state that profile visibility controls are not implemented yet and that the current public profile surface follows persisted visibility behavior.

## 13. Final Verdict

Verdict: GO WITH CONDITIONS

Rationale:

- No critical blocker was found in server/client auth boundaries.
- No evidence was found of client-only route protection masquerading as security.
- Auth and profile remain cleanly separated.
- Public profile exposure is intentionally limited and mapped through a dedicated public read model.

Conditions that remain active:

- do not expand social/public-profile surface while profile visibility is still implicit and not user-controlled;
- add auth callback / confirmation completion before treating auth as broadly production-ready;
- strengthen auth/session integration tests before relying on this layer for a larger private feature matrix.
