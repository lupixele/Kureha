# M2 Acceptance Repair Brief

The prior implementation fails acceptance despite green basic gates.

## Required blockers

1. `markEpisodeWatched` must implement `earlier_current_season` and `earlier_all_seasons`; bulk gap-fill inserts only missing released canonical rows and excludes extras/other tracks.
2. `unmarkEpisodeWatched` must implement `later_current_season` and `later_all_seasons`; apply explicit `once` or `completely` to every selected row with deterministic locking/order.
3. Restore/replace a canonical pure progress engine. Every mutation summary must include recomputed `unreleased | not_started | in_progress | caught_up | finished` plus watched count/frontier. Preserve sparse-gap semantics.
4. Release eligibility must use exact-time, explicit positive evidence, finished installment, and conservative UTC date-only rules. Movies need the same gating. Unknown/conflicting evidence returns `RELEASE_UNCONFIRMED`.
5. Require an existing complete profile; unauthenticated is `UNAUTHORIZED`, missing/incomplete profile is `PROFILE_SETUP_REQUIRED`.
6. Expose all eight authenticated, validated TanStack `createServerFn` actions while keeping database/crypto/server-only dependencies out of client bundles.
7. Regenerate migration `0002` with Drizzle; synchronize `drizzle/meta/_journal.json` and `0002_snapshot.json`. Keep the approved explicit destructive development-data reset.
8. Add `(media_group_id, version_number)` uniqueness and repository validation that every mapping-version entry target belongs to that mapping version's media group.
9. Replace the inadequate 2 ad-hoc tests with all 33+ approved contract acceptance tests against the real repository/server implementation and PGlite migrations. Cover concurrency/idempotency, bulk scopes, extras/track isolation, once/completely, release gating, remove/re-add, delete isolation, progress, profile setup, kind mismatch, constraints, and migration reset.
10. Inspect every deleted legacy core/test file. Restore or canonically replace every still-required pure behavior and test; deleting provider-shaped data is allowed, deleting required domain behavior is not.

## Independent review references

- `docs/architecture/M2-canonical-tracking-contract.md`
- `docs/prd/PRD-001-kureha-core.md`
- This brief is a copy of the findings because OpenCode cannot access Hermes cache paths.

## Required process

- Write tests first and show RED before production fixes.
- No commit or push.
- Remove scratch files.
- Run `npm test`, `npm run typecheck`, `npm run build`, `git diff --check`, and `graphify update .`.
- Final report must include RED evidence, exact outputs, requirement/test trace, changed files, and honest residual risks.
