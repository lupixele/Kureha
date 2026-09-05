# Kureha Milestone Ledger

This ledger is the compact execution checkpoint for work governed by [`docs/prd/PRD-001-kureha-core.md`](../prd/PRD-001-kureha-core.md). The PRD remains the product contract; this file records what was actually built and verified.

## Status vocabulary

- **Planned** — scope identified, not started.
- **In progress** — implementation is underway.
- **Verification** — implementation finished; gates or independent review remain.
- **Closed** — acceptance evidence passed and a durable Git checkpoint exists.

## Milestones

| Milestone | Scope | Status | Git checkpoint | Evidence |
|---|---|---|---|---|
| Baseline | Stabilize Phase 2 core, approve PRD-001, isolate opt-in Postgres tests | Closed | `58d66be` | 23 unit tests, typecheck, build |
| M1 | Canonical media identity and mapping-history schema | Closed | `e979965` on `feat/m1-canonical-media-identity` | 29 tests including PGlite `0000 → 0001`, typecheck, build, diff check, Graphify update, independent review PASS |
| M2 | Tracking migration to canonical group/episode IDs | Closed | `5fc22a2` on `feat/m2-canonical-tracking-references` | 40 PGlite tests, typecheck, build, diff check, Graphify update, final independent review PASS |
| M3 | Metadata providers, canonical ingestion, artwork, and adaptive refresh | In progress | Branch `feat/m3-metadata-provider-ingestion` | Independent contract review PASS; owner approved 2026-09-01; M3-A database contract in progress |

## M1 acceptance record — 2026-08-31

### Delivered

- Stable Kureha IDs for media groups, continuity tracks, installments, and episodes.
- Canonical active provider mappings separated from versioned mapping-history entries.
- Mapping versions with draft/active/rejected/superseded states and one-active-version protection.
- Group release-state evidence with source, precision, exact/date-only timing, cache timestamps, and review state.
- Separate group release states and installment provider statuses.
- Profiles with private-by-default visibility, username/display-name constraints, and name-change audit support.
- PGlite-backed migration and constraint tests.
- Clean generated migration: `drizzle/0001_M1_canonical_media_identity.sql`.

### Acceptance evidence

- `npm test`: **29/29 passed** across 4 files.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `graphify update .`: completed; graph rebuilt.
- Fresh-context adversarial review: **PASS**; all ten prior findings resolved.

### Non-blocking follow-ups

These are deliberately not hidden inside “done”:

1. Add uniqueness for `(media_group_id, version_number)` before mapping-version write services are exposed.
2. Enforce that version entries target entities belonging to the mapping version’s media group in the M2 transaction/repository layer (or strengthen with compound database keys).
3. Add Supabase `auth.users` linkage and RLS policies in the real-Postgres authorization milestone.

### Closure record

M1 was closed by commit `e979965` (`feat(identity): add canonical media schema and mapping history`) on `feat/m1-canonical-media-identity`. It has not been pushed or merged.

## Next milestone proposal: M2 — Canonical tracking references

Goal: migrate user tracking from provider-shaped `media_id + season/episode numbers` to stable Kureha IDs without losing existing history or breaking current server functions.

Minimum scope:

1. Define migration/backfill contracts for legacy `tracked_media` and `watched_episodes`.
2. Reference `media_groups.id` from library/tracking rows and `episodes.id` from watched rows.
3. Preserve current data while flagging unmatched legacy records for mapping review.
4. Update adapters/repositories transactionally behind current server-function behavior.
5. Prove the migration and compatibility in PGlite before any Supabase migration.
6. Keep provider clients, search UI, social/RLS, and community watch orders out of M2.

### M2 decision D-001 — legacy development tracking data

The current `tracked_media` and `watched_episodes` contents are disposable development data. M2 will delete those existing rows during the canonical-reference migration instead of building a temporary provider-ID backfill bridge. The schema migration must still be safe and explicit, but preserving fake/dev watch history is not a requirement.

### M2 decision D-002 — API cutover

M2 will switch tracking mutations completely to Kureha canonical IDs. The old API shape (`mediaId` plus season/episode numbers) will not remain as a compatibility path. Episodic marks accept a stable Kureha `episodeId`; library/intent actions accept a stable Kureha `mediaGroupId`.

### M2 decision D-003 — movie watch storage

Movies will use a dedicated `watched_movies` table keyed by user and canonical `media_group_id`. Kureha will not create a fake Episode 1 for movies.

### M2 decision D-004 — user media state

Library membership and user intent will live in one `user_media_state` record per user and canonical media group. The record separates an `in_library` membership flag from the stored intent (`active`, `paused`, `watch_later`, or `dropped`) so those two product dimensions cannot overwrite each other.

### M2 decision D-005 — remove and re-add

Removing a title from the library sets `in_library = false` but preserves watched history and the stored intent. If the title is later re-added, Kureha restores that previous intent. Only the explicit destructive delete-tracking action removes the state record and watched history.

### M2 decision D-006 — rewatch storage

M2 retains the approved compact rewatch model: one watched row per user and canonical episode/movie plus a `rewatch_count` (`x2`, `x3`, and so on). It will not create a separate timestamped event row for every historical watch in v1. Re-marking increments atomically and preserves the original first-watched timestamp.

### M2 decision D-007 — catalogue identity prerequisite

Tracking mutations require the canonical media group and episode/movie identity to already exist in Kureha’s catalogue. An unknown canonical ID is rejected; Mark Watched never fabricates an unresolved title or episode. Marking a valid existing title may still create the user’s missing `user_media_state` transactionally, as required by `FR-059`.

### M2 decision D-008 — explicit mutation actions

The server exposes separate canonical actions: `markEpisodeWatched({ episodeId })` / `unmarkEpisodeWatched({ episodeId })` and `markMovieWatched({ mediaGroupId })` / `unmarkMovieWatched({ mediaGroupId })`. The UI may label both flows “Mark Watched,” but the server contracts remain explicit and cannot confuse a movie group with an episode.

### M2 decision D-009 — unmarking rewatches

When an affected row has `rewatch_count > 1`, the confirmation offers `Unmark once` (default) and `Unmark completely`. `Unmark once` decrements the count and deletes only a row whose count is 1. `Unmark completely` deletes the selected watched state regardless of count. This applies consistently to episodes, movies, and every row in a confirmed cascade scope.

### M2 clarification D-009A — unreleased library items

Unreleased titles may be added to the library normally and appear in Upcoming. The release prerequisite applies only to Mark Watched mutations: unreleased episodes/movies cannot be marked until confirmed released.

### M2 decision D-010 — idempotent mutations

Each tracking mutation carries a client-generated `operationId`. The server records it under the authenticated user and returns the original outcome when the same operation is retried, preventing timeouts or duplicate submissions from incrementing `rewatch_count` twice. A new deliberate rewatch uses a new operation ID.

### M2 decision D-011 — watch timestamps

Watched episode and movie rows retain both `first_watched_at` and `last_watched_at`. Rewatching increments the counter and updates only `last_watched_at`; the original first-watch time remains intact.

### M2 decision D-012 — single and bulk operations

M2 implements both single-item and approved bulk episode mutations. The server accepts an explicit mode after the UI confirmation: `this_episode`, `earlier_current_season`, or `earlier_all_seasons` for marking; `this_episode`, `later_current_season`, or `later_all_seasons` for unmarking. The server never guesses a scope. Bulk operations include released canonical episodes only, respect accepted mainline ordering, exclude extras unless directly targeted, run in one transaction, and share one `operationId`.

### M2 decision D-013 — bulk mark does not create rewatches

`Mark earlier episodes` fills only currently unwatched rows in the selected range. Earlier episodes that are already watched remain unchanged; their `rewatch_count` and timestamps are not incremented. A direct deliberate mark on an already watched target episode is the action that increments its rewatch counter.

### M2 decision D-014 — release prerequisite

Kureha rejects Mark Watched for an unreleased episode or movie. Release eligibility uses the canonical stored release evidence and current time; unknown or date-only evidence must be handled conservatively rather than treated as released early. Bulk operations likewise include only episodes confirmed released at execution time.

### M2 decision D-015 — strict media-kind validation

Movie actions accept only canonical media groups whose type is `movie`; episode actions accept only canonical episode IDs belonging to episodic anime/series groups. A kind mismatch is rejected as invalid input. The server never guesses, redirects, or fabricates a different tracking target.

### M2 decision D-016 — hidden state retention

Removing an untouched title still retains its `user_media_state` row with `in_library = false`, even when no watched or playback records exist. This preserves the previous intent for re-addition. Library queries must exclude hidden state rows; only explicit delete-tracking removes them.

### M2 decision D-017 — profile prerequisite

Google authentication alone is not sufficient to mutate tracking state. A first-time authenticated user must complete profile setup by choosing a valid username and display name before library or tracking mutations are allowed. Kureha does not generate a temporary username automatically.

### M2 decision D-018 — plain library addition

Plain Add to Library creates a normal in-library state with internal intent `active`; it does not imply Watch Later. With zero progress, the title is still computed and presented as Upcoming or Haven’t Started according to release state. Watch Later is selected only through the explicit Watch Later action.

### M2 decision D-019 — timestamp after rewatch decrement

When Unmark decrements a rewatch counter (for example `x2` to `x1`), `last_watched_at` remains unchanged. Kureha does not attempt to reconstruct an older latest-watch timestamp from the compact counter model. Deleting the final watched state removes the row and both timestamps.

### M2 architecture review checkpoint

Fresh-context review initially returned **NEEDS CHANGES** for missing unreleased progress derivation, undefined idempotency race handling, underspecified library/deletion transactions, and ambiguous date-only release timing. The contract was corrected and approved on 2026-09-01. OpenCode completed the implementation, and a comprehensive independent acceptance review returned **PASS** on 2026-09-01 across all 10 repair criteria.

## M2 acceptance record — 2026-09-01

### Delivered

- Canonical tracking schema (`user_media_state`, `canonical_watched_episodes`, `canonical_watched_movies`, `tracking_operations`).
- Clean destructive legacy migration (`drizzle/0002_M2_canonical_tracking.sql`) with synchronized snapshot and journal.
- Full bulk mark/unmark traversal with extras/track isolation and deterministic row locking.
- Canonical progress engine returning updated status and progress frontier in every mutation summary.
- Conservative UTC date-only and exact-time release gating for episodes and movies.
- Profile prerequisite gating (`PROFILE_SETUP_REQUIRED` vs `UNAUTHORIZED`).
- Eight authenticated TanStack `createServerFn` actions in `src/server/actions/tracking.functions.ts`.
- 40 automated PGlite tests covering all 33+ contract scenarios.

### Acceptance evidence

- `npm test`: **40/40 passed** in PGlite.
- `npm run typecheck`: clean (0 errors).
- `npm run build`: clean (client + SSR built).
- `git diff --check`: clean.
- Independent final review: **PASS**.

M2 must not start implementation until its short architecture contract, migration sequence, rollback rule, and acceptance tests are written and reviewed.
