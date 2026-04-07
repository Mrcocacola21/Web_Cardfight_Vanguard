# Architecture Review Checkpoint 02

Status: Pre-implementation checkpoint review  
Last updated: 2026-04-07

## Purpose of This Checkpoint

This checkpoint reviews the coherence of the current architecture contracts before monorepo setup and module implementation begin.

The goal is not to restate the existing documents. The goal is to test whether the architecture can now move into implementation without hidden contradictions, blurred ownership, or predictable refactor traps.

This review focuses on the following pressure points:

- card identity across catalog, decks, legality, and future rules;
- format profile and deck structure consistency;
- legality result semantics and support-state handling;
- separation of catalog truth, legality truth, and gameplay truth;
- bounded contexts and dependency directions;
- alignment with the previously stated engineering principles.

## Documents Reviewed

- `docs/engineering/principles.md`
- `docs/architecture/card-identity-and-normalization.md`
- `docs/architecture/format-profile-and-deck-structure.md`
- `docs/architecture/legality-validation-context.md`
- `docs/architecture/truth-boundaries.md`
- `docs/architecture/bounded-contexts-and-dependencies.md`

## Executive Summary

The current direction is viable. The architecture is much stronger than it was at the first review checkpoint. The major conceptual traps have been addressed:

- card identity is now centered on `canonical card` rather than printing;
- format is modeled as a structured contract rather than an enum;
- legality is no longer treated as boolean;
- catalog, legality, and gameplay truths are explicitly separated;
- bounded contexts and dependency directions are defined explicitly.

There are no fundamental contradictions that make the current model unusable.

There are, however, several contract gaps that should be fixed before implementation becomes deep:

1. ownership of legality results and validation targets is still inconsistent across documents;
2. the shared contract surface between contexts is not yet explicitly owned;
3. the deck-to-format attachment model is still too implicit;
4. the format-profile publication and capability-support ownership model is not assigned clearly enough;
5. the gameplay-facing projection from catalog is acknowledged but not yet defined as a contract.

This is not a `NO-GO`, but it is not a clean unconditional `GO` either.

## What Is Strong and Ready

- The identity model is directionally strong. Decks, legality, and future gameplay all point toward `canonical card` as the authoritative gameplay identity, while printings remain separate and subordinate.
- The format model is strong enough to resist Standard-first hardcoding. Standard, V Premium, and Premium are treated as format profiles with explicit structural differences.
- The legality model is honest about phased support. `invalid`, `unsupported`, and `partially supported` are separated correctly, and positive legality claims require full evaluation.
- The truth-boundary model is strong. The project now has a clear architectural language for catalog truth, legality truth, and gameplay truth.
- The context map is directionally correct. `web app` is clearly treated as composition rather than domain ownership, and `rules` is kept separate from `legality`.
- The engineering principles still align with the core architecture direction: domain-first, extension-ready, strict separation of UI and rules, and no format hardcoding.

## Detected Inconsistencies

### Issue 1: Ownership of legality results is inconsistent

Issue:

- `docs/engineering/principles.md` says deck modules should own "validation targets, and legality results."
- `docs/architecture/bounded-contexts-and-dependencies.md` says `legality` owns validation context, admissibility findings, and legality results, while `decks` reads legality results by contract.

Why it matters:

- This is not a wording nit. It affects package ownership, type ownership, caching, persistence of legality snapshots, and whether the deck context is allowed to reinterpret legality semantics.

Risk level:

- HIGH

Recommendation:

- Resolve this explicitly before implementation.
- Recommended direction: `legality` should own legality result semantics and result construction; `decks` may own references to validation requests, stored validation snapshots, or user-facing attachment of results, but not the meaning of legality itself.

### Issue 2: Ownership of `validation target` is also ambiguous

Issue:

- The principles document gives `validation targets` to deck modules.
- The legality document defines a broader `validation context` that includes deck version, format profile, restriction snapshot, support state, and declared scope.

Why it matters:

- If `validation target` is interpreted too broadly inside `decks`, the deck context may start owning pieces of legality semantics that belong in `legality`.

Risk level:

- MEDIUM

Recommendation:

- Split the terms cleanly.
- Let `decks` own deck snapshots or deck-version references used as validation inputs.
- Let `legality` own validation context assembly and interpretation.

## Identity Model Risks

### Issue 3: The core identity model is coherent, but the shared rule-key contract is still implicit

Issue:

- The identity policy correctly centers deck references, legality targets, and gameplay references on `canonical card`.
- However, name-based rules, choice restrictions, and "same-name or same-card" logic still rely on phrases such as "explicit gameplay-level rule keys" without one explicitly defined cross-context contract.

Why it matters:

- Without a defined rule-key policy, different modules may each derive their own version of:
- normalized gameplay name;
- same-card grouping logic;
- restriction target resolution;
- effect reference lookup keys.

Risk level:

- MEDIUM

Recommendation:

- Define one narrow, explicit gameplay rule-key contract or naming policy before legality and rules implementation deepens.
- Do not let each context derive name-based semantics independently.

### Issue 4: Printing misuse risk is low conceptually, but still high implementation temptation

Issue:

- The documents consistently say printings are not gameplay identity.
- The remaining risk is practical: collection, display, and importer flows are the exact places where implementers are likely to pass printing ids too far into deck, legality, or gameplay code.

Why it matters:

- This will not look like a contradiction at first. It will look like convenience. That is exactly why it is dangerous.

Risk level:

- MEDIUM

Recommendation:

- Treat any use of printing identity in deck legality or runtime gameplay as suspicious unless explicitly justified by a rule.
- Add this as a review checklist item during implementation.

## Format and Deck Model Risks

### Issue 5: The format model is structurally strong, but format-profile ownership is not defined

Issue:

- `format profile` is central to decks, legality, and future rules.
- The documents define what a format profile is, but they do not clearly assign who owns the published format-profile contract and its lifecycle.

Why it matters:

- Shared upstream contracts with no owner tend to become duplicated, partially forked, or moved into a giant shared-core package.

Risk level:

- HIGH

Recommendation:

- Explicitly assign ownership of the format-profile contract before monorepo/module implementation.
- The owner does not need to be a separate bounded context, but it does need to be explicit.
- Also decide whether support-state capability metadata lives beside format profiles, inside a resolver, or inside legality-facing capability infrastructure.

### Issue 6: The deck-to-format attachment model is still underdefined

Issue:

- The architecture assumes deck legality always happens in a declared format profile.
- The documents do not yet clearly state whether a saved deck owns:
- a format key;
- a resolved format profile reference;
- a preferred format only for validation;
- or multiple format-specific legality views over one deck object.

Why it matters:

- This affects deck persistence, deck builder UX, legality caching, and whether changing the selected format mutates the deck object or only the validation context.

Risk level:

- HIGH

Recommendation:

- Define the deck-to-format contract before deck builder implementation.
- The minimum needed decision is whether format selection is a property of the deck, a property of the deck version, or an external validation target parameter.

### Issue 7: Standard hardcoding risk is reduced but not fully eliminated

Issue:

- The format document is explicit about avoiding Standard-as-default architecture.
- The remaining risk is that the first implementation wave will naturally target Standard deck building first.

Why it matters:

- The architecture can still be compromised even when the documents are correct, especially in UI-facing deck editing code.

Risk level:

- MEDIUM

Recommendation:

- Treat Premium and V Premium as implementation review tests, not only design tests.
- If the first deck builder implementation cannot represent a no-ride-deck format and a G-deck format without branching hacks, stop and fix the abstraction.

## Legality Model Risks

### Issue 8: The legality model itself is strong, but support-state ownership is still operationally unclear

Issue:

- The format document defines support state as capability-based.
- The legality document defines `support_status`, `assertion_status`, and `evaluation_completeness`.
- The architecture does not yet say which module or contract is the authoritative source for capability support metadata.

Why it matters:

- If support state is duplicated between format profile code, legality code, and web-app assumptions, the same request may produce inconsistent messaging.

Risk level:

- MEDIUM

Recommendation:

- Define one authoritative support-capability source before implementation.
- Do not let UI, format-profile resolvers, and legality result builders each invent their own support matrix.

### Issue 9: False-positive `legal` risk is low in the documents, but still a practical implementation trap

Issue:

- The legality document correctly requires full required evaluation before asserting `legal`.
- The risk is not in the written model. The risk is in implementers flattening the result into a boolean too early for deck builder or API convenience.

Why it matters:

- That would erase the most important correctness guarantee the legality model currently provides.

Risk level:

- MEDIUM

Recommendation:

- Treat boolean legality outputs as forbidden unless they are explicitly derived from the richer model for a narrow display purpose.
- Keep the multi-axis result contract intact at module boundaries.

### Issue 10: Legality and gameplay are conceptually separated, but match-entry interaction remains undefined

Issue:

- The documents correctly keep `legality` and `rules` separate.
- They do not yet define how a future match-entry flow uses legality outputs, if at all, before passing input into gameplay.

Why it matters:

- Without a clear boundary, a future implementation may let `rules` depend directly on legality verdict objects or may make legality responsible for gameplay gating.

Risk level:

- MEDIUM

Recommendation:

- Define a future match-entry boundary later, but keep one rule explicit now:
- gameplay may consume deck input and format input directly;
- gameplay must not use legality verdicts as its internal rules contract.

## Truth Boundary Violations or Weak Points

### Issue 11: The truth boundaries are strong, but they still depend on shared-contract discipline

Issue:

- The truth-boundaries note correctly separates catalog truth, legality truth, and gameplay truth.
- The weak point is practical: if shared contracts are not explicitly scoped, a single shared package can quietly collapse those boundaries again.

Why it matters:

- A giant shared-core module would reintroduce exactly the coupling the truth-boundaries note was created to prevent.

Risk level:

- HIGH

Recommendation:

- Before implementation deepens, define the minimal allowed shared-contract surface between contexts.
- Keep it narrow: identity keys, format-profile contract, deck snapshot input, legality result shape, and curated gameplay-read models only where truly needed.

### Issue 12: Catalog-to-gameplay projection is acknowledged but not yet fenced tightly enough

Issue:

- `rules` is allowed to read catalog through curated gameplay-relevant facts.
- That curated projection is not yet defined.

Why it matters:

- Without a curated projection, the easiest implementation path is for `rules` to import full catalog models and drag printings, product metadata, or importer concerns into gameplay.

Risk level:

- HIGH

Recommendation:

- Define a curated gameplay-facing card projection before any rules module is implemented.
- Make it intentionally smaller than the full catalog model.

## Bounded Context Issues

### Issue 13: The context map is good, but there is still one important ownership vacuum

Issue:

- `catalog`, `decks`, `legality`, `rules`, `importer`, `social`, and `web app` are defined clearly.
- The architecture still lacks an explicit home for shared upstream contracts such as `format profile`, `deck snapshot input`, and curated gameplay-facing card facts.

Why it matters:

- If these contracts are left ownerless, they will either be duplicated inside multiple contexts or centralized into an overly broad shared package.

Risk level:

- HIGH

Recommendation:

- Formalize a minimal shared-contract strategy before package implementation.
- The answer may be a dedicated contracts package or a stricter publication model from one owning context, but it must be decided intentionally.

### Issue 14: Catalog and importer are mostly aligned, but publication boundary is still a bit soft

Issue:

- The dependency direction is correctly `importer -> catalog`.
- Some wording still leaves room for catalog to depend on importer-shaped normalized outputs rather than importer publishing into catalog-owned contracts.

Why it matters:

- That would leak importer workflow assumptions into catalog and weaken the long-term independence of published catalog truth.

Risk level:

- MEDIUM

Recommendation:

- Clarify that importer produces candidates through catalog-owned or shared ingestion contracts, but importer workflow state is never catalog truth.

## Dependency Direction Risks

### Issue 15: `decks -> legality` is correct, but could easily become `legality -> decks` in code

Issue:

- The context map says `decks -> legality`.
- The legality context reads `relevant deck snapshot input`.
- If the deck snapshot type lives inside deck internals, implementers may create an implicit `legality -> decks` dependency.

Why it matters:

- This would create the exact circular pressure the context map is trying to avoid.

Risk level:

- HIGH

Recommendation:

- Define a stable deck-snapshot contract before module wiring begins.
- `legality` should consume that contract, not the deck persistence model.

### Issue 16: `rules` may accidentally gain a shortcut dependency on legality

Issue:

- The documents say `rules` and `legality` are peer contexts.
- In practice, future match flows may tempt implementers to ask legality first and pass legality outputs directly into rules.

Why it matters:

- This would collapse admissibility and runtime truth into one pipeline and make future gameplay harder to reason about.

Risk level:

- MEDIUM

Recommendation:

- Keep the "shared upstream inputs, separate outputs" rule explicit in implementation reviews.
- If match-entry needs both legality and gameplay capability checks, compose them above both contexts.

## Ambiguity and Misinterpretation Risks

### Issue 17: The phrase "deck structures" is used in a way that can be misread

Issue:

- One document says deck modules should own deck structures.
- Another says deck structure is determined by format profile.

Why it matters:

- This can lead to two different interpretations:
- decks own the stored sections and shape of a specific deck object;
- or decks own the rules for what structures are allowed.

Risk level:

- MEDIUM

Recommendation:

- When implementation begins, use stricter wording:
- `decks` owns stored deck sections and deck composition state;
- `format profile` plus `legality` own what structures are allowed.

### Issue 18: "Shared contract" is still a dangerous phrase unless bounded tightly

Issue:

- Several documents correctly call for shared contracts.
- Without a narrow definition, "shared contract" can become a polite name for a giant dependency bucket.

Why it matters:

- This is a classic way a clean monorepo turns into a soft monolith with one imported-everywhere package.

Risk level:

- MEDIUM

Recommendation:

- Keep the shared surface intentionally minimal and review every addition against context ownership.

## Risk Classification

### HIGH RISK

- ownership conflict between `decks` and `legality` over legality results and validation-target semantics;
- no explicit ownership/publication strategy for shared upstream contracts such as `format profile`, `deck snapshot`, and curated gameplay-facing card facts;
- deck-to-format attachment policy is still underdefined;
- curated gameplay projection from catalog to rules is not yet defined;
- risk of accidental `legality -> decks` dependency if deck snapshot contracts are not extracted cleanly.

### MEDIUM RISK

- support-state capability ownership is still operationally unclear;
- importer-to-catalog publication boundary is slightly under-specified;
- same-name and gameplay rule-key semantics are still implicit rather than formally contracted;
- Standard-first implementation pressure may still produce UI-level hardcoding despite the correct architecture;
- future match-entry orchestration between legality and rules is still open.

### LOW RISK

- exact social publication read-model shape;
- whether later product growth adds collection, match-history, or tournament contexts as separate bounded contexts;
- exact warning-severity taxonomy for legality messaging.

### ACCEPTABLE UNKNOWNS

- future Premium variants such as Extreme Fight;
- detailed gameplay engine input and action models beyond current boundary notes;
- exact monorepo folder layout;
- exact service-versus-read-model split for every cross-context integration.

## Readiness Assessment

### Monorepo Setup

Assessment:

- READY

Why:

- The context map and dependency directions are now strong enough to guide monorepo boundaries.

Condition:

- Shared-contract ownership should be decided early in monorepo planning, not after packages already exist.

### Module Implementation

Assessment:

- GO WITH CONDITIONS

Why:

- Catalog, importer, and some cross-context foundations can begin.
- Deep deck, legality, and rules implementation should not proceed until the ownership and contract gaps above are resolved.

### Data Layer

Assessment:

- GO WITH CONDITIONS

Why:

- The identity model is strong enough to support early data modeling.
- The deck-to-format and deck-snapshot decisions should be fixed before deck and legality persistence contracts become concrete.

### Deck Builder

Assessment:

- NOT READY FOR FULL IMPLEMENTATION YET

Why:

- The deck object's relationship to format selection and legality result attachment is still too ambiguous.

### Importer

Assessment:

- READY FOR FOUNDATION WORK

Why:

- Importer-to-catalog direction is clear enough for raw source handling, normalization flow, provenance, and review queue foundations.

Condition:

- Keep importer from publishing its own long-term domain types.

## Required Fixes Before Implementation

1. Resolve ownership of legality results and validation-target semantics between `decks` and `legality`.
2. Define the minimal shared-contract surface and assign ownership or publication strategy for it.
3. Define the deck-to-format attachment policy.
4. Define the stable deck-snapshot contract consumed by legality and, later, gameplay entry flows.
5. Define the curated gameplay-facing card projection from catalog to rules.
6. Clarify who owns capability-support metadata for format and legality evaluation.

## Optional Improvements

1. Tighten wording around deck structures versus deck-structure rules.
2. Add a small note on how legality snapshots may be attached to deck versions without shifting legality ownership into decks.
3. Add a short guidance note for implementation reviews: printing identity in deck/legality/gameplay code should be treated as suspicious by default.
4. Add a future match-entry boundary note before rules implementation becomes real.

## Final Verdict

Verdict:

- GO WITH CONDITIONS

Why:

- The architecture is strong enough to start monorepo work and early foundational modules.
- The remaining risks are not conceptual collapse risks; they are ownership and contract-definition risks.
- Those risks are serious enough that they should be fixed before deep implementation of decks, legality, and gameplay-facing modules.

Most critical items:

1. Resolve the `decks` versus `legality` ownership conflict for legality results and validation-target semantics.
2. Define and assign ownership for the shared upstream contract surface.
3. Lock the deck-to-format attachment model.
4. Define the deck-snapshot contract to prevent `legality -> decks` coupling.
5. Define the curated gameplay-facing projection from catalog to rules.
