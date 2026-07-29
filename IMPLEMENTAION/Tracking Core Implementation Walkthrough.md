# Phase 1: Tracking Core Implementation Walkthrough

The foundational tracking logic and schema for Kureha has been fully implemented, adhering strictly to the pure function and disconnected-backend boundaries set out in `PHASE_1_TRACKING_CORE.md`.

## Accomplishments

- **Pure Functional Logic**: We created the `deriveProgress`, `markWatched`, `rewatchSeason`, and other core functions in `src/core/progress.ts` and `src/core/tracking.ts`. These handle all data mutations and state derivations synchronously without touching a real database.
- **Data Schema Setup**: `src/core/schema.sql` defines the `tracked_media` and `watched_episodes` tables, strictly encoding the dual-axis (Intent vs Progress) architecture of Kureha.
- **Fixture Testing Suite**: The implementation is rigorously tested using a local Vitest suite mapping identically to the Definition of Done in the spec. All **22 tests** are currently passing, including the edge case additions.

## Key Behaviors Validated

> [!NOTE]
> **Intent vs Progress Isolation**
> The system strictly separates a user's *intent* (e.g. `paused`, `watch_later`) from the *computed progress* of how much they have watched. The test suite proves that a paused show can still compute as `caught_up`, and a paused show marked as watched is automatically flipped to `active`.

> [!TIP]
> **Per-Episode Accuracy in Batch Rewatches**
> When a user triggers `rewatchSeason()`, we iterate through each episode individually. If they previously skipped an episode (like E04), it is assigned a `rewatch_count` of `1` with a fresh timestamp, while E01-E03 correctly increment their count to `2` while maintaining their original timestamps.

> [!IMPORTANT]
> **Schema Constraint Enforcement**
> We validated the database rules using an in-memory `better-sqlite3` harness. The tests prove that a `watched_episodes` row cannot exist without a corresponding `tracked_media` entry, ensuring tight relational data integrity.

## Recent Fixes
- `markWatched` now correctly handles the `null` media auto-add-to-library feature, driven by an explicit `mediaInfo` config object in its options signature.
- `getSkippedEpisodes` safely handles and ignores mismatched provider data (e.g., if a watched episode ID is no longer present in the canonical season array).
