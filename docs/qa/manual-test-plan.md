# Manual Test Plan

## 1. Purpose

This plan is for full manual validation of the local `Web_VG` runtime after a
fresh local bootstrap. It is intended to verify the implemented user-facing and
infra-facing surfaces end-to-end: startup, migrations, auth, profile/privacy,
catalog, deck builder, validation, social graph, match history, importer /
publication sanity, and owner-only route behavior.

## 2. Prerequisites

- Follow [manual-test-prep.md](./manual-test-prep.md) first.
- Use a fresh local DB reset for a clean run.
- Keep Docker Desktop running for the entire session.
- Run the app on `http://127.0.0.1:3000`.
- Use 3 separate browser contexts at the same time:
  - Context A: User A, main owner account
  - Context B: User B, future friend account
  - Context C: User C, stranger / declined-request account

## 3. Local environment startup

Use the exact commands from `docs/qa/manual-test-prep.md`.

Minimum ready-state before testing:

- `corepack pnpm typecheck` passes
- `corepack pnpm build` passes
- `corepack pnpm dev` starts cleanly
- local Supabase is running
- local DB has been reset
- Standard expansion and enrichment have been applied

## 4. Test accounts / identities / roles

Use unique emails for every clean run. Suggested pattern:

- User A: `qa.owner.<date>@example.com`
- User B: `qa.friend.<date>@example.com`
- User C: `qa.stranger.<date>@example.com`

Role intent:

- User A owns decks and match history
- User B becomes an accepted friend of User A
- User C remains a stranger and later declines one request from User A

Keep a scratch note with:

- User A profile URL
- User B profile URL
- User C profile URL
- User A deck URL

You will need those direct URLs once visibility settings stop exposing profiles
through `/users`.

## 5. Test data baseline

Expected local content baseline after prep:

- Synthetic cross-format seed:
  - `Azure Vanguard Dragon`
  - `Crimson V Blaster`
  - `Chrono Gate Strider`
  - baseline restriction examples for Standard, V Premium, and Premium
- Expanded Standard publication slice:
  - `Apex Ruler, Bastion`
  - `Apex-surpassing Sword, Bastion Prime`
  - `Fated One of Miracles, Rezael`
  - `Cerrgaon`
  - `Bringer of Protection, Cethlan`
  - `Lifesaving Angel, Kurabiel`
  - product pages for `D-SD03`, `DZ-BT01`, `DZ-LBT01`, `DZ-SS05`
  - keyword tags, legality facts, and printing variants

Expected empty baseline after reset:

- no app-created users
- no decks
- no friendships
- no match history

## 6. Areas to test

- Infra / startup / migrations
- Auth / protected route gating
- Profile foundation and privacy behavior
- Catalog list, detail, product, and printing navigation
- Deck creation, editing, autosave, duplicate, delete
- Validation feedback for Standard, V Premium, and Premium
- Social search, request, accept, decline, remove
- Match entry, history, filters, and stats
- Security / ownership / visibility / RLS-aligned route behavior

## 7. Detailed step-by-step manual scenarios

### INFRA-001

Area: Infra / startup / migrations

Preconditions: Repo root is open. Docker Desktop is running.

Steps:

1. Run the exact prep commands from `docs/qa/manual-test-prep.md`.
2. Start the app with `corepack pnpm dev`.
3. Open `/`, `/catalog`, `/login`, and `/register`.
4. Open Supabase Studio at `http://127.0.0.1:54323`.

Expected result: install, reset, expansion, typecheck, build, and `pnpm dev`
all complete successfully. Public routes render. Supabase Studio is reachable.

Notes: If the catalog only shows `Azure Vanguard ...` synthetic cards, the
expansion step was skipped.

### INFRA-002

Area: Infra / publication sanity

Preconditions: `INFRA-001` completed.

Steps:

1. Open `/catalog?q=bastion`.
2. Confirm `Apex Ruler, Bastion` appears in the result list.
3. Open `/catalog/card.fated-one-of-miracles-rezael`.
4. Open `/catalog/products/product.dz-bt01.dz-bt01-fated-clash`.

Expected result: expanded Standard publication data is present and readable
through the live app, not just through DB scripts.

Notes: This is the minimum importer/publication smoke check for manual QA.

### AUTH-001

Area: Auth / registration

Preconditions: `pnpm dev` is running. Local DB is fresh.

Steps:

1. In Context A, open `/register` and create User A.
2. In Context B, open `/register` and create User B.
3. In Context C, open `/register` and create User C.
4. Keep all three contexts signed in.

Expected result: all three accounts can be created locally without email
confirmation, and each context reaches `/profile`.

Notes: If a context lands back on `/login`, sign in once manually and continue.

### AUTH-002

Area: Auth / session behavior

Preconditions: `AUTH-001` completed.

Steps:

1. In Context A, while signed in, open `/login`.
2. Confirm the route redirects to `/profile`.
3. Click `Sign out`.
4. Open `/profile`.
5. Sign in again with User A credentials.
6. Open `/register` while signed in.

Expected result: signed-in auth pages redirect to `/profile`. Signed-out
protected routes redirect to `/login`. Sign-out and sign-in both work.

Notes: This is the manual equivalent of the local Playwright auth smoke.

### PROFILE-001

Area: Profile foundation

Preconditions: `AUTH-001` completed.

Steps:

1. In Context A, open `/profile`.
2. Save User A profile with a distinct display name, a short bio, profile
   visibility `public`, and bio visibility `public`.
3. Repeat step 2 for User B and User C in their own contexts.
4. In Context A, open `/users` and search for User B.
5. Open User B public profile in Context A and store the direct profile URL.
6. Repeat for User A and User C so you have all three profile URLs recorded.

Expected result: all three profile rows save successfully, show the saved data,
and are discoverable through `/users` while still public.

Notes: Save these direct URLs now. Later scenarios intentionally make some
profiles undiscoverable through `/users`.

### PROFILE-002

Area: Profile validation

Preconditions: `PROFILE-001` completed.

Steps:

1. In Context A, open `/profile`.
2. Enter an invalid avatar URL such as `not-a-url` and save.
3. Correct the avatar URL.
4. Set profile visibility to `friends`.
5. Set bio visibility to `public`.
6. Save again.
7. Restore User A profile visibility to `public` and bio visibility to
   `public`, then save.

Expected result: invalid avatar URL is rejected. Bio visibility broader than
profile visibility is rejected. Valid values save successfully.

Notes: Leave User A public at the end of this scenario so later social setup is
easy.

### CATALOG-001

Area: Catalog / list search and filters

Preconditions: `INFRA-002` completed.

Steps:

1. Open `/catalog`.
2. Set Format to `Standard`.
3. Search for `bastion`.
4. Apply the query and confirm the URL contains the search/filter state.
5. Refresh the page.
6. Clear the query and search for `rezael`.

Expected result: catalog queries round-trip through the URL, refresh cleanly,
and return imported Standard cards from the expanded dataset.

Notes: Use search plus navigation rather than the Set dropdown for expanded
products. The Set dropdown still reflects the smaller seed-era option list.

### CATALOG-002

Area: Catalog / card, product, and printing detail

Preconditions: `CATALOG-001` completed.

Steps:

1. Open `Apex Ruler, Bastion` card detail.
2. Verify keyword tags and legality facts are present.
3. From the Bastion page, open the related product page for `D-SD03`.
4. From the product page, open the printing detail for Bastion.
5. From the printing page, navigate back to the canonical card page.
6. Open `Fated One of Miracles, Rezael` and verify the choice restriction note.
7. Open `Cerrgaon` and verify the same Standard choice restriction appears.

Expected result: card, product, and printing routes all render. Bastion shows
keyword/mechanic tags. Rezael and Cerrgaon show published Standard choice
restriction facts. Links between catalog surfaces are not broken.

Notes: This is the main manual check for publication readability in the live
catalog.

### DECK-001

Area: Deck builder / create and open

Preconditions: User A is signed in.

Steps:

1. In Context A, open `/decks`.
2. Create a new `Standard` deck.
3. Confirm you land on `/decks/<deckId>`.
4. Copy the deck URL into your scratch note.
5. Return to `/decks`.

Expected result: an empty owner-owned deck is created, the builder opens, and
the deck appears in User A's deck list.

Notes: User A's first deck URL is reused later for owner-only access checks.

### DECK-002

Area: Deck builder / autosave and deck management

Preconditions: `DECK-001` completed.

Steps:

1. Reopen User A's Standard deck.
2. Rename it to `QA Standard Deck`.
3. Add a description.
4. Mark it as favorite.
5. Add two tags.
6. Wait for the `Saved` state.
7. Refresh the page.
8. Confirm the updated metadata persists.
9. Return to `/decks`.
10. Duplicate the deck.
11. Confirm the duplicate appears in the list.
12. Delete the duplicate.

Expected result: metadata autosaves without an explicit save button, the saved
state survives refresh, duplicate works, and delete removes only the targeted
deck.

Notes: The original Standard deck should remain available for later scenarios.

### VALIDATION-001

Area: Deck validation / Standard baseline

Preconditions: `DECK-001` and the Standard expansion baseline are available.

Steps:

1. Open User A's Standard deck.
2. Search `bastion`.
3. Add one copy of `Apex Ruler, Bastion`.
4. Watch the validation panel.

Expected result: the card is added and autosaved. The validation panel reports
Standard issues such as missing ride-deck structure and/or an undersized main
deck.

Notes: This is expected. The current builder UI adds cards to the main section
only and does not yet provide ride-deck placement controls.

### VALIDATION-002

Area: Deck validation / Standard restriction reactions

Preconditions: `VALIDATION-001` completed.

Steps:

1. In the same Standard deck, search `rezael` and add one copy of
   `Fated One of Miracles, Rezael`.
2. Search `cerrgaon` and add one copy of `Cerrgaon`.
3. Inspect the validation panel again.

Expected result: validation includes `choice-restriction-violated` for the
Rezael plus Cerrgaon pair. Other Standard structural errors may still remain.

Notes: This is the main UI-level Standard restriction sanity check.

### VALIDATION-003

Area: Deck validation / V Premium

Preconditions: User A is signed in.

Steps:

1. Create a new `V Premium` deck.
2. Search `crimson v blaster`.
3. Add one copy of `Crimson V Blaster`.
4. Inspect the validation panel.

Expected result: validation shows a V Premium legality or restriction problem
for `Crimson V Blaster`. The deck stays editable.

Notes: Undersized main-deck issues may also appear because the deck is still
mostly empty.

### VALIDATION-004

Area: Deck validation / Premium

Preconditions: User A is signed in.

Steps:

1. Create a new `Premium` deck.
2. Search `chrono gate strider` and add one copy of `Chrono Gate Strider`.
3. Verify the validation panel flags the G-eligible card in the main deck.
4. Search `azure vanguard dragon` and add one copy.
5. Search `crimson v blaster` and add one copy.
6. Inspect the validation panel again.

Expected result: Premium validation reports the main-deck G-unit issue for
`Chrono Gate Strider` and a choice-restriction issue for the
`Azure Vanguard Dragon` plus `Crimson V Blaster` pair.

Notes: A dedicated UI for building a real G deck is not present yet.

### SOCIAL-001

Area: Social / request creation

Preconditions: `PROFILE-001` completed. User A and User B are public.

Steps:

1. In Context A, open `/users`.
2. Search for User B.
3. Open User B's public profile.
4. Send a friend request.
5. Open `/friends` in Context A.
6. Open `/friends` in Context B.

Expected result: User A sees an outgoing pending request. User B sees an
incoming pending request from User A.

Notes: Do not accept it yet in Context A. Acceptance happens in the next
scenario from User B's side.

### SOCIAL-002

Area: Social / request acceptance

Preconditions: `SOCIAL-001` completed.

Steps:

1. In Context B, open `/friends`.
2. Accept User A's incoming request.
3. Refresh `/friends` in Context A.
4. Open User A's profile URL in Context B.
5. Open User B's profile URL in Context A.

Expected result: A and B appear as active friends in both dashboards. Each
other's public profile shows the friend relationship state instead of a pending
request state.

Notes: Keep A and B as active friends until the match and privacy scenarios are
finished.

### MATCH-001

Area: Match history / manual entry

Preconditions: `SOCIAL-002` completed. User A has at least one saved deck.

Steps:

1. In Context A, open `/matches/new`.
2. Search for User B in the opponent search panel.
3. Select User B.
4. Choose User A's Standard deck.
5. Save one match with result `Win` and a short note.

Expected result: the match saves successfully and stays owner-owned by User A.

Notes: The opponent must be selected from the visible-profile search, not typed
free-form.

### MATCH-002

Area: Match history / list and filters

Preconditions: `MATCH-001` completed.

Steps:

1. In Context A, open `/matches`.
2. Confirm the newly recorded row appears.
3. Filter by result `Win`.
4. Filter by User B's display name in the opponent search.
5. Filter by User A's Standard deck.
6. Filter by format `Standard`.
7. Reset all filters.
8. Open the deck link from the match row.
9. Open the opponent profile link from the match row.

Expected result: the match history filters work, reset works, and the row links
to the deck and opponent profile correctly.

Notes: Match history is owner-only. Only User A should see User A's matches.

### MATCH-003

Area: Match history / stats

Preconditions: `MATCH-001` completed and A/B friendship is still active.

Steps:

1. In Context A, open `/matches/stats`.
2. Confirm total matches, wins, and win rate are non-zero.
3. Confirm a top deck entry is shown.
4. Open `/matches/friends`.
5. Select User B if not already selected.

Expected result: personal stats show the recorded match, and friend-opponent
stats show User B as a current friend with tracked matches.

Notes: Run this before removing the A/B friendship. The route is scoped to
current active friends only.

### SECURITY-001

Area: Security / protected routing

Preconditions: App is running.

Steps:

1. In a fresh signed-out browser window, open `/profile`.
2. In the same signed-out window, open `/decks`.
3. In Context A, while signed in, open `/login`.
4. In Context A, open `/register`.

Expected result: signed-out protected routes redirect to `/login`. Signed-in
auth routes redirect to `/profile`.

Notes: This is the manual protected-route sanity check.

### SECURITY-002

Area: Security / owner-only deck behavior

Preconditions: `DECK-001` completed and User A deck URL is recorded.

Steps:

1. In Context B, paste User A's deck URL directly.
2. In Context C, paste User A's deck URL directly.

Expected result: both non-owner contexts see `Deck not found`. Neither can open
or edit User A's deck through the UI.

Notes: This is the main owner-only deck route check.

### SECURITY-003

Area: Security / privacy and visibility matrix

Preconditions: `SOCIAL-002` completed. User A and User B are active friends.

Steps:

1. In Context A, open `/profile`.
2. Set User A profile visibility to `public` and bio visibility to `public`.
3. In Context B and Context C, open User A's saved profile URL.
4. Confirm both contexts can view the profile and bio.
5. In Context A, change visibility to `friends` and bio visibility to
   `friends`, then save.
6. In Context B, reopen User A's profile URL.
7. In Context C, reopen User A's profile URL.
8. In Context A, keep visibility `friends` but change bio visibility to
   `private`, then save.
9. In Context B, reopen User A's profile URL again.
10. In Context A, change profile visibility to `private`, then save.
11. In Context B and Context C, reopen User A's profile URL again.

Expected result: public visibility is readable by both B and C. Friends-only
visibility is readable by B but not C. Friends-only bio is readable by B. A
private bio remains hidden even from B. A private profile becomes `Public
profile not found` for both B and C.

Notes: This is the main manual privacy / visibility sanity check.

### SOCIAL-003

Area: Social / decline flow

Preconditions: `PROFILE-001` completed. User C is still public and not friends
with User A.

Steps:

1. In Context A, search for User C and send a friend request.
2. In Context C, open `/friends`.
3. Decline User A's request.
4. In Context A, reopen User C's profile URL.

Expected result: the request disappears from User C's incoming queue. User A no
longer sees a send button for User C and instead sees the historical locked
relationship state.

Notes: Re-send is not implemented after a declined historical relationship.

### SOCIAL-004

Area: Social / remove friend

Preconditions: `MATCH-003` and `SECURITY-003` completed. User A and User B are
still active friends.

Steps:

1. In Context A, open `/friends`.
2. Remove User B from the active friends list.
3. Refresh `/friends` in Context B.
4. In Context A, reopen User B's profile URL.

Expected result: the active friendship disappears from both dashboards. User A
no longer has an active friend state with User B and sees the historical
relationship lock instead.

Notes: After this step, `/matches/friends` should no longer treat User B as a
current friend.

## 8. Optional deep checks

Run these only if a UI result looks suspicious and you want a local DB sanity
check.

```powershell
docker exec supabase_db_Web_VG psql -U postgres -d postgres -c "select official_code, canonical_key from catalog.products where official_code in ('D-SD03','DZ-BT01','DZ-LBT01','DZ-SS05') order by official_code;"

docker exec supabase_db_Web_VG psql -U postgres -d postgres -c "select canonical_key, name from catalog.card_entities where canonical_key in ('card.apex-ruler-bastion','card.fated-one-of-miracles-rezael','card.cerrgaon','card.azure-vanguard-dragon','card.crimson-v-blaster','card.chrono-gate-strider') order by canonical_key;"

docker exec supabase_db_Web_VG psql -U postgres -d postgres -c "select display_name, visibility, bio_visibility from user_data.profiles order by created_at desc limit 10;"

docker exec supabase_db_Web_VG psql -U postgres -d postgres -c "select title, format_id, owner_profile_id from user_data.decks order by updated_at desc limit 10;"

docker exec supabase_db_Web_VG psql -U postgres -d postgres -c "select requester_profile_id, recipient_profile_id, status from social.friend_relationships order by created_at desc limit 10;"

docker exec supabase_db_Web_VG psql -U postgres -d postgres -c "select result, played_at, owner_profile_id from social.matches order by created_at desc limit 10;"
```

## 9. Known limitations / caveats

- The Standard deck builder currently adds new cards to the main section only.
  There is no UI yet to populate the ride deck, so fully valid Standard deck
  construction from an empty shell is not currently possible through the UI.
- The Premium builder has the same limitation for the G deck. You can validate
  G-eligible cards in the wrong section, but not build a true G deck manually.
- The catalog Set dropdown still reflects the smaller sample option list. Use
  search and detail-page navigation for the expanded `D-SD03` / `DZ-*` slices.
- Public deck lists and activity panes on `/users/[profileId]` are placeholders.
- Friend request cancel/resend and reconnect-after-history flows are not
  implemented.
- Match history is owner-owned only. Recording a match against another profile
  does not create a shared bilateral record.

## 10. Expected pass criteria

- Local install, Supabase start, DB reset, expansion, typecheck, build, and dev
  startup are reproducible.
- Public routes render and protected routes gate correctly.
- User A, User B, and User C can register and sign in locally.
- Profile saves, validation, privacy, and public visibility behave as described.
- Expanded catalog content is visible through list, card, product, and printing
  pages.
- Deck creation, autosave, duplicate, and delete all work for the owner.
- Validation panel reports the expected Standard, V Premium, and Premium issues
  for the documented card combinations.
- Friend request send, accept, decline, and remove all behave correctly within
  the implemented scope.
- Manual match entry, history filters, personal stats, and current-friend stats
  all work for User A.
- Non-owners cannot open another user's deck route, and hidden profiles stay
  hidden from the wrong viewer category.
