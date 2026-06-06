# Deck-Out Loss

## 1. Purpose

Make deck exhaustion a terminal gameplay result in rules-core. A required draw or check that cannot consume the required card count from a player's deck ends the match with that player defeated by deck-out.

## 2. Why deck-out is not just invalid draw

An invalid draw means the submitted command or referenced zones are malformed. Deck-out means a valid mandatory gameplay operation could not be completed because the player's deck did not contain enough cards. Realtime sessions must treat that as match end, not as a rejected command that leaves the room waiting for another action.

## 3. Canonical deck-out rule used now

For the currently supported Vanguard baseline, if a required operation must consume `N > 0` cards from an ordered multi-occupancy owned `deck` zone and the deck has fewer than `N` cards, the consuming player loses immediately by deck-out. No partial draw/check is applied.

Malformed zone references, wrong source zone kind, non-positive counts, missing player state, and already completed matches remain invalid or no-op according to their existing path.

## 4. Where deck-out is detected

The canonical runtime branch lives in `packages/rules-core/src/transitions/deck-out.ts`.

Callers first validate command shape and zone ownership. If the source is a valid deck and does not contain the required count, they call `resolveDeckOutLoss` instead of forwarding the generic insufficient-source result from `drawTopPiecesBetweenZones`.

## 5. Integration with draw/check/battle flow

Covered paths now include:

- explicit `zone.draw`;
- automatic draw phase consequence;
- drive check;
- damage check;
- declarative effect draw operations;
- trigger draw consequences routed through the trigger runtime helper.

When deck-out happens during battle, guard cleanup runs through the existing battle cleanup helper, `battle.completed` is emitted with reason `deck_out`, and the terminal state has no active `battle`.

## 6. Relationship to existing win-condition model

Deck-out uses the existing terminal model:

- losing player status becomes `defeated`;
- `GameState.status` becomes `completed`;
- `pendingRequests` is cleared;
- `player.defeated` is emitted with reason `deck_out`;
- `match.ended` is emitted with reason `deck_out`.

This matches damage defeat shape while preserving a distinct terminal cause.

## 7. What is intentionally NOT implemented yet

This step does not implement a full historical exception engine. It does not reinterpret arbitrary non-draw deck movements as deck-out unless they are already routed through the covered draw/check helpers. Resource operations such as soul charge keep their existing resource-specific validation until their rule semantics are standardized.

Mulligan replacement draw is guarded but should not normally deck-out under the current valid request contract because returned cards are placed into the deck before replacements are drawn. A structurally impossible mismatch still remains a request/zone integrity issue.

## 8. Summary

Deck-out is now engine truth for required deck draw/check depletion. It is observable, terminal, deterministic, and distinct from invalid command handling.
