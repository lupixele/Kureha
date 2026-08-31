# Kureha Progress

**Last updated:** 2026-08-31 20:00 IST

**Canonical product contract:** [`docs/prd/PRD-001-kureha-core.md`](docs/prd/PRD-001-kureha-core.md)

**Execution ledger:** [`docs/implementation/MILESTONES.md`](docs/implementation/MILESTONES.md)

## Current phase

Approved PRD and architecture implementation. The deterministic tracking core and server wiring baseline are stable. Milestone 1 (canonical media identity schema) has passed implementation, automated gates, migration execution in PGlite, and fresh-context adversarial review.

## Current Git state

- Branch: `feat/m1-canonical-media-identity`
- Baseline commit: `58d66be`
- M1 checkpoint commit: `e979965`
- M1 status: **Closed**
- Remote state: not pushed or merged

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

1. Do not push or merge `feat/m1-canonical-media-identity` without explicit user direction.
2. Draft the short M2 architecture contract for migrating tracking rows to canonical Kureha group/episode IDs.
3. Review that contract before launching OpenCode implementation.

## M2 boundary

M2 covers canonical tracking references and safe legacy backfill only. Provider network clients, search/UI, social/RLS implementation, and future community watch-order schemes remain outside M2.

## Known non-blocking follow-ups

- Unique mapping-version number per group.
- Cross-group consistency for mapping-version entries.
- Supabase `auth.users` linkage and RLS in the real-Postgres authorization milestone.
