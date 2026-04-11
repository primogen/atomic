# Changelog

All notable changes to Atomic are documented here.

## v1.20.1 — 2026-04-11

- Fix release notification formatting in the CI pipeline (no user-facing changes).

## v1.20.0 — 2026-04-11

- Add configurable auto-tag categories — choose which top-level tags the AI auto-tagger is allowed to extend (e.g. disable People/Locations if you don't need them, or add your own like "Projects" or "Books"), manageable during onboarding and in Settings → Tags
- Add Obsidian plugin onboarding wizard with a 4-step setup flow, database selection, size-based sync batching, YAML frontmatter stripping, and real-time sync progress reporting
- Fix mobile layout — sidebar, chat, and filter controls now work correctly on small screens with a slide-in sidebar, full-width chat overlay, filter bottom-sheet, and an overflow menu for reader actions
- Fix Obsidian plugin resync loop when the target database already contains atoms — re-syncing to a populated database now deduplicates server-side instead of retrying endlessly
- Skip the onboarding wizard when connecting to a server that is already configured with an AI provider
- Fix Obsidian plugin wiki view to preserve citation markers for notes outside the current vault instead of stripping them
