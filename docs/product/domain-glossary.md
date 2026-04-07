# Cardfight!! Vanguard Web Client Domain Glossary

Status: Initial domain glossary  
Last updated: 2026-04-07

## Purpose of This Glossary

This glossary defines the shared working vocabulary for the Cardfight!! Vanguard web client.

It exists so that product decisions, architecture discussions, documentation, prompts, code, and future module names all use the same terms in the same way. That matters in this project because the product spans several overlapping domains:

- game content and catalog data;
- deck construction and legality;
- match support and future gameplay;
- social features and user-owned content;
- ingestion, normalization, and internal platform architecture.

Without a controlled vocabulary, the team will quickly mix up concepts that must stay separate. The most dangerous examples are format vs era, card entity vs card printing, legality vs restriction, deck validation vs gameplay rules, and match history vs playable match.

Use this document as the default reference when naming product concepts, modeling entities, writing prompts, or choosing module boundaries. If a local term conflicts with this glossary, the glossary should win unless the team deliberately updates it.

## How to Read Entries

Each term uses a compact structure:

- Definition: the preferred short meaning.
- In this project: how the term should be applied in product and engineering work.
- Do not confuse with: the most common nearby concept that should stay separate.

## High-Risk Distinctions

- `format` is a playable environment; `era` is a historical or content classification.
- `card entity` or `canonical card` is the normalized gameplay card; `card printing` is a release-specific physical version.
- `product family` is a reusable release type; a `specific set` is one concrete release inside that family.
- `legality` is the overall allowed or not-allowed state; a `restriction` is one rule input that affects legality.
- `deck validation` checks construction rules before play; `gameplay rules` govern actions during a match.
- `match history` records results; a `playable match` is an active interactive session.
- `rules engine` owns rules interpretation and authoritative state transitions; `UI logic` owns presentation and interaction flow.
- `social feature` means deck- and profile-centered user interaction; it does not automatically mean tournament, ranking, or competitive platform.
- `content ingestion` is a repeatable operational flow; `manual content entry` is ad hoc editing and should not be treated as the default system.

## Product and Format Terminology

### Format

Definition: A playable rules-and-card-pool environment with its own construction and legality rules.

In this project: `format` is a first-class product axis. Catalog filters, deck construction, legality, match tools, and future gameplay support all need explicit format awareness.

Do not confuse with: `era`. Era explains where content comes from historically; format explains where it can be played.

### Standard

Definition: The main current Vanguard constructed format built around the modern card pool and its contemporary deck-construction model.

In this project: `Standard` is a distinct format with its own eligibility rules, legality behavior, and deck structure expectations, including Ride Deck support where applicable.

Do not confuse with: `D era`. Many Standard cards belong to the modern era, but `Standard` is the playable format, not the historical label.

### V Premium

Definition: A constructed format centered on the V-era card and rules environment.

In this project: `V Premium` must be modeled separately from Standard and Premium because its deck-construction assumptions, eligibility rules, and legality logic are different.

Do not confuse with: `Premium`. Premium is broader and supports deeper cross-era interactions.

### Premium

Definition: A broad constructed format that combines a larger historical card pool and more complex cross-era interactions.

In this project: `Premium` should be treated as its own format with its own deck structures, legality model, and future gameplay complexity, including G Deck considerations where supported.

Do not confuse with: `all cards by default`. Premium is broad, but it is still governed by explicit format rules and restrictions.

### Era

Definition: A historical or product-generation classification for cards and releases.

In this project: `era` helps organize content lineage, release context, and some format mappings, but it is not itself a playable mode. Era is useful for ingestion, catalog organization, and long-term format reasoning.

Do not confuse with: `format`. Era is about content history; format is about playable rules.

### Product family

Definition: A recurring release type or release line, such as Booster Pack, Extra Booster, Trial Deck, or Start Deck.

In this project: `product family` is a reusable classification used for ingestion, browsing, filtering, and coverage planning. It should remain stable across many concrete releases.

Do not confuse with: `specific set`. A product family contains many individual releases.

### Specific set

Definition: One concrete product release inside a broader product family.

In this project: `specific set` is the individual release object that carries its own set code, release date, product page, and printing list. It is the unit users browse when they open a concrete release.

Do not confuse with: `product family` or `release wave`. Family is the reusable type; release wave is our rollout grouping.

### Booster set

Definition: A main booster release line that expands the card pool through randomized packs.

In this project: `booster set` is a product-family or family-subtype label used for catalog grouping, release planning, and coverage reporting.

Do not confuse with: `release wave`. A release wave is our internal rollout grouping, not the product type itself.

### Extra booster

Definition: A more targeted booster-style product line, usually narrower in scope than a main booster set.

In this project: `extra booster` should be preserved as a distinct product classification because it often implies smaller, more focused content additions and different player expectations.

Do not confuse with: `special series`. Not every non-main booster product belongs to Special Series.

### Title booster

Definition: A booster product line centered on a specific collaboration title or narrowly scoped theme.

In this project: `title booster` matters as a distinct product family because it affects search behavior, coverage messaging, and content grouping differently from general booster products.

Do not confuse with: `booster set` in the generic sense. Title boosters are a specialized family, not just a naming variation.

### Lyrical booster

Definition: A booster line specifically centered on Lyrical Monasterio content.

In this project: `lyrical booster` should be preserved as a meaningful classification because Lyrical content is often consumed, searched, and expanded as its own content lane.

Do not confuse with: `title booster` or a generic nation filter. This is a product-line label with its own release pattern.

### Start deck

Definition: A preconstructed entry product designed to let a player start playing quickly.

In this project: `start deck` should be modeled as a product family under constructed deck products. It is a release type, not a format or a gameplay zone.

Do not confuse with: `trial deck`. They play similar product roles, but the label should remain faithful to the source release naming.

### Trial deck

Definition: A preconstructed starter product used in earlier Vanguard product lines and some title-specific releases.

In this project: `trial deck` should remain a distinct product-family label for source accuracy, ingestion, and historical catalog clarity.

Do not confuse with: `start deck`. Do not collapse these into one name unless the source model deliberately does so at a higher abstraction level.

### Promo

Definition: A promotional card or printing distributed outside the main booster or starter product flow.

In this project: `promo` is a release or distribution classification that affects source mapping, coverage clarity, and sometimes legality handling.

Do not confuse with: `rarity` or `reprint`. A promo may be a unique printing, a reprint, or a special distribution channel.

### Special series

Definition: An umbrella release line for products that do not fit the standard booster or starter-deck families.

In this project: `special series` is a product-family classification that helps the platform absorb irregular releases without inventing one-off categories every time.

Do not confuse with: `release wave` or `promo`. It is still a structured product classification.

### Release wave

Definition: An internal grouping of one or more releases added to the platform together.

In this project: `release wave` is a planning and delivery term used for staged ingestion, QA, coverage messaging, and rollout. It may align with official release timing, but it is still our product-delivery concept.

Do not confuse with: `product family` or `specific set`.

### Content coverage

Definition: The exact subset of cards, products, printings, formats, and legality depth that the platform currently supports.

In this project: `content coverage` must always be explicit and user-visible. It is a product-trust concept and should be versionable or declarable at release time.

Do not confuse with: `card pool`. Coverage is what the platform currently supports; card pool is the broader theoretical or rules-defined set of cards under a scope.

## Card and Catalog Terminology

### Card entity

Definition: The primary domain-level representation of a distinct card as used by gameplay, deck building, legality, and most catalog logic.

In this project: `card entity` is the stable object other systems should reference when they mean "the card itself" rather than a release-specific physical version.

Do not confuse with: `card printing`. Multiple printings may map to one card entity.

### Card printing

Definition: A specific published instance of a card in a particular release, with its own set code, card number, rarity, art, and release metadata.

In this project: `card printing` represents the physical or release-specific catalog object. It exists so the platform can model print history without fragmenting gameplay identity.

Do not confuse with: `card entity` or `canonical card`.

### Canonical card

Definition: The normalized reference card record used as the default gameplay identity across multiple printings.

In this project: `canonical card` is the preferred default object for deck lists, legality, and most gameplay-aware features. It is the deduplicated card reference beneath print history.

Do not confuse with: a favorite or primary printing. `Canonical` here means normalized reference, not premium status.

### Reprint

Definition: A later printing of an existing card that usually preserves the same gameplay identity while changing release context and sometimes presentation.

In this project: `reprint` normally attaches to an existing canonical card. Reprints should not generate new gameplay identities unless there is a substantive rules-level reason.

Do not confuse with: `errata` or a mechanically different card. If gameplay identity changes, review whether it still belongs to the same canonical card.

### Alt art

Definition: A printing variant that changes visual presentation while keeping the same gameplay identity.

In this project: `alt art` is a printing-level attribute. It matters for collectors, binders, and catalog detail views, but not for core deck legality.

Do not confuse with: `canonical card`. Alt art should not create separate deck-building identities.

### Rarity

Definition: The release-level rarity classification assigned to a specific printing.

In this project: `rarity` belongs to product and printing data. It can be useful for collection and binder features later, but it is not a gameplay rule by itself.

Do not confuse with: legality, strength, or deck-building value.

### Set code

Definition: The structured code that identifies a product or release grouping on official printings.

In this project: `set code` is a key ingestion and source-mapping field used to locate a printing within a release and to group printings under product pages.

Do not confuse with: `card number`. Set code identifies release context; card number identifies a printing within that context.

### Card number

Definition: The within-set identifier assigned to a specific printing.

In this project: `card number` helps identify printings precisely when combined with set code, locale, and release metadata.

Do not confuse with: internal IDs, canonical card IDs, or gameplay identity.

### Card metadata

Definition: Structured descriptive data attached to a card, such as grade, power, shield, clan, nation, type, text, and related properties.

In this project: `card metadata` is the raw material for search, filters, deck validation, legality logic, and future gameplay support. It must stay structured and machine-usable.

Do not confuse with: user-generated notes, stats, or social annotations.

### Card traits

Definition: Structured categorical attributes of a card that matter for rules, filtering, or deck construction.

In this project: `card traits` should be normalized wherever they affect search, legality, or mechanic grouping. They are part of the domain, not just UI decoration.

Do not confuse with: free-form tags or ad hoc labels.

### Keyword

Definition: A named gameplay term printed on cards or widely used in the game to denote a recurring mechanic or rules pattern.

In this project: `keyword` should be stored as source-aligned structured data because it is relevant to both catalog discovery and future engine support.

Do not confuse with: `mechanic tag`. A keyword is closer to source terminology; a mechanic tag may be an internal classification.

### Mechanic tag

Definition: An internal classification label used to group cards by mechanic, archetype, support pattern, or product-relevant behavior.

In this project: `mechanic tag` helps search, content organization, and future feature targeting even when printed text is inconsistent or too granular.

Do not confuse with: official keyword text. Mechanic tags are allowed to be product-driven internal labels.

### Ride line

Definition: A linked progression of related units intended to be ridden in sequence.

In this project: `ride line` is both a catalog relationship and a deck-building aid. It can support search, product pages, deck recommendations, and Standard-aware tools.

Do not confuse with: `ride deck`. A ride line is a relationship among cards; a ride deck is a format-specific deck section.

### Trigger unit

Definition: A unit card with trigger behavior and a special role in deck construction and gameplay.

In this project: `trigger unit` should be modeled as a structured card classification because it affects deck validation, filters, and future gameplay support.

Do not confuse with: a generic effect or keyword label. Trigger status is a card property.

### Order card

Definition: A non-unit card type with its own play rules and deck-building implications.

In this project: `order card` is a first-class card type and should be handled explicitly in catalog, deck building, and future gameplay logic.

Do not confuse with: a keyword or an effect description. `Order` is a card type.

### Token

Definition: A gameplay object represented by a card-like reference but not treated as a normal collectible deck card.

In this project: `token` may need catalog and rules support, but it should usually be modeled separately from ordinary deck-eligible printings.

Do not confuse with: `card printing` or a standard deck card. Tokens often enter play through effects rather than deck construction.

### Card pool

Definition: The total set of cards considered available under a declared scope.

In this project: `card pool` must always be scoped, for example by format, era, release wave, or current platform coverage. It should never be implied as one global constant.

Do not confuse with: `content coverage`. A format may theoretically allow cards the platform has not ingested yet.

### Catalog entry

Definition: The presentation-layer item shown in browse or search results.

In this project: `catalog entry` is a UI-facing object. Depending on product needs, it may represent a canonical card, a printing, or a grouped presentation across printings.

Do not confuse with: `card entity`. The catalog can group or shape data for usability; the domain model underneath should stay stable.

## Deck and Legality Terminology

### Deck

Definition: A player-assembled set of cards intended for play in a declared format.

In this project: `deck` is a first-class user object tied to format, ownership, versions, validation, privacy, sharing, and match history.

Do not confuse with: `deck list`. A deck includes metadata and lifecycle, not just card counts.

### Main deck

Definition: The primary deck section used for normal card draw and play.

In this project: `main deck` must be modeled explicitly because not all formats share the same additional deck sections or construction assumptions.

Do not confuse with: `ride deck` or `G deck`.

### Ride deck

Definition: A separate deck component used in Standard-style deck construction for predetermined riding support.

In this project: `ride deck` is a format-specific deck section. It should exist only where the supported format rules require it and should not be assumed universal.

Do not confuse with: `ride line`. Ride line is a card relationship; Ride Deck is a deck structure.

### G deck

Definition: A separate deck component used for G units in formats that support Stride and related mechanics.

In this project: `G deck` is mainly relevant to Premium-oriented support and should not leak into Standard-only assumptions or generic deck code.

Do not confuse with: `main deck` or a generic sideboard concept.

### Deck list

Definition: The concrete composition of a deck: which cards, in what counts, and in which deck sections.

In this project: `deck list` is the validation target and the shareable content object inside a deck record.

Do not confuse with: `deck entity` or `deck version`. A single deck can have many list revisions over time.

### Deck version

Definition: A saved snapshot or revision of a deck at a specific point in time.

In this project: `deck version` supports change tracking, sharing, match attribution, and future comparison features without mutating history away.

Do not confuse with: format version, restriction-list version, or content coverage version.

### Legality

Definition: The state of being allowed under a declared rules and content scope.

In this project: `legality` can apply at card level, printing level, or deck level, but it is never meaningful without an explicit scope.

Do not confuse with: `restriction`. Restriction is one input to legality, not the whole concept.

### Deck legality

Definition: The legality outcome for a specific deck under a specific format and supported scope.

In this project: `deck legality` is a product output surfaced to users. It should be transparent about what was checked, what was supported, and where support stops.

Do not confuse with: gameplay correctness during a match.

### Deck validation

Definition: The process of checking a deck against construction rules, card eligibility, and applicable restrictions.

In this project: `deck validation` is a pre-game system concern. It should be deterministic within the supported scope and should explain failures in user-meaningful terms.

Do not confuse with: `rules engine` or `action validation`. Deck validation is not in-match rules execution.

### Restriction list

Definition: A format-scoped list of special limitations applied to cards or card combinations.

In this project: `restriction list` is a versioned policy input to legality and validation. It should be treated as structured data, not just display text.

Do not confuse with: the entire legality model. Restriction lists modify eligibility or counts inside a broader legality system.

### Banned

Definition: A restriction state meaning a card cannot be used in the relevant format or context.

In this project: `banned` is a concrete restriction outcome that turns an otherwise eligible card into an illegal inclusion for that scope.

Do not confuse with: `unsupported`. Unsupported means the platform is not asserting legality; banned means the rules disallow it.

### Limited

Definition: A restriction state that caps the number of allowed copies below the normal maximum.

In this project: `limited` must be modeled as count-based validation logic, not as an informal label or UI-only note.

Do not confuse with: rarity, scarcity, or once-per-turn gameplay text.

### Choice restriction

Definition: A rule that disallows using certain cards together or requires the player to choose among restricted options.

In this project: `choice restriction` is important because per-card legality alone will miss it. The validator must be able to reason about deck composition relationally.

Do not confuse with: `banned` or `limited`. Choice restriction is about combinations, not only card counts.

### Format legality

Definition: The legality status of a card or deck relative to a named format.

In this project: `format legality` is a core dimension in catalog filtering, deck builder guidance, validation results, and future product messaging.

Do not confuse with: `era` or release date. A card's era does not by itself determine format legality.

### Clan-based construction

Definition: A deck-construction model where clan identity is a primary eligibility rule.

In this project: `clan-based construction` should be treated as a format rule, not as a universal property of all decks in the platform.

Do not confuse with: `nation-based construction`. The two models must coexist without being collapsed into one generic field.

### Nation-based construction

Definition: A deck-construction model where nation identity is a primary eligibility rule.

In this project: `nation-based construction` is central to modern Standard-aware support and should be modeled explicitly where relevant.

Do not confuse with: `clan-based construction`. They are related but not interchangeable.

### Eligible card

Definition: A card that is allowed to be considered for deck inclusion within a declared scope.

In this project: `eligible card` is the first gate in validation logic before counts, restrictions, and composition rules are applied.

Do not confuse with: `currently ingested card`. A card may be theoretically eligible in the game while still unsupported by current platform coverage.

### Illegal deck state

Definition: A deck condition that violates one or more construction or restriction rules.

In this project: `illegal deck state` is a validation result with specific reasons that should be machine-readable and user-explainable.

Do not confuse with: an invalid gameplay state during an active match.

## Gameplay and Engine Terminology

### Game state

Definition: The full in-match representation of the current game, including players, zones, turn context, and pending rules-relevant data.

In this project: `game state` is a future gameplay-support concept. It becomes important once the product moves beyond catalog and manual match tools into rules-aware play assistance or interactive matches.

Do not confuse with: `deck state` or `match history`. Game state is live or snapshot gameplay data.

### Player state

Definition: The portion of game state that belongs to one player, including resources, zones, and player-specific effects or choices.

In this project: `player state` is the engine-facing representation of a participant inside a game state.

Do not confuse with: `profile`. A profile is an account identity; player state is a runtime gameplay object.

### Zone

Definition: A rules-defined location that can contain cards or gameplay objects.

In this project: `zone` should be treated as a gameplay-domain object, not just a UI layout region. Zones matter for rules, actions, and state serialization.

Do not confuse with: page sections or frontend containers.

### Turn

Definition: A top-level sequence of play allocated to one player.

In this project: `turn` is part of gameplay sequencing and future match tools. It should remain separate from event timestamps or match rounds.

Do not confuse with: `phase`. A turn contains phases.

### Phase

Definition: A rules-defined sub-stage within a turn.

In this project: `phase` is an engine-level sequencing concept used for action legality and future match assistance.

Do not confuse with: product phase, release phase, or project phase.

### Action

Definition: An attempted rules-relevant operation initiated by a player or the system during gameplay.

In this project: `action` is the unit the rules layer validates and applies to game state. It is not a generic UI click.

Do not confuse with: `event`. An action is an attempted operation; an event is an occurrence that results or is recorded.

### Action validation

Definition: The process of checking whether a proposed gameplay action is legal in the current game state.

In this project: `action validation` belongs to future gameplay support and should remain separate from deck validation and UI field validation.

Do not confuse with: `deck validation`. One is pre-game construction logic; the other is in-game rules logic.

### Event

Definition: A recorded gameplay occurrence, such as an action being taken, an effect being triggered, or a state transition happening.

In this project: `event` is useful for replayability, auditability, debugging, and future gameplay logs.

Do not confuse with: social or tournament events. This is a gameplay-domain term.

### Event log

Definition: An ordered record of gameplay events during a match.

In this project: `event log` is an engine-support concept for replay, debugging, snapshots, and future match-history enrichment.

Do not confuse with: `match history`. Match history is a user-facing record of completed matches; event log is detailed in-match chronology.

### Effect

Definition: A gameplay consequence produced by card text, a rule, or another game action.

In this project: `effect` should be treated as a gameplay-domain concept that may later need structured representation beyond raw text.

Do not confuse with: UI effect, animation, or presentation behavior.

### Effect handler

Definition: The rules-side implementation unit responsible for resolving a specific effect or class of effects.

In this project: `effect handler` belongs to gameplay-engine design, not to catalog rendering or deck validation modules.

Do not confuse with: display helpers or text parsers. Parsing text and executing rules are not the same responsibility.

### Keyword mechanic

Definition: An engine-facing mechanic concept corresponding to a named or recurring gameplay rule pattern.

In this project: `keyword mechanic` is the bridge between catalog terminology and engine behavior. It should exist only when the product needs rules-aware handling, not just text display.

Do not confuse with: `keyword` in catalog metadata. Keyword is source-facing; keyword mechanic is behavior-facing.

### Continuous effect

Definition: An effect that remains active over time while its condition or duration persists.

In this project: `continuous effect` matters because it changes how authoritative state must be represented and recalculated during gameplay support.

Do not confuse with: a one-time triggered resolution.

### Triggered effect

Definition: An effect that becomes pending or resolves when a specified condition or event occurs.

In this project: `triggered effect` is a separate behavior class from continuous effects and should be modeled accordingly in any future rules engine.

Do not confuse with: `trigger unit`. A trigger unit is a card type or property; a triggered effect is a runtime rules behavior.

### Resolution

Definition: The process of carrying out an action or effect after costs, choices, and rules checks are satisfied.

In this project: `resolution` is an engine concern. It determines how state changes are applied and how follow-up events are produced.

Do not confuse with: `validation`. Validation decides whether something can happen; resolution performs what happens.

### Cost

Definition: A required payment, commitment, or condition that must be satisfied to take an action or resolve an effect.

In this project: `cost` is a rules-level concept and should not be modeled as generic flavor text or display-only metadata when gameplay support grows deeper.

Do not confuse with: deck-building price, collection value, or real-money cost.

### Choice

Definition: A decision point offered to a player or required by rules during action or effect processing.

In this project: `choice` becomes important for gameplay support because legal choices and available options may be state-dependent.

Do not confuse with: `choice restriction` in deck legality. One is in-match decision logic; the other is pre-game construction policy.

### Match room

Definition: A session container for an active or semi-active match interaction between players.

In this project: `match room` is the product or application object that would host a playable or assisted match session later. It can exist even before full simulation if room-based tools are introduced.

Do not confuse with: `match history`. A room is about active session context; history is about recorded results.

### Playable match

Definition: A match experience in which the platform actively hosts, assists, or enforces gameplay interactions rather than only recording outcomes.

In this project: `playable match` is a future-capability term. It sits beyond manual match history and requires at least some gameplay-state, action, and rules-awareness support.

Do not confuse with: `manual match entry` or `match history`. Recording that a match happened is not the same as running the match.

### Gameplay snapshot

Definition: A serializable capture of game state at a particular point in time.

In this project: `gameplay snapshot` can support save and resume, debugging, replay, or future training tools once gameplay-aware systems exist.

Do not confuse with: a deck version or a match result summary.

### Authoritative state

Definition: The source-of-truth gameplay state that determines what is actually valid and current.

In this project: `authoritative state` should belong to a trusted runtime or server-side rules layer once interactive gameplay exists.

Do not confuse with: `local state` or optimistic UI state.

### Local state

Definition: The client-side or session-local representation used for rendering, interaction, or optimistic updates.

In this project: `local state` may temporarily differ from authoritative state for responsiveness, but it should never redefine the game rules.

Do not confuse with: `authoritative state`. UI convenience is not the same as rules truth.

### Rules engine

Definition: The system responsible for interpreting gameplay rules, validating actions, and producing authoritative state transitions.

In this project: `rules engine` is a future gameplay-support component. It should remain clearly separated from deck validation, catalog modeling, and frontend interaction code.

Do not confuse with: `UI logic`. UI logic helps users interact with the system; the rules engine decides what the game allows.

### UI logic

Definition: The frontend or application-layer behavior that manages rendering, interaction flow, and local interface state.

In this project: `UI logic` may guide the user, display validations, and manage optimistic interaction, but it must not become the authoritative owner of gameplay rules or privacy enforcement.

Do not confuse with: `rules engine` or `RLS`.

### Format adapter

Definition: A format-specific rules or policy layer applied over shared validation or engine foundations.

In this project: `format adapter` is the preferred term for logic that changes by format while preserving common domain structures underneath.

Do not confuse with: `era mapping`, `catalog filters`, or hard-coded per-screen exceptions. A format adapter belongs in domain logic, not in presentation code.

## Social and Application Terminology

### Profile

Definition: A user-facing identity surface for an account.

In this project: `profile` owns basic identity, deck attribution, sharing context, and selected user-visible preferences. It should remain lean in v1.

Do not confuse with: `player state` or a competitive ranking account.

### Friend request

Definition: A pending invitation from one user to another to establish a mutual social connection.

In this project: `friend request` is a social application object. It should stay clearly separate from match invitations or tournament pairings.

Do not confuse with: `friend relation`. A request is pending; a relation is established.

### Friend relation

Definition: An accepted social connection between two user accounts.

In this project: `friend relation` can support deck sharing, visibility rules, and small-community workflows, but it does not imply a full social network.

Do not confuse with: follower systems, ranked ladders, or tournament roles.

### Public profile

Definition: The profile subset visible to other users or anonymous visitors.

In this project: `public profile` should be deliberately scoped. It is a visibility concept, not a separate account type.

Do not confuse with: `private data`.

### Private data

Definition: User-owned information that is not publicly visible by default.

In this project: `private data` includes account-sensitive information and user-owned content or preferences that require explicit permission or policy to expose.

Do not confuse with: hidden-by-UI-only fields. Privacy must be enforced at the data-access level as well.

### Match history

Definition: A stored record of past matches associated with a user, deck, format, or other contextual data.

In this project: `match history` is a user-facing record system for real play, especially manual logging before full gameplay support exists.

Do not confuse with: `playable match` or `event log`. Match history is about recorded outcomes, not live state.

### Manual match entry

Definition: A match history record created by user input rather than produced automatically by a gameplay engine.

In this project: `manual match entry` is a core early-product feature because it creates value before interactive gameplay exists.

Do not confuse with: a simulated or authoritative match result produced by a rules engine.

### Stats

Definition: Derived summary metrics produced from decks, matches, or other user activity.

In this project: `stats` should be treated as computed product outputs, not as primary source data. In v1 they should stay simple and deck-centered.

Do not confuse with: raw match history entries. Stats summarize; history records.

### Collection

Definition: A user-owned record of which cards or printings the user possesses.

In this project: `collection` is a potential future application area and should be kept separate from deck building and catalog identity even when they share card references.

Do not confuse with: `binder` or `wishlist`. Collection is ownership-focused.

### Binder

Definition: A curated user-facing subset or presentation of a collection.

In this project: `binder` is a presentation or organization concept, not a replacement for core ownership data.

Do not confuse with: `collection`. A binder is a view or curated grouping; a collection is the underlying ownership set.

### Wishlist

Definition: A user-maintained list of cards or printings they want to obtain.

In this project: `wishlist` is a future collection-adjacent feature and should remain distinct from ownership and deck construction data.

Do not confuse with: `collection` or `deck list`. Wanting a card is not the same as owning or playing it.

### Shared deck

Definition: A deck that has been made viewable to other users through a chosen visibility setting or link.

In this project: `shared deck` is one of the core social objects in the platform. It should be deck-centered, not a generic post object.

Do not confuse with: a public profile or a collaborative deck editor by default.

### Deck privacy

Definition: The visibility policy controlling who can view or access a deck.

In this project: `deck privacy` should be explicit and policy-driven. It influences share links, public profiles, and possible friend-group workflows.

Do not confuse with: account privacy as a whole. Deck privacy is object-level visibility.

## Architecture and Data Terminology

### Domain model

Definition: The structured representation of the product's core concepts, relationships, and business rules.

In this project: `domain model` is the stable conceptual foundation beneath UI screens, storage details, and API shapes. It should express cards, printings, products, decks, formats, legalities, and future gameplay concepts clearly.

Do not confuse with: database schema. The domain model should outlive storage choices.

### Repository layer

Definition: The layer responsible for reading and writing domain data through stable interfaces.

In this project: `repository layer` should isolate domain logic from direct persistence details and keep storage concerns from leaking everywhere.

Do not confuse with: the domain model itself. A repository serves domain objects; it does not define the domain.

### Ingestion pipeline

Definition: The repeatable process that takes source content from raw inputs through transformation, normalization, validation, and storage-ready output.

In this project: `ingestion pipeline` is how new Vanguard content should enter the platform at scale. It is essential for phased release growth.

Do not confuse with: one-off admin entry or manual patching of production data.

### Normalization

Definition: The process of converting inconsistent or source-shaped data into consistent internal representations.

In this project: `normalization` is especially important for deduplicating cards vs printings, reconciling product labels, and turning raw text into structured metadata.

Do not confuse with: losing source fidelity. Good normalization preserves traceability while enforcing internal consistency.

### Source mapping

Definition: The traceable link between an internal record and the source material it came from.

In this project: `source mapping` is important for auditing ingestion, handling updates, resolving conflicts, and supporting manual review when source data changes.

Do not confuse with: the normalized record itself. Mapping is about provenance.

### Seed data

Definition: The baseline data used to bootstrap environments or initialize a minimum working dataset.

In this project: `seed data` may include reference formats, initial product families, restriction scaffolding, or testable sample content, but it is not a replacement for ongoing ingestion.

Do not confuse with: live content coverage or production ingest jobs.

### Content ingestion

Definition: The broader operational practice of bringing new cards, products, printings, legalities, and related content into the platform.

In this project: `content ingestion` is the ongoing product capability; an ingestion pipeline is one mechanism used to do it. The term includes tooling, review, and release process.

Do not confuse with: `manual content entry`. Manual entry may exist as a fallback or exception, but it should not be the default operational model.

### Manual content entry

Definition: Direct human creation or editing of content records outside the normal repeatable ingestion flow.

In this project: `manual content entry` should be treated as an exception path for correction, backfill, or urgent fixes, not as the default operating model for growing the catalog.

Do not confuse with: `content ingestion` or `manual review queue`. Reviewing pipeline output is not the same as hand-authoring the dataset.

### Manual review queue

Definition: A staged list of ingested or edited records that require human verification before they are trusted or published.

In this project: `manual review queue` is important wherever automated normalization cannot safely resolve ambiguity, especially around print deduplication, legality mapping, or product classification.

Do not confuse with: backlog or user moderation queue. This is a content-quality control mechanism.

### RLS

Definition: Row-Level Security, meaning access control enforced at the data layer on a per-row basis.

In this project: `RLS` is the preferred term when discussing database-enforced privacy boundaries for profiles, decks, match history, and other user-owned records.

Do not confuse with: frontend visibility checks alone. RLS is about authoritative access enforcement.

### Server client

Definition: The application-side client that runs on the server and accesses services or data stores with server-side execution context.

In this project: `server client` is useful for SSR, background jobs, privileged reads, secure writes, and internal workflows that should not run in the browser.

Do not confuse with: `browser client`. A server client operates with server-side trust and runtime constraints.

### Browser client

Definition: The user-facing client runtime that executes in the browser.

In this project: `browser client` handles interactive UI behavior, local state, and user-driven flows, but should not be treated as the authoritative rules or privacy boundary.

Do not confuse with: `server client`. The browser client is untrusted relative to server-side enforcement and authoritative gameplay logic.

### Package boundary

Definition: The explicit limit of responsibility and dependency access between packages or modules.

In this project: `package boundary` is how the codebase prevents catalog, deck, legality, gameplay, and social logic from collapsing into one undifferentiated blob.

Do not confuse with: folder layout alone. A real package boundary is about allowed dependencies and ownership, not just directory names.

### Domain module

Definition: A code module that owns one bounded slice of domain behavior and terminology.

In this project: `domain module` should align with stable concepts such as cards, products, decks, legality, or gameplay, rather than with temporary UI screens.

Do not confuse with: a generic utility package or a frontend route.

## Naming Guidance

Use the glossary terms directly in docs, prompts, and code when possible. Favor explicit names over loose shorthand.

- Prefer `format` for playable environments and `era` for historical content groupings.
- Prefer `card` or `canonical_card` for gameplay identity and `card_printing` for release-specific records.
- Prefer `product_family` for recurring release types and `product_set` or `product_release` for individual releases.
- Prefer `deck_validation` for pre-game construction checks and `rules_engine` or `action_validation` for in-game rules logic.
- Prefer `match_history` for recorded results and `match_room` for active or interactive session objects.
- Prefer `content_ingestion` for the operational capability and `ingestion_pipeline` for the implementation flow that powers it.
- Prefer `shared_deck`, `deck_privacy`, and `profile` for social objects instead of generic names like `post`, `feed`, or `community` unless the product actually grows into those concepts.
- Prefer `format_adapter` for format-specific rule logic instead of scattering `if format == ...` behavior through unrelated modules.

Avoid these naming mistakes:

- Do not use `series` when you mean either `era` or `product_family`.
- Do not use `card` when you actually mean `card_printing`.
- Do not use `legality` when you actually mean `restriction_list`.
- Do not use `match` when you actually mean `match_history_entry`.
- Do not use `engine` for frontend interaction helpers.
- Do not use `manual_entry` as the default name for ingestion paths that should become repeatable pipeline logic.

When in doubt, choose the term that best preserves the distinction between:

- gameplay vs catalog;
- canonical identity vs printing history;
- product scope vs official game scope;
- user-facing feature naming vs internal domain ownership.
