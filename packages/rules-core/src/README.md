# packages/rules-core/src

This directory is reserved for rules-core domain implementation.

Boundary rule:

- keep gameplay state, action, event, request, boundary, error, and transition contracts here;
- keep format adapters in `src/formats` when they extend the same pure engine boundary;
- keep implementation pure and deterministic;
- do not mix in UI, runtime wiring, persistence, or importer code.
