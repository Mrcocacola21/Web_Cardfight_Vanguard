# Content Wave 1 Pipeline Run

## 1. Purpose

Provide one explicit integrated pipeline proof for wave 1:

- dev JSON input
- raw import
- normalization
- manual review queue creation

This step verifies importer behavior as a system. It does not publish anything
into final catalog truth.

## 2. Seed Used

Fixture:

- `packages/importer/fixtures/dev-json/content-wave-1-standard-ddz-minimal.json`

Execution mode:

- focused integration run via the real `createDevJsonImportRunner`
- real raw product importer
- real raw card-printing importer
- real card-printing normalizer
- real manual review queue logic
- stateful importer repository harness used for deterministic reproducibility

Why this mode was used:

- the current local workspace runtime exposed Postgres only and did not expose
  the local Supabase REST/API endpoint required by the CLI wrapper
- the integrated run still exercised the actual importer services and stage
  transitions end to end

## 3. Pipeline Stages Executed

Executed stages:

1. dev JSON document read and normalization
2. tracked source creation / resolution
3. tracked job creation
4. raw product import
5. raw card-printing import
6. card-printing normalization
7. manual review queue sync
8. job finalization in `blocked_for_review`

Observed tracked identities in the integrated run:

- source: `source-1`
- job: `job-1`

Final job state:

- `jobStatus = blocked_for_review`
- `currentStage = normalization`
- `publishedRecordCount = 0`

## 4. Raw Import Outcomes

Observed raw outcomes:

- raw products: `3`
- raw printings: `4`
- all raw records linked to `job-1`
- all 4 raw printings linked to raw product context

Raw product cases created:

- `D-BT01 Genesis of the Five Greats`
- `DZ-BT01 Fated Clash`
- `DZ-BT02 Illusionless Strife`

Raw printing cases created:

- `Apex Ruler, Bastion`
- `Fated One of Miracles, Rezael` (`DZ-BT01/010EN`)
- `Fated One of Miracles, Rezael` (`DZ-BT01/DSR01EN`)
- `Fated One of Time, Liael=Amorta` (`DZ-BT02/010EN`)

## 5. Normalization Outcomes

Observed normalization summary:

- processed: `4`
- created: `4`
- skipped: `0`
- superseded: `0`
- auto-resolved: `3`
- unresolved: `1`
- ambiguous: `0`
- blocked-for-review results: `0`
- ready-for-publication count: `3`

Observed canonical attachments:

- `Apex Ruler, Bastion` -> `entity-bastion`
- `Fated One of Miracles, Rezael` primary printing -> `entity-rezael`
- `Fated One of Miracles, Rezael` parallel printing -> `entity-rezael`
- `Fated One of Time, Liael=Amorta` -> unresolved, no canonical entity attached

This preserves the intended semantics:

- printings remain printing-level records
- canonical entity attachment happens only in normalization output
- unresolved printing stays unresolved instead of being guessed through

## 6. Review Queue Outcomes

Observed review queue summary:

- total items: `1`
- open: `1`
- in review: `0`
- resolved: `0`
- rejected: `0`
- superseded: `0`
- cancelled: `0`

Created review item:

- reason: `unresolved_mapping`
- status: `open`
- linked to:
  - `job-1`
  - the Liael raw printing record
  - the Liael normalization result

## 7. Per-Case Results

### Normal Case

Card:

- `Apex Ruler, Bastion`

Observed result:

- raw import succeeded
- normalization auto-resolved
- no review item created

### Multiple Printings Case

Card:

- `Fated One of Miracles, Rezael`

Observed result:

- two raw printing records imported
- both normalized to the same canonical entity
- no duplicate canonical entity implied by normalization output
- no review item created

### Ambiguity / Review Case

Card:

- `Fated One of Time, Liael=Amorta`

Observed result:

- raw import succeeded
- normalization remained unresolved
- one manual review item was created
- no silent canonical attachment happened

## 8. Publish Boundary Verification

Verified in the integrated run:

- no final catalog publication occurred
- `publishedRecordCount` remained `0`
- the run stopped at raw / normalization / review layers
- there were no catalog-truth write side effects in the harness

This confirms the intended boundary:

- importer pipeline exercised
- publication not executed

## 9. What This Step Explicitly Did NOT Do

- publish products or printings into final catalog truth
- run a large content wave
- validate production upstream parsing
- introduce admin or review UI
- perform load or performance testing

## 10. Summary

Wave 1 now has one explicit integrated importer proof:

- tracked source/job creation
- observable raw stage
- observable normalization stage
- observable review queue creation
- per-case verification for:
  - normal
  - multiple printings
  - unresolved/review

Reproducible verification artifact:

- `packages/importer/src/dev-json/content-wave-1-pipeline-run.test.ts`
