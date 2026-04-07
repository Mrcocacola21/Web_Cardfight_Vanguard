# Card Identity and Normalization Policy

Status: Initial identity policy  
Last updated: 2026-04-07

## Why This Policy Exists

This policy defines what counts as "the same card" at each level of the system and how imported card data must be normalized.

It exists because the project has several different consumers of card data, and they do not all care about identity at the same level:

- deck building cares about gameplay identity;
- legality cares about gameplay identity plus format context;
- the catalog cares about both gameplay identity and printing history;
- collection and binder features care heavily about printing identity;
- future gameplay support must reference stable gameplay objects, not release-specific visuals;
- content ingestion must preserve source provenance without creating duplicate-card chaos.

If the system does not fix these identity levels early, the likely outcome is not one obvious bug. The likely outcome is long-term structural drift:

- catalog code treating printings as cards;
- deck lists mixing printings and gameplay cards;
- legality rules accidentally attaching to release-specific records;
- importer deduplication becoming manual and unreliable;
- collection and deck systems fighting over what a card reference means;
- future rules-engine code depending on printing data it should not need.

This document establishes the recommended model and the policy decisions that other architecture, importer, catalog, deck, legality, and gameplay work should follow.

## The Identity Problem We Need to Solve

In a TCG platform, "card" is an overloaded word.

One physical release may have:

- the same gameplay card printed in multiple sets;
- alternate art printings;
- promo versions;
- different rarity or foil treatments;
- localized printings;
- reprints in later products.

Those are different printings, but they are usually not different gameplay cards.

At the same time, a deck builder, legality checker, and future rules engine cannot work reliably if they reference whatever printing happened to be imported first. They need a stable gameplay-level identity.

The system therefore needs at least two explicit identity layers:

1. a gameplay-level normalized card identity;
2. a printing-level release identity.

It also needs one non-domain layer for ingestion provenance:

3. a raw source record identity.

Everything else should be built as a reference or projection over those layers rather than as new competing definitions of "card."

## Identity Layers

### 1. Raw Source Record

Definition: A source-specific imported record exactly as obtained from an external feed, scrape, file, or manual correction input.

Role in the system:

- preserves provenance;
- supports re-ingestion and auditing;
- gives importer logic something stable to map from;
- is not a gameplay, deck, or catalog identity.

Policy:

- raw source records are ingestion inputs, not domain truth;
- they must remain traceable after normalization;
- they must not be used directly by deck builder, legality, catalog, or gameplay systems.

### 2. Canonical Card

Definition: The primary normalized identity for a gameplay card in the system.

Role in the system:

- primary gameplay-level identity;
- primary legality target;
- primary deck reference target;
- default catalog-level card object;
- grouping parent for all linked printings of the same gameplay card.

Policy:

- a canonical card represents one gameplay card, not one physical printing;
- reprints, alt arts, promo printings, language variants, rarity variants, and other release-level differences normally map to the same canonical card;
- a canonical card is the main answer to "what card is this?" for gameplay, legality, and deck construction purposes.

### 3. Card Printing

Definition: A specific physical or release-specific printing of a canonical card.

Role in the system:

- links a card to product, set code, card number, rarity, language, art, and distribution origin;
- supports print history, provenance, collection ownership, binder views, and visual display preferences;
- does not redefine gameplay identity by default.

Policy:

- a card printing is always subordinate to a canonical card;
- printings are first-class records for catalog and collection use;
- printing identity should only affect gameplay or legality if a future explicit rule truly requires it.

### 4. Derived References and Projections

The following are not independent card identity layers:

| Concept            | What It Is                                                                     | What It Is Not                       |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------ |
| Catalog entry      | a search or browse projection over canonical card and optionally printing data | a new card identity                  |
| Deck reference     | a reference to a canonical card, optionally with a display-printing preference | a printing-level legality target     |
| Collection item    | an ownership record for a printing                                             | a gameplay card reference by default |
| Legality target    | the identity a legality rule attaches to, normally the canonical card          | a catalog page object                |
| Gameplay reference | the identity gameplay logic uses, normally the canonical card                  | a printing or source record          |

## Recommended Canonical Model

### Decision 1: Use a Two-Core-Identity Model

Decision:

- The system should use exactly two core card-domain identities: `canonical card` and `card printing`.

Rationale:

- This is the minimum model that cleanly separates gameplay identity from physical release identity.
- It satisfies catalog, legality, deck, collection, and future gameplay needs without introducing unnecessary intermediate layers.

Practical implication:

- Do not create a third persistent identity layer between canonical card and printing unless a real, separate domain need appears later.

### Decision 2: Treat `card entity` and `canonical card` as the Same Layer

Decision:

- `card entity` should not remain a separate concept from `canonical card`.
- The project should unify them into one primary term: `canonical card`.

Rationale:

- Keeping both as separate-looking terms without a true difference invites duplicate abstractions, duplicate types, and confused references.
- The review correctly identified this as a high-risk ambiguity.

Practical implication:

- In documentation and architecture discussions, prefer `canonical card`.
- If code later uses `card` or `card_entity`, it must mean the same thing as `canonical card`, not a different identity layer.

### Decision 3: Canonical Card Is Both Gameplay-Level Identity and Primary Catalog-Level Identity

Decision:

- The canonical card is the authoritative identity for gameplay, legality, and deck references.
- It is also the primary catalog card object.

Rationale:

- The catalog needs a stable object that groups printings together.
- Gameplay and legality need a stable non-printing identity.
- Those are the same requirement, not two different ones.

Practical implication:

- The default card page should be a canonical card page.
- Printing information should hang off that page as linked printings, not replace it.

### Decision 4: Catalog Entry Is a Projection, Not an Identity

Decision:

- `catalog entry` must remain a projection optimized for search and browse.

Rationale:

- Search and browse often need grouped views, summarized printings, or display-first fields.
- Those needs change faster than the underlying domain meaning of a card.

Practical implication:

- Catalog query models may aggregate canonical card plus printing summary data.
- They must not become the underlying domain identity for decks, legality, or gameplay logic.

## Gameplay-Level Identity Policy

### Decision 5: Different Printings of the Same Gameplay Card Share One Canonical Card

Decision:

- Multiple printings represent the same gameplay card when their gameplay-relevant identity is the same.

This normally includes:

- reprints;
- alt-art variants;
- promo printings;
- rarity variants;
- foil or finish variants;
- language variants;
- product-distribution variants such as event or box-topper printings.

Rationale:

- Deck legality, same-name checks, copy limits, and gameplay references should not depend on which artwork or release container a player owns.

Practical implication:

- These variations produce new `card printing` records, not new canonical cards.

### Decision 6: Printing-Level Differences Do Not Affect Gameplay Identity by Default

Decision:

- The following differences do not create a new canonical card by themselves:
- set code;
- card number;
- rarity;
- product family;
- product release;
- promo status;
- art variation;
- foil treatment;
- language;
- distribution channel.

Rationale:

- These are release attributes, not gameplay identity.

Practical implication:

- Deck legality and rules-engine references must not branch on these attributes unless a future explicit feature genuinely requires it.

### Decision 7: Material Gameplay Differences Create a Different Canonical Card

Decision:

- A new canonical card must be created when the imported record represents a materially different gameplay object.

This includes differences that change gameplay meaning, such as:

- materially different card type or subtype structure;
- materially different stats or traits that affect rules behavior;
- materially different normalized gameplay text or effect meaning;
- a distinct gameplay object that should be treated separately by deck, legality, or rules logic.

Rationale:

- The canonical card is a gameplay identity. If gameplay meaning changes, identity must not be forced together artificially.

Practical implication:

- Do not merge records only because names look similar or artwork is reused.
- If equivalence is unclear, route the case to manual review rather than forcing a merge.

## Printing Model

### Decision 8: Card Printing Is a Physical-Release Record, Not a Gameplay Card

Decision:

- A card printing must capture release-specific identity and provenance.

Printing-level data normally includes:

- product or set association;
- set code;
- card number;
- rarity;
- language;
- artwork or visual variant markers;
- promo or special-distribution status;
- source provenance.

Rationale:

- This is the level collectors and print-history views care about.
- It is also the level importer normalization must deduplicate reliably.

Practical implication:

- The system should be able to distinguish two printings of the same canonical card without turning them into separate gameplay identities.

### Decision 9: The Catalog Should Prefer Card Pages Over Printing Pages

Decision:

- The default catalog object should be the canonical card page.
- Printing pages may exist later as secondary or linked pages, but they should not replace the canonical card page as the primary card object.

Rationale:

- Most users searching for a card want the gameplay card first.
- Printing-level detail is important, but secondary for early companion-platform workflows.

Practical implication:

- Search should default to canonical-card results.
- Printing-focused browsing can be added as an advanced or collection-oriented mode later.

## Normalization and Ingestion Policy

### Normalization Flow

Imported data should be normalized in this sequence:

1. ingest the raw source record and preserve provenance;
2. identify or create the normalized printing record;
3. identify or create the canonical card the printing belongs to;
4. store source mappings from raw record to normalized records;
5. route uncertain matches to manual review instead of forcing low-confidence merges.

### Decision 10: A New Imported Record Creates a New Printing When Release Identity Is New

Decision:

- A raw imported record should become a new printing when it represents a distinct physical or release-specific appearance of a canonical card.

Typical indicators:

- different set code or product release;
- different card number within a release;
- distinct promo or special-distribution printing;
- different locale printing when locale matters to provenance;
- different art or explicitly distinct release variant.

Rationale:

- Printing-level identity is about release provenance and physical variation.

Practical implication:

- Two source records describing the same release printing should deduplicate to one printing record.
- Two source records describing different release instances of the same gameplay card should produce separate printings under one canonical card.

### Decision 11: A New Imported Record Maps to an Existing Canonical Card When Gameplay Identity Matches

Decision:

- A raw imported record should map to an existing canonical card when its gameplay-level identity matches that canonical card, even if the release details differ.

Rationale:

- Reprints and variants should enrich the print history of one gameplay card rather than multiply the deck and legality universe.

Practical implication:

- Importer matching must evaluate gameplay-level equivalence separately from printing-level uniqueness.

### Decision 12: Manual Review Is Mandatory for Uncertain Identity Matches

Decision:

- The importer must not auto-merge low-confidence records into a canonical card or printing.

Manual review is required when:

- multiple candidate canonical cards are plausible;
- same-name records disagree on gameplay-relevant fields;
- source data is incomplete or contradictory;
- it is unclear whether a difference is formatting, errata normalization, or a materially different card;
- a printing appears to duplicate an existing printing but provenance conflicts.

Rationale:

- Bad automatic merges are harder to recover from than pending review.

Practical implication:

- The system should maintain a manual review queue as a first-class ingestion safety mechanism.

### Decision 13: Preserve Provenance Even After Normalization

Decision:

- Normalization must preserve source mapping back to raw records.

Rationale:

- Provenance is needed for auditing, debugging, re-ingestion, correction, and trust.

Practical implication:

- Do not overwrite source detail into only the final normalized object without retaining traceability.

### Decision 14: Prefer Safe Deduplication Over Aggressive Deduplication

Decision:

- The importer should bias toward avoiding false merges, even if that means more manual review.

Rationale:

- False merges poison decks, legality, and catalog identity silently.
- Extra review is cheaper than rebuilding corrupted identity chains later.

Practical implication:

- Deduplication confidence must be explicit in importer logic and review policy, not assumed.

## Deck Reference Policy

### Decision 15: Decks Reference Canonical Cards, Not Printings

Decision:

- A deck entry should reference the canonical card as its authoritative card identity.

Rationale:

- Deck construction, legality, copy limits, same-name checks, and future gameplay references all operate on gameplay identity, not release identity.
- Printing-based deck references would make legality and deck comparison unnecessarily brittle.

Practical implication:

- Deck builder, deck storage, deck import/export logic, and legality systems should treat the canonical card as the card being played.

### Decision 16: Decks May Store an Optional Preferred Printing for Display

Decision:

- A deck entry may additionally store an optional preferred printing reference for presentation only.

Rationale:

- Users may want a deck list to show the exact art or printing they own or prefer.
- That is a display concern, not the underlying gameplay identity.

Practical implication:

- If the preferred printing is missing or unsupported later, the deck remains valid because its real reference is still the canonical card.
- UI can fall back from preferred printing to canonical-card display safely.

### Recommendation

Recommended deck-entry shape at the policy level:

- authoritative reference: canonical card;
- optional display preference: printing;
- never the reverse.

## Collection and Binder Policy

### Decision 17: Collection Tracks Printing-Level Ownership

Decision:

- Collection ownership should attach to card printings, not only to canonical cards.

Rationale:

- Collectors often care which printing they own, not just whether they own the gameplay card in the abstract.

Practical implication:

- Collection systems must be able to distinguish multiple printings of the same canonical card.

### Decision 18: Binder Views May Group by Canonical Card or by Printing

Decision:

- Binder and collection UI may offer both grouped and ungrouped views.

Rationale:

- Some users want a gameplay-card rollup; others want printing-specific inventory detail.

Practical implication:

- The underlying collection record should remain printing-level, while binder presentation can aggregate upward to canonical card when useful.

### Decision 19: Collection Concerns Must Not Redefine Deck or Legality Identity

Decision:

- Collection ownership detail must not become the card identity model for deck builder or legality.

Rationale:

- A player can build a legal deck from a gameplay perspective regardless of which art or promo version they own.

Practical implication:

- Collection and deck systems should share canonical-card grouping, but not the same reference policy.

## Legality and Restriction Attachment Policy

### Decision 20: Format Legality Attaches Primarily to Canonical Card Identity

Decision:

- Format legality should normally attach to the canonical card, evaluated within a validation context.

Rationale:

- Format legality is about whether the gameplay card is eligible in the format, not which artwork or rarity version exists.

Practical implication:

- Legality systems should not treat promo, alt-art, or set-specific printings as separate legality objects unless an explicit future rule requires it.

### Decision 21: Restriction Lists Should Target Canonical Cards or Explicit Gameplay Rule Keys

Decision:

- Restriction logic should target canonical-card identity by default.
- When a rule is conceptually name-based or combination-based, it should attach through an explicit gameplay-level rule key, not through printing identity.

Rationale:

- Restriction rules are part of gameplay and deck validation semantics.
- They should not accidentally depend on physical-release metadata.

Practical implication:

- Do not key restrictions to printing ids unless a real exception is explicitly modeled.

### Decision 22: Same-Name and Copy-Limit Checks Must Use Gameplay-Level Fields

Decision:

- Same-name checks and copy-limit checks must use canonical-card identity and its normalized gameplay-relevant fields, not printing ids.

Rationale:

- A player should not be able to bypass deck rules by mixing printings of the same gameplay card.

Practical implication:

- Rules modules may depend on canonical card identity, normalized gameplay name, and other gameplay-level fields.
- They must not depend on set code, rarity, or promo markers for ordinary deck rules.

## Rules Engine Compatibility

### Decision 23: Future Gameplay Engine Should Reference Canonical Card Identity

Decision:

- Future gameplay systems should use canonical-card identity as the default card reference in game state, actions, effect handlers, and rule evaluation.

Rationale:

- Gameplay logic needs stable identity independent of physical release variants.

Practical implication:

- A rules engine should not require printing ids to resolve ordinary gameplay behavior.

### Decision 24: Printing Data Is Informational to Gameplay Unless Explicitly Needed

Decision:

- Printing-specific data should be treated as informational to gameplay systems by default.

Rationale:

- Product, rarity, set code, and art are primarily catalog and collection concerns.

Practical implication:

- A future rules engine may read canonical-card gameplay fields and ignore printing-level metadata unless a truly explicit feature requires otherwise.

### Decision 25: Catalog Truth, Legality Truth, and Gameplay Truth Must Stay Distinct

Decision:

- Catalog, legality, and gameplay systems may share canonical-card identity, but they do not share the same kind of truth.

Rationale:

- Catalog truth describes what the card is and where it was printed.
- Legality truth describes whether it is allowed in a given validation context.
- Gameplay truth describes how it behaves in a game state.

Practical implication:

- Mechanic tags and keywords from the catalog may inform gameplay modules, but they do not replace explicit engine semantics.
- Legality results should not be used as a substitute for gameplay rules resolution.

## Examples

### Example 1: One Gameplay Card, Multiple Printings

- A card is printed in Booster Set A and later reprinted in Booster Set B.
- The system creates one canonical card.
- The system creates two printing records.
- Search can show one card result with two linked printings.
- A deck references the canonical card, not one of the two printings.

### Example 2: Promo Alt-Art of an Existing Card

- A promo release prints an alternate-art version of an existing gameplay card.
- The system keeps the same canonical card.
- The promo becomes a new printing linked to that canonical card.
- Legality and copy limits do not change because of the promo printing.
- A collection can show ownership of the promo specifically.

### Example 3: Deck Uses Gameplay Identity While Display Prefers a Printing

- A player adds a card to a deck.
- The deck entry stores the canonical card id.
- The player chooses a favorite promo art for deck display.
- The deck entry stores that promo printing as an optional preferred printing.
- If the preferred printing record is later unavailable, the deck remains valid and still resolves to the same canonical card.

### Example 4: Collection Tracks Multiple Printings of the Same Card

- A user owns two copies of one booster printing and one copy of a promo printing of the same gameplay card.
- The collection stores those as two printing-level ownership records.
- A binder view may show either one grouped canonical card with three owned copies total or two separate printing rows.

### Example 5: Ambiguous Imported Source Record

- A source record has the same visible name as an existing canonical card but conflicting gameplay-relevant text or incomplete product metadata.
- The importer cannot safely determine whether this is a reprint of the same gameplay card, a distinct gameplay card, or a duplicate malformed source record.
- The record is not auto-merged.
- It goes to manual review with full source provenance preserved.

## Final Recommended Terminology

Use the following terms consistently:

- `canonical card`
  The primary normalized card identity for gameplay, legality, decks, and primary catalog pages.

- `card printing`
  A release-specific physical printing linked to a canonical card.

- `raw source record`
  A source-specific imported record used for provenance and normalization, not for runtime domain identity.

- `catalog entry`
  A browse or search projection over canonical-card data and optionally printing summary data.

- `deck reference`
  A reference to a canonical card, optionally carrying a preferred printing for display.

- `collection item`
  A printing-level ownership record, optionally grouped upward by canonical card in presentation.

- `legality target`
  Normally the canonical card, or an explicit gameplay-level rule key derived from it.

- `gameplay reference`
  The canonical-card identity used by gameplay-aware systems.

Recommended terminology change:

- Do not keep `card entity` and `canonical card` as two separate architectural nouns.
- Use `canonical card` as the preferred explicit term in documents.
- If code later uses `card` or `card_entity`, it must mean the same thing as `canonical card`.

## Open Questions We Are Intentionally Leaving for Later

The following points are intentionally left open because they do not block the core identity policy:

- the exact handling policy for official errata when text changes are subtle but gameplay meaning may or may not shift;
- the exact treatment of token objects if tokens later become first-class catalog and gameplay records;
- whether printing pages should exist as dedicated routes in v1 or only as linked detail views;
- the final shape of collection quantity, condition, and trade metadata;
- the exact importer confidence-scoring method used to decide automatic merge vs manual review.

These are valid future decisions, but they should be solved on top of the identity model above rather than by reopening the identity model itself.
