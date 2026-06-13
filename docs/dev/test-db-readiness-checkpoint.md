# Test DB Readiness Checkpoint

## 1. Purpose

This checkpoint verifies that `corepack pnpm test:db` reaches a live local
Supabase/Postgres database, applies migrations and seeds, and runs real DB
assertions before Phase 20 realtime depends on gameplay persistence.

## 2. What was failing before

The readiness concern was that local Supabase/Docker startup failed before the
DB assertions ran, so `test:db` did not prove schema, RLS, or gameplay
persistence behavior.

In the current checkout and local environment this failure did not reproduce:
`corepack pnpm test:db` started/reset the local stack and completed all live DB
assertions.

## 3. Root cause

The active failure was not a schema or test assertion failure. The current local
stack starts through `scripts/dev-stack.mjs`, which excludes optional Supabase
log/edge services (`logflare`, `vector`, `edge-runtime`) and the config keeps
analytics/edge-runtime disabled. Those services are reported as stopped by the
Supabase CLI, while the DB/API/auth/storage/realtime containers are healthy.

Because the failure no longer reproduces, no further startup behavior was
changed. The harness diagnostics were tightened so future startup/reset
failures include the failing command plus captured stdout/stderr.

## 4. What was changed

`packages/db/scripts/test-db.mjs` now reports the exact failed `corepack`
command, exit status, stdout, and stderr when `dev:up`, `dev:reset`, or
`supabase status` fails before assertions.

No tests were disabled. RLS was not weakened. The live DB path was not replaced
with mocks.

## 5. How to run `corepack pnpm test:db`

Start Docker Desktop first, then run:

```powershell
corepack pnpm test:db
```

The command delegates to:

```powershell
corepack pnpm --filter @web-vg/db run test:db
corepack pnpm --filter @web-vg/db run test
```

The live DB harness starts the local Supabase stack, resets the local database
with migrations and seed data, resolves the local DB URL through Supabase CLI,
and then runs assertions against Postgres.

## 6. What DB confidence this now proves

The green checkpoint proves that the local migrations and seed baseline replay
successfully and that repository/unit tests still pass after the live DB run.

It also proves live DB behavior for:

- catalog/deck/social/match constraints;
- deck atomic write RPCs and dense read RPCs;
- baseline owner/non-owner RLS behavior;
- gameplay canonical tables being server-only under RLS;
- service-role access to gameplay room tables;
- gameplay persisted match session RPC create path;
- accepted transition persistence across `match_rooms`, `room_snapshots`,
  `room_events`, and `pending_choices`;
- stale accepted transition rejection on room revision conflict.

## 7. What it still does NOT prove

This checkpoint does not prove production hosted Supabase configuration,
multi-node realtime fanout, WebSocket delivery, reconnect replay windows,
long-running load behavior, browser auth UX, or participant-safe realtime
subscriptions. It verifies the local DB foundation and RLS posture only.

## 8. Summary

`test:db` now provides a live green DB checkpoint in this environment. Phase 20
realtime storage readiness is no longer based only on package-level mocks or
code review; gameplay persistence and RLS have been exercised against the local
Postgres/Supabase stack.
