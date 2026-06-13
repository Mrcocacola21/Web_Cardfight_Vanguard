# Gameplay Room Auth / RLS Policy

## 1. Purpose

This step closes the security posture for gameplay room persistence before realtime work starts using durable room state. The goal is to prevent direct client access to canonical match truth while keeping the server/session runtime able to save and restore authoritative sessions.

## 2. Why canonical gameplay persistence cannot be treated like normal user-owned data

Gameplay room rows are not simple owner-owned records. Snapshots can contain full `engineState`, hidden zones, deck order, pending request internals, deadlines, and system-owned runtime state. Raw room events and pending choices can leak the same information or allow cheating if clients can insert, update, or delete them directly.

Participant-safe state must be produced through projection, not direct table reads.

## 3. Chosen access model

The chosen baseline is server-only canonical gameplay persistence.

`anon` and `authenticated` do not receive direct schema/table access to canonical `gameplay` room tables. `service_role` receives the DML access needed by the server/session runtime. RLS is enabled on the canonical tables and only service-role policies are defined.

## 4. Table-by-table policy posture

| Table                      | Client read      | Client insert/update/delete | Server/session access |
| -------------------------- | ---------------- | --------------------------- | --------------------- |
| `gameplay.match_rooms`     | No direct access | No direct access            | `service_role`        |
| `gameplay.room_players`    | No direct access | No direct access            | `service_role`        |
| `gameplay.room_snapshots`  | No direct access | No direct access            | `service_role`        |
| `gameplay.room_events`     | No direct access | No direct access            | `service_role`        |
| `gameplay.pending_choices` | No direct access | No direct access            | `service_role`        |

No participant-safe direct DB read model is introduced in this step.

## 5. Server/session authority vs participant access

Participants send commands through the server transport/session boundary. The server loads canonical room truth, applies commands through `match-session`, persists accepted transitions, and returns participant projections.

Participants do not write snapshots, room events, pending choices, timeout outcomes, or system actions directly.

## 6. Relationship to projection and transport

The Phase 20 transport baseline is server route orchestration with projected snapshots. That aligns with the DB posture: canonical tables are not a realtime feed for clients. If Supabase Realtime is used later, it should subscribe to a participant-safe projected layer or server-emitted messages, not raw canonical gameplay tables.

## 7. Relationship to persisted session adapter

The persisted session adapter still owns canonical save/load semantics. Production storage behind that adapter must run through server/session authority with `service_role` permissions or an equivalent server-only DB role.

Accepted transitions can update room snapshot/history/pending-choice state atomically without exposing those rows to browser clients.

## 8. What is intentionally NOT implemented yet

This step does not add participant-safe projected DB tables, spectator access, admin moderation roles, Supabase Realtime fanout, room invitation ACLs, or duplicate command idempotency. Those can be added later without opening canonical gameplay persistence to clients.

## 9. Summary

Gameplay room persistence is now explicitly server-only. Raw snapshots, events, room players, and pending choices stay behind the session authority; clients receive projected state through transport instead of direct database access.
