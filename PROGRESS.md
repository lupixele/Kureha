## Current State
Phase 2 (Wiring the Tracker) stabilization underway. The tracker domain is implemented as pure functions, wired into Supabase Postgres with Google OAuth, Drizzle ORM, and TanStack Start. The application maintains a clean tracker-only architecture with a two-axis model (progress + intent) and no streaming logic.

## Recent Decisions
- Fixed major new-title persistence bug (implemented transaction + parent upsert in mark-watched).
- Removed auto-seeding on library reads; replaced with explicit dev seed script.
- Added database constraints and integration tests for mark-watched persistence.
- Verified expected behaviour of episode UI with rewatch increment.

## Next Steps
1. **Stabilization & Closure of Phase 2**: Fix remaining seed script/type inconsistencies, harden DB constraints and concurrent mutation semantics, and add a test-mode DB environment.
2. Complete full verification and commit the stable working tree.
3. Design the canonical media/provider identity.
4. Implement TMDB primary metadata client.

## Open Questions / Blockers
- **Provider Identity**: Canonical provider/media identity needs to be settled for TMDB primary + per-title TVDB fallback.
- **Episode Mapping**: Episode mapping/renumbering strategy for provider corrections.
- **Unknown Episode Count**: Rule for unknown episode-count progress before real metadata can be incomplete.

## Last Updated
2026-08-18
