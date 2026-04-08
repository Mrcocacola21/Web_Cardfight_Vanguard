# Migrations Guide

## 1. How Migrations Are Structured

Migrations are split into small, dependency-aware steps instead of one schema dump.

The current ordering follows three rules:

- create extensions and schemas first
- create root tables before dependent tables
- create table-local indexes and critical constraints in the same migration when they are part of the table's meaning

The repository is organized by bounded context and dependency direction:

1. base and schemas
2. content layer
3. user layer
4. gameplay runtime layer

## 2. Execution Order

Current migration flow:

1. base extensions and schemas
2. product families
3. formats
4. rule profiles
5. rule-profile structure and trigger rules
6. rule-profile product-family and marker support
7. products
8. card entities
9. card printings
10. rule-profile eligibility overrides
11. restriction lists
12. restriction rules
13. profiles
14. collections and collection items
15. decks, versions, and deck cards
16. friend relationships
17. user-facing matches
18. gameplay rooms, players, snapshots, events, and pending choices

The ordering is explicit because later layers depend on earlier identities:

- user data depends on content and format identities
- gameplay runtime depends on user-layer participants and admitted deck inputs

## 3. Naming Convention

Migration files use:

- a sortable timestamp prefix
- a short snake_case description

Pattern:

```text
YYYYMMDDHHMMSS_descriptive_name.sql
```

Examples:

- `20260408120300_create_rule_profiles.sql`
- `20260408122300_create_gameplay_room_events.sql`

## 4. How to Add New Migrations

When adding a new migration:

1. add one logical change per file
2. place it after every dependency it needs
3. keep the file readable enough for review without scrolling through unrelated tables
4. add only the indexes and constraints that are essential for that step
5. prefer a new migration over rewriting an existing applied migration

If a change is a refinement rather than a new entity, add a follow-up migration instead of overloading the original creation step.

## 5. What Not to Do

Do not:

- add giant migrations that create unrelated parts of the system at once
- mix content, user, and gameplay concerns in one file without a dependency reason
- add RLS, triggers, helper functions, or seed logic into these structural schema migrations
- create foreign keys before their target tables exist
- hide important constraints in later undocumented ad hoc patches

Schema structure should stay boring, explicit, and reviewable.
