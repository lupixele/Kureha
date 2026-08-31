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
| M1 | Canonical media identity and mapping-history schema | Verification | Pending commit on `feat/m1-canonical-media-identity` | 29 tests including PGlite `0000 → 0001`, typecheck, build, diff check, Graphify update, independent review PASS |
| M2 | Tracking migration to canonical group/episode IDs | Planned | — | Must trace to `FR-022`, `FR-023`, `FR-025` |

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

### Closure condition

M1 is functionally accepted but remains in **Verification** until its staged changes are committed as a durable Git checkpoint. Do not call it **Closed** before that commit exists.

## Next milestone proposal: M2 — Canonical tracking references

Goal: migrate user tracking from provider-shaped `media_id + season/episode numbers` to stable Kureha IDs without losing existing history or breaking current server functions.

Minimum scope:

1. Define migration/backfill contracts for legacy `tracked_media` and `watched_episodes`.
2. Reference `media_groups.id` from library/tracking rows and `episodes.id` from watched rows.
3. Preserve current data while flagging unmatched legacy records for mapping review.
4. Update adapters/repositories transactionally behind current server-function behavior.
5. Prove the migration and compatibility in PGlite before any Supabase migration.
6. Keep provider clients, search UI, social/RLS, and community watch orders out of M2.

M2 must not start implementation until its short architecture contract, migration sequence, rollback rule, and acceptance tests are written and reviewed.
