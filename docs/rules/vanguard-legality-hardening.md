# Vanguard Legality Hardening

## 1. Purpose

This step moves obvious Vanguard legality from prototype/UI convention into engine truth. Normal ride, normal call, and first-turn attack restrictions are now rejected by the reducer even if a caller submits the action directly.

## 2. Why these legality holes had to be closed now

Realtime/session layers must not synchronize blatantly illegal game states. Before this step, ride/call transitions mainly checked zones and phase, while attack declaration did not block the first player's first turn. That left core gameplay validity dependent on caller behavior.

## 3. Ride grade rules

`card.ride` is treated as the current normal ride path. The core engine resolves card stats for the riding card and current vanguard:

- if there is no current vanguard, the first vanguard must be grade 0;
- otherwise the ride card must be the same grade as the current vanguard or exactly one grade higher;
- missing stats, non-unit cards, or missing vanguard references fail before mutation.

Format adapters still decide format-owned source constraints, such as Standard riding from the ride deck or V Premium rejecting ride deck references.

## 4. Call grade rules

`card.call` is treated as the current normal call-from-hand path. The core engine resolves the called card and current vanguard through engine card stats. A normal call is legal only when the called unit grade is less than or equal to the acting player's current vanguard grade.

Future superior call effects should use an explicit special effect/action path rather than weakening this normal call rule.

## 5. First-turn attack restriction

`battle.declare_attack` now rejects attacks while `turn.turnNumber === 1`. In the current turn model, turn 1 is the first player's first turn; turn 2 is the second player's first turn and can attack if all other battle rules pass.

## 6. Core vs adapter responsibility

Core owns common Vanguard legality for normal ride/call and first-turn attack. Adapters own format-specific policy around zones, construction-era features, and extra requests. This keeps baseline legality centralized without forcing every future format exception into the same branch.

## 7. Failure semantics

Illegal grade progression returns `ride_grade_restricted`. Illegal higher-grade normal calls return `call_grade_restricted`. First-turn attacks return `attack_first_turn_restricted`. Missing or malformed card stats/vanguard references return `invalid_action_reference`. These failures are deterministic, structured, and leave state/events unchanged.

## 8. What is intentionally NOT implemented yet

This step does not implement superior ride, superior call, complete special-card exceptions, all era-specific ride rules, full attack target legality across every format nuance, or a general legality DSL. Those should be added as explicit special paths or adapter refinements later.

## 9. Summary

The engine now rejects obvious illegal normal rides, normal calls, and first-player first-turn attacks. Action availability remains downstream of reducer truth by probing real commands, and the local prototype was adjusted to choose legal board-action candidates where possible.
