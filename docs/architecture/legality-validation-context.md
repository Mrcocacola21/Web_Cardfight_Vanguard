# Legality Validation Context

Status: Initial legality contract  
Last updated: 2026-04-07

## Why This Document Exists

This document defines how the system should think about legality validation and how legality results should be expressed.

It exists because a Vanguard companion platform must distinguish at least three very different situations:

- a deck is actually invalid under known rules;
- the system does not support the requested validation scope;
- the system supports part of the validation scope but cannot evaluate everything yet.

If those cases are collapsed into one status, the platform will either overclaim certainty or underreport real violations. Both outcomes are bad:

- calling unsupported or partially evaluated decks "illegal" breaks user trust;
- calling partially checked decks "legal" creates false confidence;
- treating legality as a boolean makes deck builder UX, API contracts, and tests too weak for a phased-support product;
- blurring legality and gameplay rules pushes the wrong logic into the wrong systems.

This contract is meant to support:

- deck builder feedback;
- legality module design;
- future API and test contracts;
- honest support-state communication;
- future rules-engine integration without conflating legality with gameplay validation.

## What Legality Validation Means in This Project

### Decision 1: Legality Validation Is Pre-Game Validation of a Deck Against Known Construction and Restriction Rules

Decision:

- Legality validation evaluates whether a deck list is allowed for a declared format profile and validation context, using known deck-construction and restriction rules.

Rationale:

- The system needs a clear answer to the question: "Can this deck be used in this format according to the rules this platform currently knows and supports?"

Practical implication:

- Legality validation belongs to deck, format, and restriction logic.
- It does not require a full gameplay engine.

### Decision 2: Legality Validation Works on a Validation Context, Not Just a Deck Alone

Decision:

- A legality check must always be evaluated within an explicit `validation context`.

The context should conceptually include:

- the target deck or deck version;
- the resolved format profile;
- the requested validation capability;
- the relevant restriction-list or rule snapshot;
- the content coverage boundary the system is claiming;
- the current support state for the requested validation scope.

Rationale:

- A deck is not legal or illegal in the abstract.
- It is legal or illegal relative to a format, a rule baseline, and the scope the system can actually evaluate.

Practical implication:

- A legality result without context is not trustworthy enough to reuse across UI, API, or tests.

### Decision 3: Legality Validation Is Not Gameplay Simulation

Decision:

- Legality validation must not attempt to answer every question that a future rules engine will answer.

Rationale:

- Legality is about deck admissibility before play.
- Gameplay validation is about actions, effects, and state transitions during play.

Practical implication:

- Deck builder and legality modules should not take on runtime action legality, effect timing, or phase sequencing.

## Core Status Distinctions

### Decision 4: `Invalid` Means a Known Required Check Failed

Decision:

- A deck is `invalid` when at least one authoritative, evaluated legality rule fails in the current validation context.

Examples:

- wrong deck structure for the selected format;
- card outside the format card pool;
- copy-limit violation;
- restriction-list violation;
- known format-specific construction rule violation.

Rationale:

- Invalidity should be reserved for actual rule failures the system can justify.

Practical implication:

- `invalid` must not be used as a fallback label for unknown, unsupported, or unimplemented checks.

### Decision 5: `Unsupported` Means the System Cannot Provide a Dependable Validation Contract for the Requested Scope

Decision:

- A validation request is `unsupported` when the requested legality capability cannot be evaluated dependably by the current system.

Examples:

- the format is recognized but legality support for that capability does not exist;
- the system does not support the relevant rule family at all;
- the requested validation scope is outside declared support boundaries.

Rationale:

- Unsupported is a statement about platform capability, not deck quality.

Practical implication:

- Unsupported must never be silently translated into invalid.

### Decision 6: `Partially Supported` Means Some Checks Are Supported but the Full Requested Scope Is Not

Decision:

- A validation request is `partially supported` when the system can evaluate some required legality checks authoritatively, but not all of them.

Examples:

- deck structure and copy limits are supported, but a special rule family is not;
- card-pool eligibility is supported, but restriction coverage is incomplete;
- the format is known and deck construction is modeled, but legality support is incomplete for part of the declared scope.

Rationale:

- This is the normal state of a phased-support system and must be modeled honestly.

Practical implication:

- Partially supported does not imply valid.
- Partially supported does not imply invalid.
- It means the result must expose both what was checked and what remains unresolved.

### Decision 7: Unknown or Unevaluated Is Not the Same as Legal

Decision:

- If a required legality question was not evaluated, the system must not convert that absence into a positive legality claim.

Rationale:

- Unknown is epistemic uncertainty, not a passed rule.

Practical implication:

- The system must be able to say "we do not know enough to assert legality" without degrading that into either `legal` or `invalid`.

### Status Distinction Summary

| Concept                      | Meaning                                                 | What It Is Not         |
| ---------------------------- | ------------------------------------------------------- | ---------------------- |
| `invalid`                    | known evaluated legality failure                        | unsupported capability |
| `unsupported`                | no dependable legality contract for the requested scope | a failed rule          |
| `partially supported`        | some legality checks are supported, others are not      | legal by default       |
| `unknown` or `not evaluated` | no completed assertion for that check                   | legal result           |

## Validation Scope

### Decision 8: Legality Validation Should Cover Construction and Restriction Questions

Decision:

- Legality validation should normally evaluate the following categories:

1. deck structure;
2. format selection and format applicability;
3. allowed card pool eligibility;
4. construction basis such as nation-based or clan-based requirements;
5. section-specific rules such as ride deck or G deck constraints;
6. copy limits;
7. same-name or same-card checks;
8. restriction-list checks;
9. explicit special format-specific construction rules that the platform claims to support.

Rationale:

- These are the pre-game questions users expect a legality system to answer.

Practical implication:

- The legality module should be organized around named check categories rather than one undifferentiated pass or fail routine.

### Decision 9: Legality Validation Must Not Cover Runtime Gameplay Questions

Decision:

- Legality validation should not evaluate:

- whether a card can be played at a specific moment in a match;
- whether an action is legal in a current game state;
- whether an effect resolves correctly;
- whether a timing window is satisfied;
- whether a zone-based transition is legal during runtime play.

Rationale:

- Those are gameplay-engine concerns, not deck admissibility concerns.

Practical implication:

- If a team wants legality validation to answer a runtime match question, that is usually a sign the concern is in the wrong module.

## Restriction Checks

### Decision 10: Restriction Checks Are a Defined Subset of Legality Validation

Decision:

- Restriction checks are part of legality validation, not a separate unrelated subsystem.

Rationale:

- Restrictions modify what decks are allowed in a format.
- They are pre-game admissibility rules.

Practical implication:

- Restriction evaluation should be represented as an explicit check family within legality results.

### Conceptual Restriction Categories

The legality system should be able to represent at least these conceptual restriction types:

- banned;
- limited;
- restricted counts or quota-based limits;
- choice restrictions;
- format-specific restriction entries;
- explicit combination or compatibility restrictions.

### Decision 11: Restriction Checks Attach to Gameplay-Level Identity or Explicit Rule Keys

Decision:

- Restriction data should attach to canonical-card identity or explicit gameplay-level rule keys derived from it, not to printing identity by default.

Rationale:

- Restriction rules are usually about what gameplay card may appear in a deck, not which art or set version is being used.

Practical implication:

- Printing-level metadata may still be useful for provenance and audit, but it should not become the default target of restriction logic.

### Decision 12: Restriction Checks Must Be Explainable

Decision:

- Restriction failures should produce explainable outputs, not only a final invalid flag.

Rationale:

- Deck builders, API consumers, and tests need to know whether a failure came from a banned card, a count limit, a choice restriction, or another restriction family.

Practical implication:

- The legality result should preserve restriction-failure details as structured findings.

## Legality Result Model

### Decision 13: Legality Result Must Be Richer Than Boolean

Decision:

- A legality result must not be modeled conceptually as only `true` or `false`.

Rationale:

- The system must express invalidity, unsupported capability, partial support, unresolved checks, warnings, and evaluation completeness.

Practical implication:

- UI, API, and tests should consume a structured result contract.

### Recommended Result Axes

The legality result should express at least three top-level axes:

| Axis                      | Purpose                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `assertion_status`        | what the system can honestly assert: `legal`, `illegal`, or `no_assertion`                        |
| `support_status`          | whether the requested legality scope is `supported`, `partially_supported`, or `unsupported`      |
| `evaluation_completeness` | whether the requested validation was `fully_evaluated`, `partially_evaluated`, or `not_evaluated` |

### Decision 14: `Legal` May Be Asserted Only After Full Required Evaluation

Decision:

- The system should assert `legal` only when all required checks in the declared validation scope were evaluated and passed.

Rationale:

- A positive legality claim needs stronger confidence than a negative one.

Practical implication:

- A partially evaluated deck with no known failures is not automatically `legal`.

### Decision 15: `Illegal` May Be Asserted When an Authoritative Failure Is Known

Decision:

- The system may assert `illegal` when one or more authoritative required checks fail, even if some other checks remain unresolved.

Rationale:

- A known invalidity is still real invalidity.
- The platform should not hide a known failure just because another part of evaluation is incomplete.

Practical implication:

- The result should still expose partial support or partial evaluation alongside the illegality.
- Example: "illegal based on known checks; evaluation incomplete."

### Decision 16: `No Assertion` Is Required for Unsupported or Inconclusive Cases

Decision:

- The system should use `no_assertion` when it cannot honestly assert either `legal` or `illegal` for the requested validation scope.

Rationale:

- This avoids forcing all inconclusive situations into false legal or false invalid states.

Practical implication:

- `no_assertion` is the correct assertion status when validation is unsupported or when partial evaluation is insufficient to reach a dependable overall claim.

### Recommended Result Contents

In addition to the three top-level axes, a legality result should include:

- the validation context summary;
- evaluated check groups;
- failed checks;
- passed checks;
- unsupported checks;
- unresolved checks;
- warnings;
- explanatory messages suitable for user-facing display and tests.

### Finding Types

Each individual check result should be classifiable at least as:

- `passed`
- `failed`
- `unsupported`
- `unresolved`
- `warning`

### Result Semantics Summary

| Assertion Status | Support Status        | Completeness                               | Meaning                                                                 |
| ---------------- | --------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `legal`          | `supported`           | `fully_evaluated`                          | the deck is valid for the declared scope                                |
| `illegal`        | `supported`           | `fully_evaluated` or `partially_evaluated` | at least one authoritative rule failed                                  |
| `no_assertion`   | `partially_supported` | `partially_evaluated`                      | some checks ran, but the system cannot claim legality overall           |
| `no_assertion`   | `unsupported`         | `not_evaluated` or `partially_evaluated`   | the system does not provide dependable legality for the requested scope |

## Legality vs Gameplay Rules

### Decision 17: Legality and Gameplay Must Remain Separate Contracts

Decision:

- Legality rules answer: "May this deck be used in this format under known construction and restriction rules?"
- Gameplay rules answer: "May this action, effect, or state transition occur in this runtime game state?"

Rationale:

- They operate on different inputs, different timescales, and different responsibilities.

Practical implication:

- The legality module should depend on format profile, card identity, and restriction data.
- A future gameplay engine should depend on runtime state, actions, and effect logic.

### Examples of the Distinction

- A deck can be legal, while a particular in-match action is illegal.
- A deck can be partially supported in legality, even though no gameplay engine exists yet.
- A restriction entry can be fully validated by the legality system, while a runtime effect interaction remains outside legality scope.

### Decision 18: Legality Results Must Not Be Reused as Gameplay Truth

Decision:

- A legality result must not be treated as proof that gameplay actions using the deck are always legal.

Rationale:

- Deck legality is a pre-game admissibility statement, not a runtime state guarantee.

Practical implication:

- Future gameplay modules may consume the same canonical card and format profile contracts, but not legality outputs as substitutes for rules-engine evaluation.

## User-Facing and System-Facing Implications

### Decision 19: UI Must Communicate Incomplete Support Explicitly

Decision:

- The deck builder UI must distinguish at least:
- illegal based on known checks;
- legal within fully supported scope;
- partially evaluated or partially supported;
- unsupported.

Rationale:

- Users need honest signals, not optimistic simplifications.

Practical implication:

- Avoid labels like "legal" when unresolved or unsupported checks remain.
- Prefer messages such as "illegal", "cannot fully verify", or "validation unsupported" depending on the result axes.

### Decision 20: API Contracts Must Preserve Structured Legality Outcomes

Decision:

- API and system-facing layers should transmit the legality result as structured data, not as one flattened boolean or string.

Rationale:

- Consumers need more than pass or fail:
- UI needs messages and warnings;
- tests need deterministic findings;
- future services need support-state and completeness data.

Practical implication:

- API consumers should be able to tell the difference between invalid, unsupported, and partially evaluated without reverse-engineering free-form text.

### Decision 21: Deck Builder Behavior Must Follow Support and Completeness, Not Only Final Assertion

Decision:

- Deck builder UX should respond to both known failures and incomplete support.

Rationale:

- A deck with unresolved legality checks should not look the same as a fully validated legal deck.

Practical implication:

- The builder may still allow editing in partially supported cases, but it should warn that validation is incomplete.
- Unsupported validations should disable or clearly reject authoritative legality claims.

## Evaluation Completeness

### Decision 22: Evaluation Completeness Must Be Explicit

Decision:

- The legality result should explicitly state whether validation was:
- `fully_evaluated`
- `partially_evaluated`
- `not_evaluated`

Rationale:

- This is the cleanest way to support phased format rollout, rule-family expansion, and honest UI messaging.

Practical implication:

- Completeness becomes a first-class test dimension, not an implicit guess from other fields.

### Why Completeness Matters

Evaluation completeness helps the system:

- avoid false `legal` claims in partial-support scenarios;
- preserve useful negative results when known failures exist;
- communicate support limitations honestly;
- support future expansion of legality checks without breaking the result model.

### Decision 23: Support State and Completeness Are Related but Not Identical

Decision:

- `support_status` describes product capability.
- `evaluation_completeness` describes what happened in a specific validation attempt.

Rationale:

- A partially supported capability usually leads to partial evaluation, but they are not the same concept.
- A supported system can still return partial evaluation if required rule inputs are missing or unresolved.

Practical implication:

- Do not collapse support metadata and evaluation outcome into one field.

## Examples

### Example 1: Known Invalid Copy Limit

- The deck is in a supported format.
- Structure and card-pool checks pass.
- A known copy-limit check fails.
- Result:
- `assertion_status = illegal`
- `support_status = supported`
- `evaluation_completeness = fully_evaluated`
- failure detail explains the copy-limit violation.

### Example 2: Supported Format with Unsupported Special Rule

- The format profile and core structure are supported.
- A special construction rule exists for the selected deck shape, but that rule family is not yet implemented.
- No known failure has been found in evaluated checks.
- Result:
- `assertion_status = no_assertion`
- `support_status = partially_supported`
- `evaluation_completeness = partially_evaluated`
- unresolved checks explicitly name the unsupported special rule family.

### Example 3: Format Not Yet Supported by the System

- The user asks for legality in a format or format capability the system does not support.
- Result:
- `assertion_status = no_assertion`
- `support_status = unsupported`
- `evaluation_completeness = not_evaluated`
- UI and API say legality validation is unsupported, not illegal.

### Example 4: Restriction Violation

- The deck passes structure and card-pool checks.
- A restriction entry marks a canonical card as banned or a combination as disallowed.
- Result:
- `assertion_status = illegal`
- `support_status = supported`
- `evaluation_completeness = fully_evaluated`
- failure detail identifies the restriction type and target.

### Example 5: Structurally Legal Deck, Gameplay Questions Still Out of Scope

- The deck is fully legal for the format based on construction and restrictions.
- The user then asks whether a certain card interaction is legal during a specific turn sequence.
- That question is not answered by legality validation.
- Result:
- legality remains a pre-game `legal` result;
- runtime gameplay question is delegated to future gameplay validation, not legality.

### Example 6: Partially Supported Result with Known Failure

- The deck violates a known structure rule.
- Another advanced restriction family remains unsupported.
- Result:
- `assertion_status = illegal`
- `support_status = partially_supported`
- `evaluation_completeness = partially_evaluated`
- the UI should say the deck is illegal based on known checks and also that validation is incomplete overall.

## Final Recommendations

### Recommendation 1: Use Multi-Axis Legality Results

Recommendation:

- Model legality outcomes with separate assertion, support, and completeness axes.

Rationale:

- This is the cleanest way to represent invalid, unsupported, and partial-support states honestly.

### Recommendation 2: Reserve `Legal` for Fully Evaluated Positive Results

Recommendation:

- Do not mark a deck `legal` unless all required checks in the declared validation scope have been evaluated and passed.

Rationale:

- Positive claims should have the highest evidence standard.

### Recommendation 3: Preserve Known Invalidity Even When Evaluation Is Incomplete

Recommendation:

- If a known authoritative rule fails, return `illegal`, but keep support and completeness metadata visible.

Rationale:

- This prevents a real violation from disappearing behind partial-support messaging.

### Recommendation 4: Keep Restriction Checks Inside Legality, Not Beside It

Recommendation:

- Treat restriction checks as a standard legality check family with explicit findings.

Rationale:

- Restrictions are part of deck admissibility, not a separate afterthought.

### Recommendation 5: Keep Legality and Gameplay as Neighboring, Not Merged, Systems

Recommendation:

- Build the future legality engine on format profile, canonical-card identity, restriction data, and validation context.
- Build future gameplay validation on runtime state and action semantics.

Rationale:

- They should share inputs where appropriate, but not collapse into one overburdened module.

## Open Questions We Intentionally Leave for Later

The following remain intentionally open:

- the exact shape of validation context identifiers and versioning metadata;
- the exact transport shape of user-facing message bundles in API contracts;
- the final taxonomy of warning severities and localization-ready message formats;
- the exact future relationship between legality validation snapshots and gameplay-session creation flows;
- the exact composition of advanced format-specific special-rule families as coverage expands.

These are legitimate next-step decisions, but they should build on the contract above rather than weaken its core distinctions.
