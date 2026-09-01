# Kureha Progress

**Last updated:** 2026-09-01 08:47 IST

**Canonical product contract:** [`docs/prd/PRD-001-kureha-core.md`](docs/prd/PRD-001-kureha-core.md)

**Execution ledger:** [`docs/implementation/MILESTONES.md`](docs/implementation/MILESTONES.md)

**Approved M2 architecture:** [`docs/architecture/M2-canonical-tracking-contract.md`](docs/architecture/M2-canonical-tracking-contract.md)

## Current phase

Approved PRD and architecture implementation. Milestone 1 and Milestone 2 are complete and verified. Milestone 2 (canonical tracking references and server actions) has passed implementation, 40 PGlite acceptance tests, typecheck, build, and independent adversarial review.

The first independent M2 review requested contract corrections. Those corrections were applied for unreleased progress, concurrent idempotency/rewatches, library/delete transactions, and date-only release evidence. A focused independent confirmation review returned **PASS**, and the owner approved the corrected contract on 2026-09-01.

## Current Git state

- Active branch: `feat/m2-canonical-tracking-references`
- M1 checkpoint: `e979965` (closed)
- M1/M2 contract checkpoint: `2d027c4` (pushed to `origin/feat/m1-canonical-media-identity`)
- M2 checkpoint commit: `5fc22a2` (pushed to `origin/feat/m2-canonical-tracking-references`)
- M2 status: **Closed**

## Completed checkpoints

### Product and provider decisions

- PRD-001 approved and canonical.
- Tracker-only scope: no streaming, torrents, or built-in playback.
- Kureha owns stable group, track, installment, and episode IDs.
- AniList is canonical for anime identity, typed relations, and airing schedules.
- Ani.zip is optional, non-blocking enrichment.
- TMDB is canonical for movies and non-anime TV, with mapped anime artwork only.
- Community-created watch-order schemes are post-v1, not v1.

### Baseline — closed

- Commit `58d66be` established the stable Phase 2 baseline.
- Default tests are deterministic and network-free.
- Real Postgres tests are opt-in.
- PRD and project rules are anchored in the repository.

### M1 — closed

Delivered canonical identity, mapping history, release evidence, profile constraints, clean migration, and PGlite migration tests.

Acceptance evidence:

- `npm test`: 29/29 passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `git diff --check`: passed
- `graphify update .`: completed
- independent final review: PASS

See [`docs/implementation/MILESTONES.md`](docs/implementation/MILESTONES.md) for exact artifacts and follow-ups.

## Next checkpoint

1. Commit and push the verified M2 checkpoint on `feat/m2-canonical-tracking-references`.
2. Do not merge into `main` without explicit user direction.
3. Next milestone: Milestone 3 (Metadata provider integration — AniList anime client + TMDB movies/TV client + Ani.zip enrichment).

## M2 boundary

M2 covers canonical tracking references and safe legacy backfill only. Provider network clients, search/UI, social/RLS implementation, and future community watch-order schemes remain outside M2.

### M2 decision confirmed

- Existing legacy tracking rows are disposable development data and may be deleted during migration.
- M2 does not need a temporary provider-ID history bridge or unmatched-row preservation for this pre-production data.
- M2 will cut over server mutations directly to canonical Kureha IDs; no old text-ID compatibility API remains.
- Episodic marks use canonical `episode_id`; library and intent actions use canonical `media_group_id`.
- Watched movies use a dedicated `watched_movies` table, never a fake Episode 1.
- Library membership and intent use one `user_media_state` record per user/group, with membership and intent stored as separate fields.
- Removing a title preserves both history and its prior intent; re-adding restores that intent. Explicit delete-tracking removes both.
- Rewatches keep one watched row with an atomic `rewatch_count`; v1 does not store every watch as a separate timestamped event.
- Tracking rejects unknown canonical IDs; the catalogue identity must exist first, while valid marks may auto-create only the user’s media-state row.
- Movie and episode mark/unmark operations use separate explicit server actions, even when the UI button label is the same.
- Unmark confirmation offers `Unmark once` (default) or `Unmark completely` whenever affected watched state has rewatches.
- Tracking mutations use a per-user `operation_id` so network retries cannot accidentally increment rewatches twice.
- Watched rows preserve both first-watched and latest-watched timestamps.
- M2 includes both single and approved bulk mark/unmark scopes; the server receives an explicit confirmed scope and never chooses one implicitly.
- Bulk mark fills only unwatched gaps and never increments already-watched earlier episodes as rewatches.
- Unreleased episodes and movies cannot be marked watched; bulk operations include only confirmed released episodes.
- Unreleased titles may still be added to the library and appear in Upcoming.
- Server actions strictly validate movie versus episodic identity and reject mismatches instead of guessing.
- Removing even an untouched title keeps a hidden state row to remember intent; library reads exclude it until re-added.
- First-time Google users must choose a valid username/display name before any library or tracking mutation; no temporary username is generated.
- Plain Add to Library starts as a normal internal-active item, not Watch Later; zero progress still computes as Upcoming/Haven’t Started.
- Decrementing a rewatch counter keeps `last_watched_at`; deleting the final watched state removes the row and timestamps.
- Production-grade canonical history preservation remains required after M2 establishes the new schema.

## Known non-blocking follow-ups

- Unique mapping-version number per group.
- Cross-group consistency for mapping-version entries.
- Supabase `auth.users` linkage and RLS in the real-Postgres authorization milestone.
