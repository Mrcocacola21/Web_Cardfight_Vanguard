# Manual Standard Slice Test Guide

## 1. Purpose

This guide explains how a normal signed-in tester can manually test the six Pre-Phase 21 Standard slice decks:

- Reguregnus
- Heartluru
- Youthberk
- Prison
- Vyrgilla
- Kairi

The guide tests the practical product path: create or open prepared QA decks, create a persisted match room from a selected deck, enter `/matches/play/[roomId]`, and play through the projected multiplayer UI. It is not a claim that the six competitive DeckLog lists are fully imported with exact printed text.

Root cause of the original tester gap: the six slice decks existed in docs, rules-core handlers, and match-session test fixtures, but their cards were not published as user-facing catalog cards/printings. The deck builder searches `catalog.card_entities` through Standard product-family printings; it does not read rules fixtures. Collection ownership was not the blocker.

## 2. Preconditions

Run from the repo root.

```powershell
cd C:\codes\Web_VG
corepack pnpm install
corepack pnpm dev:up
corepack pnpm dev:reset
```

Create `apps/web/.env.local` with the local Supabase values. The QA deck bootstrap requires the service-role key because it publishes the missing QA catalog cards before creating saved decks for the current user.

```powershell
$supabaseEnv = corepack pnpm dlx supabase@2.88.0 status -o env
$apiUrl = ($supabaseEnv | Select-String '^API_URL=').Line.Split('"')[1]
$publishableKey = ($supabaseEnv | Select-String '^PUBLISHABLE_KEY=').Line.Split('"')[1]
$serviceRoleKey = ($supabaseEnv | Select-String '^SERVICE_ROLE_KEY=').Line.Split('"')[1]
@"
NEXT_PUBLIC_APP_ORIGIN=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=$apiUrl
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishableKey
SUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey
ENABLE_STANDARD_SLICE_QA_BOOTSTRAP=true
"@ | Set-Content apps/web/.env.local
```

Then start the app.

```powershell
corepack pnpm dev
```

Open `http://127.0.0.1:3000/register`, create a normal user, then open `/profile` once so the profile row exists. Create a second normal user in a different browser profile or incognito window if you want to check realtime/multiplayer behavior.

Readiness check:

- `/decks` loads for the signed-in user.
- The page header shows `Create QA slice decks` in local/dev.
- If that button is missing, confirm `ENABLE_STANDARD_SLICE_QA_BOOTSTRAP=true` or that `NODE_ENV` is not production.
- If the button errors, confirm `SUPABASE_SERVICE_ROLE_KEY` is present in `apps/web/.env.local`.

## 3. How to Access the 6 Decks

1. Sign in as the QA user.
2. Open `http://127.0.0.1:3000/decks`.
3. Click `Create QA slice decks`.
4. After redirect, keep the `Standard` filter selected.
5. Open each deck named `[QA] Standard Slice - ...`.
6. Use `Start match` on the deck card or open `/matches/start?deckId=<deck id>`.

The bootstrap is idempotent. Clicking it again skips already-created QA decks with the same titles.

| Deck       | Where to find it                             | Manual build needed | Notes                                                                                                    |
| ---------- | -------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| Reguregnus | `/decks`, `[QA] Standard Slice - Reguregnus` | No                  | Publishes QA catalog cards such as `Reguregnus`, `Call of the Deep Lands`, and `Reguregnus Replacement`. |
| Heartluru  | `/decks`, `[QA] Standard Slice - Heartluru`  | No                  | Includes set orders, soul-call targets, and Heartluru attack threshold refs.                             |
| Youthberk  | `/decks`, `[QA] Standard Slice - Youthberk`  | No                  | Includes `Youthberk` and `Youthberk RevolForm`.                                                          |
| Prison     | `/decks`, `[QA] Standard Slice - Prison`     | No                  | Includes `Aurora Battle Princess, Seraph Snow`, `Galaxy Central Prison`, and release carrier.            |
| Vyrgilla   | `/decks`, `[QA] Standard Slice - Vyrgilla`   | No                  | Includes `Vyrgilla` and `Vyrgilla Rewrite Form`.                                                         |
| Kairi      | `/decks`, `[QA] Standard Slice - Kairi`      | No                  | Includes `Astesice, Kairi` and replay targets.                                                           |

After bootstrap, the cards are also visible in the deck builder/catalog search because they are real catalog rows with Standard product printings.

## 4. Deck-by-Deck Manual Test Checklist

### Reguregnus

- Expected identity: Stoicheia drop/order deck for drop calls, energy costs, and battle replacement.
- Before match: confirm 50 main, 4 ride, Standard format, and cards named `Reguregnus`, `Call of the Deep Lands`, `Reguregnus Replacement`.
- In match: ride to grade 3, create drop targets, call rear-guards, and enter battle with Reguregnus.
- Signature interactions: Call from drop, order-zone placement, energy/counterblast cost visibility, battle replacement from drop.
- Success: player understands which drop cards are legal targets and which Reguregnus is attacking after replacement.
- Known bounded assumptions: exact Athanasios/support text is represented by bounded QA fixture behavior.

### Heartluru

- Expected identity: Dark States set-order deck for order count, soul call, and attack thresholds.
- Before match: confirm 50 main, 4 ride, Standard format, Heartluru, four set orders, and soul-call targets.
- In match: place several orders, stage soul targets if possible, attack with Heartluru after order count builds.
- Signature interactions: energy-blast soul call, order-count attack pressure, visible power/critical context.
- Success: player can tell how many orders matter and why Heartluru pressure changed.
- Known bounded assumptions: full Happy Toys taxonomy and exact support package are not complete.

### Youthberk

- Expected identity: Keter Sanctuary form-change deck for Revoldress and battle continuation.
- Before match: confirm 50 main, 4 ride, Standard format, `Youthberk`, and `Youthberk RevolForm`.
- In match: ride Youthberk, keep RevolForm available if possible, activate form change in battle.
- Signature interactions: previous vanguard binds, RevolForm becomes vanguard, battle context remains clear.
- Success: player can see the current attacker and the old vanguard location after replacement.
- Known bounded assumptions: one bounded RevolForm stands in for the broader Exist/Rebuild package.

### Prison

- Expected identity: Brandt Gate control deck for opponent-card movement and prison count.
- Before match: confirm 50 main, 4 ride, Standard format, Seraph Snow, Galaxy Central Prison, release carrier.
- In match: establish prison/order zone, capture an opponent card if available, then test release and Seraph attack pressure.
- Signature interactions: opponent legal target selection, prison zone readability, release to owner rear-guard, attack scaling.
- Success: player can distinguish prison from bind/drop/damage and can explain what is captured.
- Known bounded assumptions: full Purelight/Clearlight menu is outside this slice.

### Vyrgilla

- Expected identity: Dragon Empire rewrite deck for vanguard replacement, opponent bind, and standing own board.
- Before match: confirm 50 main, 4 ride, Standard format, `Vyrgilla`, and `Vyrgilla Rewrite Form`.
- In match: ride Vyrgilla, create own and opposing rear-guard targets, activate rewrite during battle.
- Signature interactions: bind previous vanguard, bind opponent rear-guard, stand own rear-guards, preserve battle context.
- Success: player can see what moved, what stood, and who is currently attacking.
- Known bounded assumptions: MateUnit and Ultimate Skill branches remain bounded.

### Kairi

- Expected identity: Lyrical Monasterio bounce/replay deck for target choice and repeated board movement.
- Before match: confirm 50 main, 4 ride, Standard format, `Astesice, Kairi`, and replay targets.
- In match: ride Kairi, build two rear-guards, use bounce/replay choices, then attack.
- Signature interactions: choose rear-guards to return, energy-blast replay, replayed-unit power context.
- Success: selected targets and replay destinations remain clear after cards move.
- Known bounded assumptions: same-column restanders and persona-sensitive branches remain bounded.

## 5. Match Flow Test Instructions

For each QA deck:

1. Open `/decks`.
2. Click `Start match` on the target `[QA] Standard Slice - ...` deck.
3. On `Start Match Room`, search for a visible opponent profile.
4. Select the opponent.
5. Click `Start match room`.
6. Confirm the browser opens `/matches/play/[roomId]`.
7. Confirm the selected deck title/card identity is visible through the match state.
8. Play the setup flow: ready/start, mulligan, ride, draw, call, battle, guard/no-guard where available.
9. Watch every request/choice prompt: legal targets must be visually obvious and selected state must be clear.
10. Continue until win/loss or until a blocker is found.

Current product-flow limit: the selected QA deck is used by the room creator. The second participant currently receives the server Standard sparring deck. To test all six decks, create one room per QA deck as the room creator. This still supports two-human realtime checks, but it is not yet full two-sided deck submission.

## 6. Realtime / Multiplayer Checks

Use two different accounts in two browser profiles.

1. Account A creates or opens the six QA decks.
2. Account B creates a profile and makes it visible/searchable.
3. Account A opens a QA deck and starts a room against Account B.
4. Account A keeps the redirected `/matches/play/[roomId]`.
5. Account B opens the same room URL while signed in.
6. Verify both players see their own perspective and no hidden hand information from the other side.
7. Account A performs one legal action; Account B should see the board update after refresh/poll/realtime update.
8. Account B performs one legal action if available for their seat.
9. Refresh one browser during a pending request; the player should recover into the same room with visible context.
10. Try submitting an action from an old tab after the other browser has advanced the room; stale/blocked feedback should be understandable.

Record whether updates arrive automatically or require refresh. Do not treat manual refresh as a pass for realtime UX; log it as sync/recovery friction if the player would be confused.

## 7. Known Limits

- The QA decks are bounded Standard slice fixtures, not exact competitive DeckLog imports.
- Some card names are simplified QA names so testers can identify the slice behavior quickly.
- Full printed-text completeness is not claimed.
- The current product room flow chooses one submitted player deck and a server sparring deck for the opponent.
- Full matchmaking and two-sided deck submission are not implemented in this guide.
- Some edge cards, defensive cards, and tech package branches remain outside the slice.
- If the QA bootstrap button is disabled in production, run this guide in local/dev or set the explicit env flag in the QA environment.

## 8. Bug Reporting Template

```text
Deck:
Room id/path:
User/profile:
Seat/perspective:
Step:
Turn/phase/request/battle context:
Expected:
Actual:
Severity: S0 blocker / S1 major / S2 annoying / S3 polish
Category: rules bug / UX bug / sync bug / clarity bug / missing card/effect / recovery issue
Screenshot/video:
Room revision / engine revision:
Workaround:
Notes:
```

Use `docs/qa/pre-phase-21-playtest-bug-log-template.md` for full session notes.
