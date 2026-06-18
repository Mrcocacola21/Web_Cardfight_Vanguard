# Pre-Phase 21 Playtest Bug Log Template

Use this file as the session note template for real Standard-slice human playtests. Duplicate the template per session or paste it into the team's issue tracker.

Do not mark a session as a human playtest unless two real players participated.

## Session Header

- Date:
- Operator:
- Environment:
- App commit/branch:
- Room id:
- Room path: `/matches/play/[roomId]`
- Player A profile/display name:
- Player B profile/display name:
- Player A deck:
- Player B deck:
- Matchup:
- Browser/device notes:
- Was a recovery drill attempted:
- Match result or stopping point:

## Session Checklist

- [ ] Both players signed in with separate accounts.
- [ ] Both players opened the same persisted `/matches/play/[roomId]` route.
- [ ] Both players confirmed their side, opponent, and deck assignment.
- [ ] Ready/start flow completed.
- [ ] At least one request/choice flow was observed.
- [ ] At least one battle flow was observed.
- [ ] At least one sync/recovery/stale condition was attempted or naturally occurred.
- [ ] Issues below include enough evidence to reproduce.

## Issue Entry

Copy this block for each finding.

```text
Issue id:
Date/session:
Room id/path:
Room revision / engine revision:
Matchup:
Deck(s):
Seat/perspective:
Turn/phase/request/battle context:

Category:
Severity:
Impact bucket:
Suggested next owner:

Reproduction steps:
1.
2.
3.

Expected behavior:

Actual behavior:

Player confusion or quote:

Evidence:
- screenshot:
- event/log excerpt:
- console/network note:
- related action/request label:

Workaround used:

Triage notes:
```

## Allowed Categories

- `rules bug`
- `UX bug`
- `sync bug`
- `clarity bug`
- `missing card/effect`
- `recovery issue`

## Severity

- `S0 blocker`: match cannot continue or authoritative state is corrupted.
- `S1 major`: match can continue only with operator help or a significant workaround.
- `S2 annoying`: players can continue but confusion or friction repeats.
- `S3 polish`: understandable but noticeably rough.

## Impact Bucket

- `blocker`
- `annoying`
- `polish`

## Suggested Owner

Use the most likely first owner:

- `rules-core`
- `match-session`
- `web match UI`
- `realtime/recovery`
- `deck/content`
- `db/storage`
- `unknown`

## Session Summary

- Biggest blocker:
- Most confusing prompt/request:
- Worst board readability moment:
- Worst sync/recovery moment:
- Most important missing effect/card behavior:
- Top three fixes before the next playtest:
  1.
  2.
  3.
