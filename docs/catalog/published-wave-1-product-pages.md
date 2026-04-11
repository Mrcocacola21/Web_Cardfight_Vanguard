# Published Wave 1 Product Pages

## 1. Purpose

Define the first user-facing product/set pages that read only published
catalog truth from wave 1.

These pages are catalog UI surfaces, not importer admin views. They do not read
raw importer records, normalization outputs, or review items directly.

## 2. Scope

This step surfaces the currently published wave-1 products only:

- `D-BT01 Genesis of the Five Greats`
- `DZ-BT01 Fated Clash`
- `DZ-BT02 Illusionless Strife`

The scope is limited to product-centric detail pages backed by published
catalog data.

## 3. Which Products Are Surfaced

Wave-1 product pages exist for products that crossed the publication boundary
into `catalog.products`.

This means the UI can surface:

- published release metadata
- published printing rows attached to each product

It does not imply that every raw/imported card from those releases is already
published.

## 4. Published-Data Read Path

Page data flow:

1. `apps/web` route calls `getCatalogProductDetail(...)`
2. server read code builds a catalog-facing read model
3. `createCatalogRepository(...)` reads:
   - `catalog.products`
   - `catalog.card_printings`
   - canonical card references from `catalog.card_entities`
4. page renders the resulting product detail model

What does **not** happen:

- no reads from importer raw tables
- no reads from normalization results
- no reads from review queue state
- no UI fixture fallback

## 5. Release Info Rendering

The page renders compact release metadata from published catalog truth:

- product name
- official code
- product category / kind
- family / lineage context
- release date
- region

This keeps the page product-centric and avoids importer/debug provenance noise.

## 6. Printing List Semantics

The printing list remains printing-centric.

For wave 1 this matters most for `Fated One of Miracles, Rezael`:

- two published printing rows exist
- both belong to `DZ-BT01 Fated Clash`
- both point to one canonical card entity
- they remain separate printing entries on the product page

The page therefore shows:

- one release container (`Product`)
- many concrete published printings (`CardPrinting`)
- canonical card references reachable from each printing (`CardEntity`)

## 7. Handling of Unresolved / Non-Published Records

Unresolved importer outcomes do not appear on the page.

Wave-1 example:

- `Fated One of Time, Liael=Amorta` remained unresolved
- it stayed in review flow
- it was not published
- it does not appear as product content on the wave-1 product pages

This means a published product may honestly render with fewer printings than
were seen during raw import, or even with no currently published printings.

## 8. What This Step Explicitly Does NOT Do

This step does not:

- expose importer internals to users
- show normalization status or review reasons
- publish new data
- treat unresolved records as content
- create a second product-page architecture just for wave 1

## 9. Summary

Wave-1 product pages now prove that publication makes content usable for the
catalog UI:

- product pages read published catalog truth only
- release info is product-centric
- printing lists preserve printing identity
- shared canonical entity references remain intact
- unresolved review-stage content stays out of the user-facing surface
