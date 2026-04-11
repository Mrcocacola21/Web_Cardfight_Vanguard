# Roadmap Rebase After Phase 8

## 1. Purpose

This note records why the roadmap needed to be rebased after Phase 8 and what
assumptions now govern the next execution block.

## 2. Why the Roadmap Needed Rebase

The original roadmap still described several future phases as greenfield work
even though the repository had already moved past that state.

Without a rebase, the roadmap would:

- describe existing foundations as if they did not exist;
- encourage duplicated implementation work;
- hide real prerequisites behind misleading phase wording;
- make checkpoints harder to evaluate honestly.

## 3. Repo Reality vs Original Roadmap Assumptions

The repository is no longer at a blank-slate stage.

Already present in the repo:

- importer, publication, and published catalog truth boundaries;
- wave-1 published content and catalog-facing product/card surfaces;
- partial deck package, deck persistence, deck repository, and deck read-side;
- user-owned schema foundations for decks, collections, social, and matches;
- baseline authorization and RLS for owner-owned resources;
- legality and keyword data already modeled as persisted catalog-facing facts;
- `packages/legality`, `packages/social`, and `packages/rules-core` as domain
  or contract baselines.

## 4. Key Rebased Areas

### Deck

- roadmap wording now treats deck work as completion and extension of an
  existing foundation
- deck references remain canonical-card based

### Read-side

- deck and catalog read paths already exist
- next phases build write workflows and editing experiences on top of those
  read-side baselines instead of pretending they must be created from zero

### Content / Publication Dependencies

- deck builder and validation now explicitly depend on published catalog truth,
  legality data, and broader Standard content beyond wave 1
- importer/publication work is treated as an existing operational foundation,
  not future invention

### Security / RLS Placement

- baseline owner-based authorization moved before the next write-heavy feature
  phases
- the later security phase is now framed as expansion and audit, not initial
  enforcement

### Collection Semantics

- collection remains printing-level
- deck remains canonical-card based
- the rebased roadmap makes that dependency explicit instead of leaving it as a
  hidden architectural assumption

## 5. Revised Execution Assumptions

The rebased roadmap assumes:

- Phase 8 is complete and published catalog truth exists;
- the pre-Phase 9 stabilization block is already closed:
  - publication lifecycle accounting
  - persisted runtime-backed pipeline proof
  - baseline authorization / RLS
- deck-first sequencing remains the correct near-term product order;
- Standard content expansion must happen early enough to make deck workflows
  genuinely useful;
- gameplay and realtime work continue later, on top of already stabilized deck,
  content, and match foundations.

## 6. Summary

The roadmap no longer starts from an imaginary greenfield state.

It now assumes the real repository baseline, keeps the agreed phase order, and
describes future work as:

- complete;
- extend;
- build on top of;

instead of recreating foundations that are already in place.
