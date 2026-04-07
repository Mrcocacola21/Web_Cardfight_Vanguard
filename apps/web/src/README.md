# apps/web/src

This directory is reserved for application-layer code.

Intended use:

- compose public package surfaces;
- host App Router entry points and route-level orchestration;
- keep domain decisions in domain packages, not here.

Current baseline structure:

- `app/`
  - routing, layout, and app shell files
- `components/`
  - app-local presentation pieces
- `lib/`
  - app-local configuration and orchestration helpers

Do not add domain ownership here because the app layer needs a shortcut.
