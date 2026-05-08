# Phase 18.8 - Effect System Tests Checkpoint

## 1. Scope of This Checkpoint

This checkpoint protects the Phase 18 effect subsystem as one rules-core domain
surface: registry lookup, keyword-to-effect bridging, hybrid typed/declarative
contracts, first working effects, event-triggered resolution, queue ordering,
determinism, and reducer-centered integration.

The goal is not exhaustive card coverage. The goal is to make the load-bearing
effect seams difficult to regress silently.

## 2. Effect Registry Coverage

Registry tests cover immutable registration, stable lookup by effect id,
duplicate-id rejection, metadata stability, trigger metadata lookup, and the
fact that typed and declarative definitions are held under the same top-level
effect contract.

This keeps the registry load-bearing rather than decorative.

## 3. Keyword Mechanics Coverage

Keyword tests cover stable keyword references, keyword-to-effect binding lookup,
content-to-registry resolution, format applicability, unknown keyword behavior,
one-keyword-to-many-effect binding, duplicate binding rejection, and separation
from effect registration.

The tests intentionally consume stable semantic keyword ids, not importer rows,
display strings, or raw catalog staging artifacts.

## 4. Hybrid Effect Model Coverage

Hybrid model tests cover typed effect definitions, declarative effect
definitions, shared metadata, shared lookup, duplicate id rejection, and sample
effects of both representations.

The checkpoint verifies that keyword mappings and registry lookup do not need to
know whether an effect is typed or declarative.

## 5. First Effects Coverage

First-effect tests cover the current proof-of-viability examples:

- Twin Drive modifies drive check count through the current pre-check seam.
- Persona Ride draws a card and applies an observable power flag.
- Check finalization resolves from battle check events.
- Draw finalization resolves after Persona Ride's nested draw event.

These tests prove observable state/events rather than descriptor existence only.

## 6. Event-Triggered Resolution Coverage

Triggered-resolution tests cover candidate collection from emitted events and
timing windows, automatic reducer integration, no-match behavior, typed effect
resolution, declarative effect resolution, nested Persona Ride draw finalization,
and blocked base actions that must not enter effect resolution.

This protects the rule that effects resolve through the effect system rather
than scattered mechanic-side handler calls.

## 7. Stack/Queue Coverage

Queue tests cover the scheduled resolution item model, staged FIFO ordering,
caller-order normalization, FIFO consumption, nested work appended to the tail,
parent item metadata, depth tracking, empty queue behavior, and depth-bounded
no-op behavior.

Ordering is now asserted as an engine contract, not incidental array behavior.

## 8. Determinism and Reducer Integration Coverage

Reducer-level effect tests now assert that identical input state plus identical
action produces identical events, timing windows, and next state for the
triggered Persona Ride chain.

Blocked pending-request tests assert that unresolved engine-owned requests
return structured blocked results with no emitted events, no timing windows, and
no effect consequences.

## 9. Fixture Strategy

The tests use bounded domain fixtures rather than a large harness:

- minimal board states for ride/call/check scenarios;
- stable sample effect definitions from the core registry;
- sample keyword mappings for Boost, Intercept, Twin Drive, and Persona Ride;
- queue seeds for deterministic ordering and nested scheduling;
- pending request fixtures for blocked reducer paths.

The fixtures stay close to current engine contracts so failures point at real
domain seams.

## 10. What Is Still Not Covered

Not covered intentionally:

- exhaustive card-text parsing or card database coverage;
- full Standard / V Premium / Premium matrix for every future effect;
- final priority/conflict-resolution edge cases;
- full recursive trigger chains beyond the current bounded queue foundation;
- browser/UI/network behavior;
- full replay protocol serialization.

Those belong to later feature phases once the effect surface expands.

## 11. Current Risks

Severity: Medium  
Issue: Triggered resolution still contains an explicit supported-effect
dispatch list.  
Why it matters: Many more effects could turn this into a handler forest.  
Recommendation: Promote handler/operation dispatch into a small registered
resolver table before broad effect expansion.

Severity: Medium  
Issue: Twin Drive still uses a direct pre-check helper in the drive-check path.  
Why it matters: Pre-event modifiers need a more systemic timing hook.  
Recommendation: Add a pre-transition modifier phase before more check modifiers
arrive.

Severity: Medium  
Issue: Depth-bounded queue overflow currently behaves as no-op.  
Why it matters: Later nested chains may need an explicit invalid/blocked signal.  
Recommendation: Decide whether overflow should become a structured engine
result before supporting deeper chains.

## 12. Final Verdict

GO WITH CONDITIONS.

Phase 18 has meaningful domain tests around its load-bearing seams and can close
as an effect-system foundation. The listed medium risks should be addressed
before adding a large wave of card-specific effects or final priority semantics.
