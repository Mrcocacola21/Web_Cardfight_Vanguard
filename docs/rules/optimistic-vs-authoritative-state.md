# Optimistic vs Authoritative State

## 1. Purpose

Phase 20.4 formalizes how the realtime match client can feel responsive without
becoming the owner of gameplay truth. The browser may mark a submitted command
as locally pending, but projected server state remains the only state that can
advance the room, board, pending requests, deadlines, or event history.

## 2. Why realtime needed an explicit optimistic vs authoritative model

The Phase 20.1/20.3 loop already synchronizes and recovers projected snapshots,
but a command submit could still look like a generic loading state. Without an
explicit model, client-side responsiveness would drift toward ad hoc local
mutation. This step makes the distinction visible in code and UI: optimism is a
temporary command marker; authority is the persisted session projection.

## 3. Chosen optimistic scope

The current optimistic scope is intentionally narrow:

- record one in-flight participant command in browser memory;
- show `Optimistic Pending` with the action label and expected room/engine
  revision;
- disable duplicate submits while the command is in flight;
- show clear outcomes such as `Authoritative Update Applied`,
  `Submission Failed`, `Stale / Conflicted`, or `Recovering`.

No optimistic board, hand, deck, pending-request, timeout, system-action, or
opponent-visible mutation is rendered as truth.

## 4. Authoritative convergence model

Every command is submitted with the current known room revision. The server
returns accepted, invalid, or blocked plus a participant-safe projected update
when available. The client applies that projected update as authoritative state
and replaces or clears the optimistic marker. If a newer authoritative snapshot
arrives first, the optimistic marker is marked stale/conflicted and the client
keeps the server projection.

## 5. Command lifecycle on the client

The bounded lifecycle is:

1. `Authoritative`: projected server state is applied.
2. `Optimistic Pending`: a participant command was sent with revision tokens.
3. `Authoritative Update Applied`: the server accepted the command and returned
   projected truth.
4. `Submission Failed`: the server rejected or blocked the command.
5. `Stale / Conflicted`: another authoritative revision beat the optimistic
   assumption.
6. `Recovering`: reconnect/recovery is fetching server truth.

The lifecycle is presentation and convergence metadata only; it is not a second
rules engine.

## 6. Interaction with revision, pending requests, deadlines, and reconnect

Room revision discipline drives the optimistic boundary. A command marker is
tied to the room and engine revision that produced its action. Pending requests,
available actions, and deadlines are always rebuilt from the latest participant
projection. If a timeout or another participant advances the room while a local
command is pending, the next authoritative snapshot wins. Reconnect/recovery
uses the same rule: reload projected server truth, then keep or collapse the
optimistic marker based on the recovered revision.

## 7. What is intentionally NOT optimistic yet

This step does not implement client-side gameplay simulation, board deltas,
hidden-information inference, optimistic choice completion, timeout prediction,
offline command queues, idempotent replay, CRDT conflict resolution, or local
prototype recovery. Those require stronger contracts than the first bounded
realtime loop currently needs.

## 8. Summary

The realtime match client now has explicit optimistic UX without client
authority. Users see immediate command intent and clear convergence states, but
the persisted server session and participant projection still decide every
gameplay outcome.
