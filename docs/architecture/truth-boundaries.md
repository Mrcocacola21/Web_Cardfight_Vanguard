# Truth Boundaries

Status: Boundary note  
Last updated: 2026-04-07

## Why This Note Exists

This note defines the three truth layers the platform must keep separate:

- `catalog truth`
- `legality truth`
- `gameplay truth`

This separation is necessary because Cardfight!! Vanguard is not a single-layer domain. The platform must model:

- content objects and print history;
- format-specific admissibility and restriction logic;
- runtime match state and rules behavior.

Those concerns evolve at different speeds, depend on different inputs, and serve different parts of the product. If they are merged into one blurred notion of "card truth," the architecture will drift into hidden coupling and false assumptions.

Typical failure modes this note is meant to prevent:

- treating "present in catalog" as equivalent to "legal in a format";
- treating "deck passed legality checks" as equivalent to "gameplay support is complete";
- treating "effect logic exists" as proof that catalog identity and printing data are already modeled correctly;
- treating "different printing exists" as equivalent to "different gameplay card."

This document is intentionally architectural rather than implementation-specific. It defines which layer is allowed to assert which kind of truth.

## The Three Truth Layers

The platform should explicitly recognize three separate truth layers:

| Truth Layer      | Core Question                                                   | Primary Inputs                                                                    | Primary Outputs                                                            |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `catalog truth`  | What is this content object in the system?                      | normalized card identity, printings, products, imported metadata                  | canonical cards, printings, product relationships, display/search metadata |
| `legality truth` | May this deck or card be used under a declared format contract? | format profile, restriction baseline, deck structure, canonical-card identity     | legality findings, support-state-aware legality results                    |
| `gameplay truth` | What can happen in the current match state?                     | runtime state, actions, effects, format gameplay profile, canonical-card identity | valid or invalid actions, state transitions, event log, resolved effects   |

### Decision 1: The Platform Has Three Distinct Truth Layers

Decision:

- The system should treat catalog truth, legality truth, and gameplay truth as separate domain contracts.

Rationale:

- Each layer answers a different question.
- Each layer evolves on a different delivery timeline.
- Each layer needs different ownership and testing strategies.

Practical implication:

- No module should assume that truth from one layer automatically implies truth in another layer.

## Catalog Truth

Catalog truth answers the question:

- "What is this content object and how is it described in the system?"

Catalog truth includes:

- canonical card identity;
- printing identity;
- product, set, and product-family relationships;
- card name, card text, grade, nation, clan, card type, and other catalog metadata;
- rarity, card number, release metadata, and visual metadata;
- searchable and displayable metadata;
- source provenance and normalized source mappings.

### Decision 2: Catalog Truth Owns Content Description, Not Admissibility or Runtime Behavior

Decision:

- Catalog truth is responsible for describing cards and related product content as normalized domain objects.

Rationale:

- The catalog must be able to answer what a card is, where it came from, and how it should be found or displayed.
- That is different from deciding whether the card is allowed in a deck or how it behaves in a match.

Practical implication:

- Catalog modules may expose card text, traits, and product lineage.
- They must not be treated as the final authority on deck legality or runtime gameplay semantics.

### Decision 3: Card Text Is Catalog Data Before It Becomes Legality or Gameplay Interpretation

Decision:

- Printed card text belongs to catalog truth as stored content data.

Rationale:

- The platform needs to preserve the content as published, regardless of how much legality or gameplay logic is implemented.

Practical implication:

- Storing effect text in the catalog does not mean the legality layer or gameplay layer already interprets that text fully.

### Decision 4: Catalog Presence Does Not Imply Legal or Playable Support

Decision:

- A card may exist in catalog truth even when legality support or gameplay support for it is partial or absent.

Rationale:

- Catalog coverage will often expand earlier and faster than legality or gameplay support.

Practical implication:

- UI and API must not derive format legality or gameplay support directly from catalog inclusion.

## Legality Truth

Legality truth answers the question:

- "May this deck, list, or card be used within a declared format contract and known rule baseline?"

Legality truth includes:

- format eligibility;
- allowed card-pool interpretation;
- deck construction rules;
- deck section rules such as ride deck or G deck requirements;
- copy limits and same-name or same-card constraints;
- restriction-list entries and their effects;
- support-state-aware legality evaluation;
- legality findings and completeness-aware legality results.

### Decision 5: Legality Truth Owns Admissibility Under Known Format and Restriction Contracts

Decision:

- Legality truth is the layer that decides whether a deck or card is admissible within a specific validation context.

Rationale:

- Admissibility depends on format profile, restriction baseline, support state, and declared validation scope.
- It is not a property of catalog data alone.

Practical implication:

- Restriction decisions and format-specific construction checks belong in legality modules, not catalog modules.

### Decision 6: Legality Truth May Be Partial Even When Catalog Truth Is Complete

Decision:

- The system may know a card perfectly as content while still lacking full legality coverage for some format, restriction family, or special rule.

Rationale:

- Catalog completeness and legality completeness are separate maturity dimensions.

Practical implication:

- A rich catalog page is not evidence that the deck builder can assert `legal` or `illegal` for every relevant format scenario.

### Decision 7: Legality Truth Must Not Be Treated as Runtime Match Truth

Decision:

- A legality result is a pre-game admissibility statement, not a runtime action or effect guarantee.

Rationale:

- Legality evaluates deck construction and restriction compliance.
- Gameplay evaluates actions, timing, costs, and state transitions inside a match.

Practical implication:

- Passing legality validation must not be used as a shortcut to skip gameplay validation later.

## Gameplay Truth

Gameplay truth answers the question:

- "What is happening in the current match, and which state transitions are allowed now?"

Gameplay truth includes:

- game state and player state;
- zones and zone contents;
- phases, turns, and timing windows;
- actions and action validation;
- costs, choices, and resolutions;
- effects and effect handlers;
- event log and gameplay snapshots;
- authoritative runtime state transitions.

### Decision 8: Gameplay Truth Owns Runtime State and Runtime Rules

Decision:

- Gameplay truth is the only layer allowed to authoritatively decide whether a runtime action, effect, or state transition is legal in the current match.

Rationale:

- Runtime legality depends on current state, timing, cost payment, effect resolution order, and other contextual facts that do not belong to catalog or deck legality.

Practical implication:

- React components, deck-builder logic, and catalog services must not become de facto gameplay engines.

### Decision 9: Gameplay Truth Should Use Gameplay Identity, Not Printing Identity, by Default

Decision:

- Gameplay truth should reference canonical gameplay-level identity unless a future mechanic explicitly requires printing-specific data.

Rationale:

- Gameplay rules usually care about the gameplay card, not which physical art variant or release produced it.

Practical implication:

- Runtime systems should not pull printing metadata into core action validation or effect resolution without an explicit rules need.

### Decision 10: Gameplay Support May Lag Behind Catalog and Legality Support

Decision:

- The platform may support a card in catalog and legality layers before it supports that card or mechanic in gameplay truth.

Rationale:

- Gameplay support is the most expensive layer and will expand gradually.

Practical implication:

- Product and engineering must treat "gameplay-supported" as an explicit capability, not an automatic consequence of catalog or legality support.

## Boundary Distinctions

### Catalog Truth vs Legality Truth

Boundary:

- Catalog truth describes what the card or printing is.
- Legality truth decides whether that identity is admissible under a specific format and restriction contract.

Do not mix:

- catalog presence with format eligibility;
- product metadata with legality outcomes;
- imported content completeness with supported legality coverage.

Common architectural mistakes:

- putting restriction-list flags into catalog as if they were inherent card facts;
- deriving legality from set membership alone without format-profile logic;
- assuming a newly imported printing automatically changes legality behavior.

### Decision 11: Catalog Truth Feeds Legality Truth, but Does Not Author It

Decision:

- Legality may depend on normalized catalog identity and metadata, but catalog does not own legality conclusions.

Rationale:

- Legality needs card identity, traits, and format-relevant fields from catalog.
- The legality layer still owns the admissibility interpretation.

Practical implication:

- If a restriction list changes, legality truth changes even when catalog truth does not.

### Legality Truth vs Gameplay Truth

Boundary:

- Legality truth decides whether a deck can be entered into a format under known rules.
- Gameplay truth decides whether a move can happen in the current runtime state.

Do not mix:

- deck validation with action validation;
- restriction checks with effect resolution;
- pre-game admissibility with in-match timing legality.

Common architectural mistakes:

- pushing runtime rules into deck-builder warnings;
- using legality results as substitutes for match-engine validation;
- making gameplay modules depend on legality result objects instead of shared domain inputs.

### Decision 12: Legality and Gameplay Are Adjacent Layers, Not a Single Validation Layer

Decision:

- Legality truth and gameplay truth may share canonical card identity and format profile, but they remain separate systems with separate outputs.

Rationale:

- They answer different questions and must be able to evolve independently.

Practical implication:

- A future rules engine should consume format profile and card identity directly, not legality verdicts as proxy rules.

### Catalog Truth vs Gameplay Truth

Boundary:

- Catalog truth stores the published content description.
- Gameplay truth models runtime semantics and state transitions.

Do not mix:

- printing metadata with gameplay identity;
- card page structure with runtime state shape;
- raw imported text or UI display fields with executable gameplay logic.

Common architectural mistakes:

- deriving effect execution directly from display-oriented catalog projections;
- making gameplay modules depend on raw source records;
- assuming an alt-art or promo printing implies a distinct gameplay object.

### Decision 13: Catalog Truth Supplies Facts; Gameplay Truth Supplies Runtime Interpretation

Decision:

- Gameplay may read normalized content facts from catalog, but it owns the runtime interpretation and execution of gameplay rules.

Rationale:

- A printed effect line is not the same thing as a runtime effect handler.

Practical implication:

- Updating an effect handler changes gameplay truth without necessarily changing catalog truth.

## Ownership and Source-of-Truth Boundaries

### Decision 14: Ownership Must Follow the Truth Layer

Decision:

- Each truth layer should have a primary owning module or subsystem.

Recommended ownership model:

| Layer            | Primary Owner                       | Non-Owners That May Read It                                      |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `catalog truth`  | catalog domain and its repositories | legality, UI, importer review tools, gameplay preparation layers |
| `legality truth` | legality domain                     | deck builder, API, UI, match-entry flows                         |
| `gameplay truth` | gameplay or rules domain            | match room UI, replay tools, analytics projections               |

Rationale:

- Ownership is required to prevent quiet duplication and conflicting interpretations.

Practical implication:

- If two modules can independently redefine the same truth, the architecture will drift.

### Boundary Guidance by Module

`catalog module`

- Owns normalized card, printing, and product description.
- Does not own restriction policies or runtime state logic.

`legality module`

- Owns admissibility checks, restriction interpretation, and legality result construction.
- Does not own raw catalog ingestion or runtime effect execution.

`rules or gameplay module`

- Owns game state, action validation, effect handling, and state transitions.
- Does not own print provenance or deck-builder legality messaging.

`importer`

- Supplies raw records and normalization candidates.
- Does not become the owner of legality or gameplay interpretation.

`repositories and persistence`

- Persist truth-layer data.
- Do not redefine domain meaning that belongs to higher layers.

`UI`

- Displays truth from all three layers when needed.
- Must not become source of truth for legality or gameplay behavior.

## Allowed Dependencies and Data Flow

### Decision 15: Dependencies Must Flow from Shared Content Facts into Derived Rule Layers, Not Backward

Decision:

- The allowed conceptual dependency direction is:
- importer and normalization feed catalog truth;
- catalog truth feeds legality and gameplay inputs where relevant;
- format profile and restriction contracts feed legality and gameplay separately;
- gameplay does not depend on raw importer records;
- UI reads all layers but owns none of them.

Rationale:

- Backward dependencies create hidden coupling and brittle shortcuts.

Practical implication:

- A legality module may read canonical card identity and format-relevant metadata from catalog.
- A gameplay module may read canonical identity, format profile, and gameplay-relevant card facts.
- Neither should depend on UI state as a source of domain truth.

### Allowed Conceptual Reads

- legality reads normalized catalog identity and format profile;
- gameplay reads canonical identity, gameplay-relevant card facts, and format gameplay inputs;
- deck builder reads catalog truth for display and legality truth for admissibility feedback;
- match room reads gameplay truth and may also show catalog projections for display.

### Dangerous Dependencies to Avoid

- gameplay reading raw importer records directly;
- catalog owning restriction lists as if they were inherent card metadata;
- legality results being reused as runtime gameplay state;
- UI components encoding format rules or action rules as local truth;
- collection or printing views redefining canonical gameplay identity.

## Examples

### Example 1: Card Exists in Catalog, but Legality Support Is Partial

- A card and its printings are fully normalized and searchable.
- The format profile exists, but one restriction family for that format is only partially supported.
- Result:
- catalog truth is present and stable;
- legality truth is partial;
- gameplay truth may still be absent.

### Example 2: Deck Is Legality-Valid, but Gameplay Support Is Missing

- The deck passes supported structure and restriction checks for its format.
- The gameplay engine does not yet implement one mechanic used by the deck.
- Result:
- legality truth can assert the deck is admissible;
- gameplay truth cannot yet simulate all runtime interactions for that deck.

### Example 3: Promo Printing Exists, but Gameplay Truth Does Not Change

- A promo alt-art printing is added for an existing canonical card.
- Result:
- catalog truth gains a new printing record;
- legality truth stays unchanged unless a separate rule source changes;
- gameplay truth stays unchanged because gameplay identity did not change.

### Example 4: Restriction Update Changes Legality but Not Catalog

- A restriction list updates the allowed status of a canonical card in a format.
- Result:
- legality truth changes;
- catalog truth does not change unless catalog metadata is updated for display purposes;
- gameplay truth does not change unless a future match flow explicitly consumes legality gates.

### Example 5: Effect Handler Update Changes Gameplay but Not Catalog

- A future gameplay module refines how one effect resolves in runtime state.
- Result:
- gameplay truth changes;
- catalog truth still describes the same card;
- legality truth remains unchanged unless the rule change also affects deck admissibility.

## Guidance for Future Modules

### Catalog Implementation

- Build around canonical cards, printings, products, and provenance.
- Do not embed legality or gameplay assumptions as inherent content truth.

### Legality Engine

- Consume canonical identity, format profile, and restriction data.
- Return support-aware legality results without pretending to answer runtime match questions.

### Deck Builder

- Use catalog truth for search, card detail, and display.
- Use legality truth for admissibility feedback.
- Do not locally invent format rules because the UI seems to need them quickly.

### Importer

- Normalize external records into catalog truth.
- Preserve provenance and uncertainty.
- Do not assign authoritative legality or gameplay meaning during ingestion.

### Rules Engine

- Consume gameplay-relevant inputs from canonical identity and format gameplay contracts.
- Keep runtime action legality separate from deck legality.

### Match Room

- Display and interact with gameplay truth.
- Use catalog data for presentation only where needed.
- Do not derive runtime truth from UI-local assumptions.

### UI Messaging

- Distinguish clearly between:
- known content;
- known legality result;
- supported or unsupported gameplay capability.

### Tests

- Test each truth layer independently.
- Add cross-layer tests only for explicit integration contracts, not to compensate for blurred ownership.

## Final Recommendations

### Recommendation 1: Treat the Three Truth Layers as First-Class Architectural Boundaries

Recommendation:

- Use `catalog truth`, `legality truth`, and `gameplay truth` as explicit design language in future documents, prompts, and module discussions.

Rationale:

- Shared vocabulary reduces boundary drift and accidental coupling.

### Recommendation 2: Let Each Layer Answer Only Its Own Core Question

Recommendation:

- Resist shortcut logic where one layer is used to imply another layer's conclusions.

Rationale:

- Most future rework risk comes from false equivalences, not from missing abstractions.

### Recommendation 3: Prefer Shared Inputs Over Shared Conclusions

Recommendation:

- Let legality and gameplay share canonical card identity and format profile where needed, but do not let one layer's result object become the other layer's source of truth.

Rationale:

- Shared inputs support consistency without collapsing responsibilities.

### Recommendation 4: Expose Capability Gaps Honestly

Recommendation:

- When support is partial, communicate that at the correct truth layer instead of silently promoting or hiding it.

Rationale:

- Honest capability boundaries are essential for phased rollout across content, formats, legality, and gameplay.

## Anti-Confusion Notes

Avoid these false equivalences:

- "present in catalog" does not mean "legal"
- "legal" does not mean "fully gameplay-supported"
- "printing exists" does not mean "separate gameplay card"
- "effect text exists in catalog" does not mean "effect handler exists"
- "restriction changed" does not mean "catalog identity changed"
- "UI can display it" does not mean "UI owns the rule"
- "gameplay module knows a mechanic" does not mean "catalog metadata is complete"
