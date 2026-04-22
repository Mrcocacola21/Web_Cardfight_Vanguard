# Binder/List View Foundation

## 1. Purpose

Turn private collection storage into a usable collector-facing inventory
surface.

This step adds the first owner-only collection page that reads owned
`CardPrinting` rows and presents them in practical binder and list modes.

## 2. Route / entrypoint

The collection route is `/(protected)/collection`, exposed to users as
`/collection`.

This is the primary entrypoint for collection mode and stays owner-only.

## 3. Collection read model

The page reads from collection persistence and catalog truth together.

Each inventory item includes:

- collection item identity and owner scope
- `card_printing_id`
- `quantity`
- linked printing summary
- linked card summary
- linked product summary
- catalog state for stale-linked rows

No second shadow collection model is introduced.

## 4. Binder view

Binder mode is a collector-facing grid of compact inventory cards.

Each card shows the owned printing, quantity badge, rarity/product context,
variant markers, and lightweight quantity actions.

## 5. List view

List mode is a denser inventory table.

It keeps the same underlying items but optimizes for scanning card name,
printing label, release context, and quantity.

## 6. Printing-level display semantics

Collection display stays printing-based.

- different printings render as different inventory entries
- alt art, promo, and rarity variants are not collapsed into one count
- canonical card/product data is display context only, not the owned unit

## 7. Ownership/privacy semantics

The page only shows the current owner profile's collection items.

- server read path resolves the current authenticated profile
- repository reads are owner-scoped
- existing collection RLS still protects the underlying rows
- no public or shared collection visibility is added here

## 8. Empty state behavior

If the owner has no collection rows, the route renders an explicit empty state
instead of an empty shell.

The page explains that no owned printings exist yet and points the user back to
the catalog as the next action.

## 9. What is intentionally NOT implemented yet

- wishlist or favorites
- public/shared collections
- analytics or completion tracking
- pricing or marketplace data
- import/export or scanning
- advanced search/filter platform
- entity-level ownership shortcuts

## 10. Summary

`/collection` is now the first practical inventory read surface for owned
printings.

The product keeps printing-level collection semantics intact while offering two
usable views over one owner-scoped read model. This is the foundation for later
collector features such as wishlist/favorites.
