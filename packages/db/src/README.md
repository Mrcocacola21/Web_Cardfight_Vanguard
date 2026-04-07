# packages/db/src

This directory is reserved for persistence-facing implementation.

Boundary rule:

- keep low-level storage concerns here;
- do not let this package define cross-context domain meaning.
