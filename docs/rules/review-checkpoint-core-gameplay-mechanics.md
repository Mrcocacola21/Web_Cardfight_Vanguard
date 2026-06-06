# Review Checkpoint: Core Gameplay Mechanics

Phase 17 - Core Gameplay Mechanics  
Step 17.7 - Review checkpoint

Checkpoint question:

> Do the current gameplay mechanics form a clean, extensible combat/state engine
> layer, or has the engine started accumulating brittle special-case logic?

## 1. Executive Summary

Verdict: **GO WITH CONDITIONS**.

Phase 17 is now more than a set of isolated first mechanics. The current
`rules-core` foundation has a coherent reducer-centered gameplay layer:

- draw, shuffle, mulligan, ride, call, attack, boost, guard, checks, transfers,
  and piece state flags all evolve `GameState` through structured transition
  results;
- engine-owned requests are real and are used by mulligan, guard, and adapter
  continuation flows;
- runtime card identity is preserved through the reviewed movement paths;
- events are generally facts, actions are generally intents, and requests stay
  pending engine prompts;
- Standard, V Premium, and Premium still compose through adapters instead of
  format switches inside the core reducer.

The foundation is coherent enough to continue, but it is not yet safe to let an
effect system depend on every current behavior as final policy. The main risks
are concentrated in a few load-bearing seams:

- adapter-owned transitions can bypass some core reducer discipline, especially
  active-battle sequencing;
- piece state flags are preserved across every zone transfer without a clear
  lifecycle policy;
- battle/check flow is a useful linear foundation but not yet a complete battle
  lifecycle;
- some choice-response outcomes are state-only and not observable as events;
- docs and tests are good for the current baseline but miss several future
  effect-system stress cases.

This is not a fragile case pile yet. It is a real engine foundation with a few
known brittleness points that should be handled before Phase 18 grows effects on
top of them.

## 2. Scope Reviewed

Reviewed implementation areas:

- `packages/rules-core/src/state`
- `packages/rules-core/src/actions`
- `packages/rules-core/src/events`
- `packages/rules-core/src/requests`
- `packages/rules-core/src/transitions`
- `packages/rules-core/src/transfers`
- `packages/rules-core/src/boundary`
- `packages/rules-core/src/formats`

Reviewed mechanic groups:

- draw / shuffle / mulligan
- ride / call
- attack / boost / guard
- drive check / damage check
- unified zone transfers
- state flags
- reducer / transition contract
- engine/UI boundary
- Standard / V Premium / Premium adapters
- common format hooks

Reviewed docs:

- `docs/rules/draw-shuffle-mulligan-foundation.md`
- `docs/rules/ride-call-foundation.md`
- `docs/rules/attack-boost-guard-foundation.md`
- `docs/rules/drive-damage-check-foundation.md`
- `docs/rules/zone-transfer-foundation.md`
- `docs/rules/state-flags-foundation.md`
- `docs/rules/reducer-transition-foundation.md`
- `docs/rules/choice-request-model-foundation.md`
- `docs/rules/*format-adapter-foundation.md`
- `docs/rules/common-format-hooks-foundation.md`

Reviewed tests:

- transition tests for draw/shuffle/mulligan, ride/call, battle, checks, zone
  transfer, zone movement, state flags, and reducer behavior;
- action/event/request/state/boundary contract tests;
- Standard, V Premium, Premium, shared-hook, and adapter smoke tests.

## 3. Mechanics Layer Review

The gameplay mechanics layer now behaves like one engine more than six unrelated
sub-engines.

Positive signals:

- Most mechanics are entered through `reduceGameState`, `applyGameAction`, or
  `applyGameChoiceResponse`.
- Accepted mechanics return `applied` with a new revision, emitted events, and
  pending requests.
- Invalid and blocked paths are structured and preserve the current state.
- Zone movement is mostly centralized through transfer and relocation helpers.
- Battle state, check state, request state, and piece status are all part of
  `GameState`, not UI-side flags.
- Mechanics share the same runtime identities: `PieceId`, `ZoneId`,
  `PlayerId`, `RequestId`, and `BattleId`.

The layer is still a foundation, not a complete combat runtime. The current
coherence depends on keeping future work disciplined around shared transition
preflight, transfer semantics, battle lifecycle, and state flag lifecycle.

## 4. Draw / Shuffle / Mulligan Review

Status: solid engine-level foundation.

Shuffle is deterministic. The reducer does not call random APIs; it accepts an
explicit post-shuffle order and validates that the order is a permutation of the
current ordered multi-zone contents. That is the correct foundation for replay,
server authority, and multiplayer synchronization.

Draw is a real transition, not a helper pretending to be gameplay. It consumes
top-deck piece instances from an ordered source zone, moves them through the
shared movement path, and emits per-piece `piece.moved` facts plus aggregate
`cards.drawn`.

Mulligan is engine-owned. `system.begin_mulligan` creates a
`mulligan.select_cards` pending request, moves the game into `awaiting_choice`,
blocks unrelated actions, validates `answer.mulligan`, returns selected cards,
applies deterministic shuffle, draws replacements, clears the request, and marks
the player with a mulligan completion flag.

Risks:

- The opening flow is still represented as `in_progress` plus `pregame`, so full
  setup orchestration is still future work.
- Mulligan completion uses a player flag local to the mechanic. This is
  acceptable now, but future setup flow should make pregame flags a deliberate
  engine convention rather than one-off flags per setup rule.

## 5. Ride / Call Review

Status: coherent board-development mechanics with one important lifecycle risk.

Ride and call are real reducer mechanics. They validate actor, runtime card
piece, owned source/destination zones, destination zone kind, and target
occupancy. Ride handles the previous vanguard explicitly by moving it to soul
before moving the new ride piece to the vanguard circle. Call uses rear-guard
destination semantics and slot validation through the zone relocation model.

The format split is mostly healthy:

- core owns generic board movement and vanguard-to-soul behavior;
- Standard gates ride source to ride deck;
- V Premium gates ride source to hand and adds a gift continuation request;
- Premium keeps stride-like behavior adapter-owned.

Risks:

- Ride/call do not define piece-status lifecycle. If a piece carries a rested or
  locked sparse state through a previous transfer, ride/call preserve that state.
  This is intentional in the current baseline but dangerous before effects.
- Source-zone ownership is used as the main legality proxy. That is acceptable
  for this foundation, but future control/ownership mechanics will need explicit
  policy.

## 6. Attack / Boost / Guard Review

Status: real battle-loop foundation, but still a narrow linear script.

Attack declaration creates a `battle` aggregate, validates active turn player,
attacker controller, attacker zone, and target, then rests the attacker through
the piece-state flag layer. Boost is tied to an active battle and rests the
booster. Guard is engine-owned: the defending player opens a
`battle.guard_select` request, and the response moves selected guards from hand
to guardian circle.

Positive signals:

- Battle state is explicit, not implicit UI state.
- Rest/locked semantics are already consumed by attack and boost.
- Guard is a request/response flow, not a UI toggle.
- Pending requests block unrelated actions consistently.
- Battle sequencing is centralized in the root reducer for core actions.

Risks:

- Guard pass resolves state silently with no event fact.
- There is no explicit battle completion or cleanup primitive yet.
- Boost geometry is intentionally simplified; this is acceptable now, but it
  must not become the hidden default when columns matter.
- The active battle sequence guard currently protects core reducer actions, but
  adapter-owned transitions need the same preflight discipline.

## 7. Drive / Damage Check Review

Status: genuine engine mechanics with explicit future trigger placeholder.

Drive and damage checks are not simple draws. They require battle context,
validate battle status, validate player role, validate source/destination zone
kinds, consume top-deck runtime pieces, record revealed cards, emit battle check
events, and advance battle status.

Positive signals:

- Top-deck consumption is deterministic.
- Revealed cards carry runtime `pieceId` and canonical `cardDefinitionId` when
  present.
- Post-check movement emits normal `piece.moved` facts.
- `triggerResolutionState: 'pending_resolution'` is the current pending check hook.

Risks:

- The one-step reveal plus final movement model is probably fine for the current
  baseline, but trigger/effect resolution may need a more explicit intermediate
  check window.
- Damage is currently bound to player/vanguard targets only.
- Battle remains in `damage_checked` with no downstream completion path.

## 8. Zone Transfer Review

Status: real primitive, with wrappers that should stay canonical.

The zone transfer layer is not decorative. `ZoneTransferIntent`,
`ZoneTransferRecord`, `ZoneTransferReason`, `resolveZoneTransfer`,
`resolveZoneTransferSequence`, and `createPieceMovedEvents` provide a shared
movement vocabulary and event shape.

Existing mechanics mostly use this layer directly or through wrappers:

- draw and checks use top-of-ordered-zone wrappers;
- mulligan uses sequence movement plus deterministic reorder;
- ride, call, guard, and Premium overlay movement use transfer helpers;
- generic `zone.move_piece` exposes the transfer primitive through the reducer.

Supported zone kinds such as soul, drop, bind, damage, ride deck, and G deck are
represented as real runtime zones in tests. The core remains generic over
`ZoneKind`, while format adapters decide whether a zone kind is usable in a
given format.

Risks:

- `ordered-zone-operations` is a second helper layer adjacent to transfers. It
  is reasonable now, but future work should treat it as canonical transfer
  composition, not a place for raw movement logic to spread.
- Zone kind semantics are still mostly string conventions. That is acceptable
  for a foundation, but effects will need clearer policies for zone categories,
  visibility, and state lifecycle.
- G deck / G zone terminology differs between generic transfer examples and
  Premium adapter runtime structure. This should be clarified before more
  Premium mechanics are added.

## 9. State Flags Review

Status: good representation, insufficient lifecycle policy.

The model correctly separates mutually exclusive orientation from composable
flags:

- orientation: `stand | rest`
- flags: currently `locked`

Sparse `pieceStates` is a pragmatic model: missing state means standing and
unflagged. Reducer actions `piece.rest`, `piece.stand`, `piece.lock`, and
`piece.unlock` are structured. Attack and boost consume the same state layer,
which proves flags are part of engine truth.

The main issue is movement lifecycle. Current transfers preserve piece-state
entries across all zones. That is explicitly tested, but it is not enough policy
for the effect system. The engine needs to know whether orientation and flags
survive moves to hand, deck, soul, drop, bind, damage, guardian circle, ride
deck, G deck, and temporary effect zones.

This is the largest semantic risk in Phase 17 because stale rest/lock state can
cross zone boundaries and then affect future ride/call/battle behavior unless
the lifecycle is formalized.

## 10. Reducer / Contract Consistency Review

Status: strong in core, weaker at adapter-owned transition edges.

Core mechanics follow the same transition philosophy:

- assert current-state invariant at reducer entry;
- check revision;
- block on pending requests;
- enforce active battle sequencing for core actions;
- return `applied`, `invalid`, or `blocked`;
- avoid hidden partial mutation;
- assert next-state invariants through `createTransitionResult`.

This is a strong reducer foundation.

The main inconsistency is adapter-owned transitions. Premium `card.play` uses
adapter helpers and returns a transition without going through the root reducer
action path. That is the right architectural direction for format-owned
mechanics, but those helpers currently replicate only part of the reducer
preflight. They check revision, pending requests, status, player, and piece, but
they do not share the core active-battle sequencing guard. If adapter-owned
mechanics grow before this is fixed, the system can split into reducer-first and
helper-first behavior.

Recommendation: extract or publish a shared transition preflight for adapter
owned transitions, or require adapter-owned handlers to use the same sequencing
contract before producing custom state.

## 11. Format Adapter Compatibility Review

Status: reusable core with adapter stress points.

The core has not drifted into Standard-only implementation. Format-specific
logic is still concentrated in adapters:

- Standard owns ride-deck gating;
- V Premium owns no-ride-deck gating, hand ride policy, and imaginary gift
  continuation request;
- Premium owns G zone / heart / stride-like overlay behavior.

This is healthy. The adapter model is real, not theoretical.

Risk: adapter-owned custom transitions are now powerful enough to create their
own mini-transition discipline. That is where format-switch soup can re-enter by
another name. Shared hooks are useful, but they need to include the same
transition safety contract as the core reducer.

## 12. Test Coverage Review

Status: good representative coverage, not yet effect-system confidence.

Strong coverage exists for:

- deterministic shuffle;
- draw success and insufficient-source invalid path;
- mulligan request and response mismatch;
- ride/call success and invalid destination/occupied slot;
- attack, boost, guard request, guard resolution, and mismatch;
- drive and damage checks;
- generic zone transfers across key zones;
- state flag transitions and attack/boost rest consumption;
- valid/invalid/blocked reducer paths;
- format adapter behavior and shared hooks.

Important gaps:

- adapter-owned transitions during an active battle;
- state flag lifecycle across ride/call after off-board movement;
- guard pass observability and downstream battle sequencing;
- check resolution pressure before final post-check movement;
- battle completion and cleanup once implemented;
- multi-request chains beyond simple head-of-queue behavior;
- deeper format-specific battle/check legality.

The tests protect the current foundation, but they do not yet protect the
semantics an effect system will stress hardest.

## 13. Documentation Review

Status: mostly accurate, with some drift after later Phase 17 steps.

The docs generally match the implementation and are honest about scope limits.
They correctly document determinism, engine-owned requests, adapter boundaries,
transfer reasons, state flags, and unimplemented trigger/effect work.

Notable doc issues:

- attack/boost/guard docs understate state-flag integration because attack and
  boost now emit `piece.rested` before battle facts;
- guard pass state behavior is documented only as a response path, not as an
  observable event policy;
- zone transfer docs mention G deck while Premium adapter semantics use G zone;
- state flag docs honestly document preservation across transfers, but the
  design consequence should be called out more strongly before effects.

## 14. Top Findings

### Finding 1

Severity: **High**

Issue: Adapter-owned transitions can bypass part of the core reducer sequencing
contract.

Why it matters: The root reducer blocks most actions during active battle
states, but custom adapter handlers can construct transitions through format
helpers that do not share that battle sequencing preflight. As adapter-owned
mechanics grow, this can create a helper-first parallel engine beside the
reducer-first core.

Recommendation: Before adding effect-heavy or battle-sensitive adapter logic,
extract a shared preflight/sequence guard for adapter-owned transitions, or make
adapter handlers explicitly pass through a common transition contract.

### Finding 2

Severity: **High**

Issue: Piece state flags have no movement lifecycle policy.

Why it matters: Rested and locked state currently survives every zone transfer.
That is deterministic, but it can make stale board state leak into hand, soul,
drop, damage, ride/call, and future effect flows.

Recommendation: Define transfer-driven lifecycle policy before Phase 18 depends
on flags: which movements preserve orientation, which clear orientation, which
clear or preserve `locked`, and which mechanics explicitly override defaults.

### Finding 3

Severity: **Medium**

Issue: Battle flow is coherent but incomplete and too linear for future effects.

Why it matters: Current statuses support attack, optional boost, guard, drive,
and damage, but there is no completion/cleanup primitive, no pass event, no hit
or no-hit path, and no effect timing windows.

Recommendation: Add an explicit battle completion/cleanup primitive before the
playable prototype depends on battle state. Do not let effects infer completion
from `damage_checked` alone.

### Finding 4

Severity: **Medium**

Issue: Choice-response outcomes are not consistently observable as events.

Why it matters: Guard pass and generic choice continuation can mutate state or
clear requests with no emitted fact. Replay, logs, triggers, and UI animation
may later need a durable fact that a decision was resolved or declined.

Recommendation: Define a choice-resolution event policy. Not every response
needs a domain event, but battle-relevant pass/decline decisions should be
intentional.

### Finding 5

Severity: **Medium**

Issue: Transfer wrappers are healthy now, but future raw zone manipulation would
quickly create special-case sprawl.

Why it matters: `ordered-zone-operations` sits beside the transfer primitive and
is used by draw, mulligan, checks, and guard. It currently composes safely, but
this is the seam where duplicated movement logic would likely reappear.

Recommendation: Keep all future card movement behind transfer records and
`piece.moved` events. If ordered/top/bottom operations grow, make them formal
transfer-composition primitives.

### Finding 6

Severity: **Low**

Issue: Documentation is mostly current but has small semantic drift.

Why it matters: Phase docs are serving as design contracts. Drift around state
flag events, guard pass observability, and G deck/G zone terms can mislead the
next phase.

Recommendation: Update the mechanic docs after the next small round of
transition-policy fixes.

## 15. Fixes Applied

No code fixes were applied in this checkpoint.

Only this review document was added:

- `docs/rules/review-checkpoint-core-gameplay-mechanics.md`

Reason: the important issues found are policy seams, not safe one-line fixes.
Changing flag lifecycle, battle completion, or adapter preflight semantics
should be done as focused implementation tasks with tests, not hidden inside a
review checkpoint.

## 16. Final Verdict

Verdict: **GO WITH CONDITIONS**.

Phase 17 has produced a coherent gameplay mechanics foundation. The engine is
not a fragile pile of one-off cases yet. The current layer is deterministic,
mostly reducer-first, identity-preserving, request-aware, and compatible with
multiple format adapters.

Conditions before effect-system growth:

1. Bring adapter-owned transitions under the same preflight and sequencing
   discipline as core reducer transitions.
2. Define piece-state flag lifecycle across zone transfers.
3. Add explicit battle completion/cleanup before effects depend on battle end
   behavior.
4. Decide which choice-response outcomes need durable event facts.
5. Add focused tests around the above seams.

With those conditions handled, the project can move forward from Phase 17
without treating the current mechanics as throwaway prototypes.
