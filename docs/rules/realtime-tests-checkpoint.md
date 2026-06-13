# Realtime Tests Checkpoint

## 1. Purpose

Phase 20.6 makes the realtime path test-explicit. The goal is not more tests by
count; it is coverage for the seams that would break authoritative multiplayer:
participant sync, reconnect, stale revisions, optimistic rollback, projection
safety, auth boundaries, and deadline behavior.

## 2. What realtime seams are now protected

- Server-owned command submission through persisted session authority.
- Two-participant convergence through the server-route realtime transport.
- Stale revision rejection without overwriting accepted history.
- Participant-specific projected snapshots for normal sync and reconnect.
- Client recovery by replacing stale local state with authoritative snapshots.
- Bounded optimistic UI state that is cleared or superseded by server truth.
- Pending request and deadline projection through sync and recovery.
- Authenticated route membership checks and server-only canonical DB posture.
- Bounded social realtime as a separate friends-dashboard snapshot route.

## 3. Test layers used

- Runtime / integration: `@web-vg/match-session` transport, runtime, and
  persisted-session adapter tests cover authoritative transition and recovery
  behavior using real session/storage abstractions.
- Client integration: `PersistedProjectedMatchRoomClient` tests cover polling,
  command submit, reconnect, stale snapshots, optimistic state, and projected UI
  convergence.
- Route tests: `apps/web` API route tests cover auth, membership scoping,
  projected payload forwarding, and hidden-info exclusions.
- DB-backed tests: `test:db` verifies canonical gameplay tables remain
  server-only and persisted transitions reject stale revision writes.

## 4. Highest-value scenarios covered

- Participant A advances a persisted room; participant B observes the same
  authoritative room revision through their own safe projection.
- Participant B first submits with a stale revision, receives a projected
  current snapshot, then succeeds with the current revision; participant A
  reconnects to the same final revision.
- Reconnect replaces stale projected client state and resumes the polling loop.
- Pending request and active deadline data survive sync and recovery.
- Expired deadlines are explicit: snapshot loads do not auto-resolve them until
  a server-owned timeout runner persists the timeout outcome.
- Optimistic submit markers never mutate canonical board state and are
  overridden by accepted, blocked, stale, completed, or recovered server state.
- Realtime payloads are checked for absence of canonical `engineState` and for
  per-viewer hidden-card separation.

## 5. Remaining known gaps

- No production timeout runner is wired into the live app path yet; current tests
  prove both the present limitation and the manual persisted timeout recovery
  path.
- No browser-level two-authenticated-session match e2e exists yet. The current
  strongest coverage is transport + route + client integration.
- Command idempotency / exactly-once replay is still not implemented, so tests
  cover safe recovery after unknown command status rather than deduplicated
  replay.
- Polling remains the delivery baseline; WebSocket/SSE fanout is not covered
  because it is not implemented.

## 6. Verdict

GO WITH CONDITIONS. The realtime path is now protected by meaningful runtime,
route, client, social, and DB-backed tests. The remaining conditions are
production timeout runner coverage, browser multi-session e2e, and idempotent
command replay before calling the realtime stack production-complete.

## 7. Summary

Phase 20 no longer rests on untested synchronization assumptions. The current
bounded realtime model is covered where it exists, and the remaining production
gaps are explicit rather than hidden behind green unit tests.
