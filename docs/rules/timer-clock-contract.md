# Timer / Clock Contract

## 1. Purpose

This document defines the bounded authoritative timer contract used before Phase 20 realtime sync. The goal is not a full tournament clock. The goal is that match-session owns time, pending choices and active turns can expire, and timeout resolution is a persisted runtime transition instead of UI-only behavior.

## 2. Why Metadata Timestamps Were Not Enough

Room metadata such as `createdAt`, `updatedAt`, `startedAt`, `completedAt`, history `recordedAt`, and realtime `receivedAt` describe when records were written. They did not define gameplay authority over time, active deadlines, timeout outcomes, or reconnect behavior. A pending request could remain live forever.

## 3. Chosen Authoritative Time Model

`MatchRoom.clock` is canonical session truth. It has `authority: "match-session"`, `serverNow`, clock settings, and optional active request and turn deadlines. The clock source is injected into match-session/realtime runtime for tests and local play; production can supply a server clock. Client clocks are never authoritative.

## 4. Request Deadline Semantics

The active request deadline belongs to `pendingRequests[0]`. When an accepted engine transition creates or changes the FIFO head request, match-session assigns `startedAt` and `deadlineAt`. If the head request expires, the session runtime resolves a system-owned timeout against the responder. Requests behind the FIFO head do not own time until they become the head.

## 5. Turn Deadline Semantics

The active turn deadline is assigned when the active `turnNumber` or `turnPlayerId` changes in an active engine state. A turn timeout currently forfeits the turn player. Request deadlines are evaluated before turn deadlines so an expired head choice has deterministic priority over the broader turn clock.

## 6. Timeout Outcomes

Timeouts are resolved by session/runtime through a system action, `match.timeout`. Clients cannot submit this action through realtime client commands. The rules-core reducer turns it into terminal match truth: timed-out player defeated, pending requests cleared, battle residue removed, `player.defeated` emitted with `reason: "timeout"`, and `match.ended` emitted with `reason: "timeout"` plus `timeoutReason`.

## 7. Transport-Facing Time Fields

Participant and omniscient projections include `clock.serverNow`, `clock.authority`, and active request/turn deadline projections with `startedAt`, `deadlineAt`, and derived `remainingMs`. `remainingMs` is display data only. `deadlineAt` plus server-owned timeout resolution is the authoritative contract for future realtime clients and reconnect snapshots.

## 8. Relationship To Persistence / Reconnect

The session snapshot serializes `MatchRoom.clock` together with room state and event history. Restore validates that the clock shape is present. A restored room keeps the active deadlines it had before persistence; runtime can immediately call timeout resolution after restore/reconnect if `serverNow` is past a deadline. Timeout events are recorded through accepted session history.

## 9. What Is Intentionally NOT Implemented Yet

This step does not implement tournament time controls, pauses, extensions, per-phase custom clocks, distributed scheduler infrastructure, warning/AFK policy, polished timer UI, or client authority over time. It also does not add default non-terminal choices for expired optional requests; the current bounded policy is timeout defeat.

## 10. Summary

Realtime now has a minimal authoritative time foundation: match-session owns the clock, deadlines are part of canonical room state, timeout resolution is a system-owned runtime path, projections expose deadline data, and persistence can restore active deadline truth.
