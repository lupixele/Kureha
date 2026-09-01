# M2 Architecture Contract — Canonical Tracking References

**Status:** Approved by owner — 2026-09-01

**Date:** 2026-08-31

**Approval date:** 2026-09-01

**Depends on:** PRD-001 and closed M1 checkpoint `e979965`

**Requirements:** `FR-022`, `FR-023`, `FR-025`, `FR-058`–`FR-078I`, `NFR-007`, `NFR-018`, `NFR-019`, `NFR-025`

## 1. Simple explanation

M1 created Kureha’s permanent catalogue IDs. M2 makes personal tracking use those IDs.

Before M2, the database effectively says:

> “This user watched provider-shaped title text `tmdb-123`, season 1, episode 4.”

After M2, it says:

> “This user watched Kureha episode UUID `…`.”

That means provider renames and episode renumbering cannot silently move or destroy watch history.

M2 separates four concerns:

1. **Catalogue identity** — the existing Kureha group/episode records from M1.
2. **User media state** — whether the title is in the user’s library and their Pause/Watch Later/Drop intent.
3. **Watched state** — one row per watched episode or movie, with a compact rewatch counter.
4. **Mutation receipt** — an operation ID preventing a retried network request from counting twice.

## 2. Locked owner decisions

1. Existing `tracked_media` and `watched_episodes` rows are disposable development data and may be deleted.
2. M2 switches completely to canonical Kureha IDs; no old text-ID compatibility API remains.
3. Movies use a dedicated watched-movie record, never fake Episode 1.
4. Library membership and intent live in one user-media state record but remain separate fields.
5. Removing a title preserves its hidden state, intent, and watched history; re-adding restores them.
6. Rewatches use one row plus `rewatch_count`, not a timestamped row for every watch.
7. Unknown catalogue IDs are rejected; tracking never fabricates catalogue records.
8. Movie and episode actions are separate server contracts.
9. Unmark offers `once` versus `completely` when rewatches exist; once is the default.
10. Every mutation has a client-generated operation ID for idempotency.
11. Watched rows retain both first- and latest-watched timestamps.
12. Single and approved bulk mark/unmark operations ship together.
13. Bulk mark fills gaps without incrementing already-watched earlier episodes.
14. Unreleased titles may be added to the library/Upcoming, but unreleased or release-unconfirmed content cannot be marked watched.
15. Movie/episode kind mismatches are rejected rather than guessed.
16. Hidden state is retained even for an untouched removed title.
17. A first-time Google user must complete username/display-name setup before tracking.
18. Plain Add to Library creates a normal item, not an implicit Watch Later item.
19. Rewatch decrement keeps `last_watched_at`; final deletion removes the row.
20. Unmarking rewatched state offers `once` versus `completely`; once is the default.
21. Unreleased titles remain addable to the library and Upcoming even though watched mutations are blocked.

The durable decision ledger is [`../implementation/MILESTONES.md`](../implementation/MILESTONES.md).

## 3. Target database model

### 3.1 `user_media_state`

One row per user and canonical media group.

| Field | Meaning |
|---|---|
| `user_id` | Authenticated profile UUID |
| `media_group_id` | Stable Kureha group UUID |
| `in_library` | Membership only; hidden rows use `false` |
| `intent` | `active`, `paused`, `watch_later`, or `dropped` |
| `first_added_at` | First library addition |
| `last_added_at` | Most recent re-addition |
| `membership_changed_at` | Latest add/remove |
| `intent_changed_at` | Latest intent transition |
| `last_activity_at` | Recency input for Continue Watching |
| `created_at`, `updated_at` | Audit timestamps |

Primary key: `(user_id, media_group_id)`.

Rules:

- Foreign keys reference `profiles.id` and `media_groups.id`.
- A new plain library addition starts as `in_library = true`, `intent = active`.
- Marking a valid episode/movie creates a missing row transactionally and sets it in-library/active.
- Marking while paused, Watch Later, dropped, or hidden changes the row to in-library/active.
- Removing sets only `in_library = false` and preserves intent/history.
- Re-adding sets `in_library = true` and preserves the previous intent.
- Explicit delete-tracking deletes this row plus watched/playback rows for the group.

### 3.2 Canonical `watched_episodes`

One row per user and canonical Kureha episode.

| Field | Meaning |
|---|---|
| `user_id` | Profile UUID |
| `episode_id` | Stable `episodes.id` UUID |
| `first_watched_at` | First confirmed watch |
| `last_watched_at` | Latest deliberate rewatch |
| `rewatch_count` | Minimum 1 |
| `created_at`, `updated_at` | Audit timestamps |

Primary key: `(user_id, episode_id)`.

The media group is resolved through `episode → installment → continuity track → media group`; it is not duplicated in the watched row. If canonical mapping moves an episode, history follows the stable episode ID.

### 3.3 `watched_movies`

One row per user and canonical movie group.

| Field | Meaning |
|---|---|
| `user_id` | Profile UUID |
| `media_group_id` | Stable movie group UUID |
| `first_watched_at` | First watch |
| `last_watched_at` | Latest rewatch |
| `rewatch_count` | Minimum 1 |
| `created_at`, `updated_at` | Audit timestamps |

Primary key: `(user_id, media_group_id)`.

The service must verify `media_groups.type = movie`; a foreign key alone cannot enforce that conditional rule.

### 3.4 `tracking_operations`

Idempotency receipt for every mutation.

| Field | Meaning |
|---|---|
| `user_id` | Profile UUID |
| `operation_id` | Client-generated UUID |
| `action` | Constrained mutation kind |
| `request_hash` | Stable hash of validated canonical input |
| `result` | Nullable compact JSON result returned by the winning execution |
| `completed_at` | Nullable completion timestamp |

Primary key: `(user_id, operation_id)`.

Rules:

- First use executes the mutation and stores the result in the same transaction.
- Retry with the same user, operation ID, action, and request hash returns the stored result without another mutation.
- Reuse with different input returns `OPERATION_ID_CONFLICT`.
- A failed transaction stores no successful receipt.
- This is technical idempotency state, not the social activity feed.
- The transaction claims ownership with `INSERT ... ON CONFLICT DO NOTHING RETURNING` before mutating watched state. The inserted receipt remains uncommitted while the winner executes, then receives `result` and `completed_at` before the same transaction commits.
- A concurrent loser with the same key waits for the conflicting transaction to resolve. If the winner commits, the loser reads and validates the committed action/hash and returns its stored result with `replayed = true`; if the winner rolls back, the loser may acquire the claim and execute.
- Same-key conflict handling must not rely on catching a raw `23505` inside an already-aborted transaction.
- Direct watched marks use atomic `INSERT ... ON CONFLICT DO UPDATE` so concurrent distinct operations cannot lose a rewatch increment. Bulk gap-fill uses `ON CONFLICT DO NOTHING`, preserving already-watched rows.
- Unmark operations lock all selected watched rows in deterministic canonical order before decrement/delete so concurrent unmarks cannot lose updates or deadlock through inconsistent lock order.

### 3.5 M1 hardening included in M2

Before mapping-version write services are introduced:

- add uniqueness on `(mapping_versions.media_group_id, version_number)`;
- validate in the repository transaction that every mapping-version entry’s target belongs to the version’s media group;
- keep Supabase `auth.users` FK and RLS work for the dedicated real-Postgres authorization milestone.

## 4. Explicit server contracts

All actions require authentication, an existing `profiles` row, and a valid `operationId`.

All mutation functions return the same typed envelope:

```text
{ ok: true, data: MutationSummary, replayed: boolean }
{ ok: false, error: { code: TrackingErrorCode, message: string } }
```

`MutationSummary` includes `operationId`, `mediaGroupId`, the action/scope/removal choice, affected/decremented/deleted counts, and recomputed progress. Supported error codes are `UNAUTHORIZED`, `PROFILE_SETUP_REQUIRED`, `UNKNOWN_CATALOGUE_ID`, `MEDIA_KIND_MISMATCH`, `RELEASE_UNCONFIRMED`, `INVALID_SCOPE`, `INVALID_REMOVAL`, `NOT_WATCHED`, `OPERATION_ID_CONFLICT`, `CONFIRMATION_REQUIRED`, and `INTERNAL_ERROR`.

### Episodes

```text
markEpisodeWatched({ operationId, episodeId, mode })
unmarkEpisodeWatched({ operationId, episodeId, scope, removal })
```

Mark modes:

- `this_episode`
- `earlier_current_season`
- `earlier_all_seasons`

Unmark scopes:

- `this_episode`
- `later_current_season`
- `later_all_seasons`

Removal choices:

- `once` — default; decrement one watch from every selected row
- `completely` — delete every selected watched row regardless of rewatch count

“Current season” means the target installment. “All seasons” stays inside the target continuity track and never crosses into an alternate continuity. Extras permit only `this_episode`.

### Movies

```text
markMovieWatched({ operationId, mediaGroupId })
unmarkMovieWatched({ operationId, mediaGroupId, removal })
```

### Library and intent

```text
addToLibrary({ operationId, mediaGroupId })
removeFromLibrary({ operationId, mediaGroupId })
setMediaIntent({ operationId, mediaGroupId, action })
deleteTracking({ operationId, mediaGroupId, confirmation: 'DELETE_TRACKING' })
```

Intent actions are explicit product actions: `pause`, `watch_later`, `drop`, `start_watching`, and `resume_watching`. There is no generic user-facing “set active” action.

## 5. Transaction rules

### 5.1 Mark episode

In one transaction:

1. Claim/check the operation receipt.
2. Require an existing profile and canonical episode.
3. Resolve installment, continuity track, and media group.
4. Reject movie groups, unknown IDs, invalid bulk modes, and unreleased/unconfirmed episodes.
5. Upsert `user_media_state` to in-library/active.
6. Compute the explicit target set from the confirmed mode.
7. For the directly targeted episode:
   - insert count 1 when unwatched;
   - otherwise atomically increment count and update `last_watched_at`.
8. For earlier bulk episodes, insert only missing watched rows; leave existing rows unchanged.
9. Update user-media activity recency.
10. Store and return one operation result summarizing the affected count.

### 5.2 Unmark episode

In one transaction:

1. Claim/check the operation receipt.
2. Require canonical identity and validate the explicit scope.
3. Resolve the selected watched rows.
4. Apply the explicit removal choice to every selected row:
   - `once`: count greater than 1 → decrement; count equal to 1 → delete;
   - `completely`: delete regardless of count.
5. Do not alter library membership or intent.
6. Store one summarized operation result.

### 5.3 Mark/unmark movie

Use the same idempotency and explicit `once`/`completely` removal rules, but only against `watched_movies` and a group verified as `movie`.

### 5.4 Library, intent, and deletion

Every action claims and completes its operation receipt in the same transaction.

- `addToLibrary`: require the profile and canonical group; upsert `user_media_state` with `in_library = true`. A new row receives `intent = active`, `first_added_at`, and `last_added_at`. Re-addition updates `last_added_at`/membership timestamps while preserving prior intent.
- `removeFromLibrary`: set `in_library = false` and update the membership timestamp; preserve the state row, intent, watched rows, playback rows, and first-added time.
- `setMediaIntent`: validate the explicit product action, update intent and intent/activity timestamps, and never rewrite watched rows.
- `deleteTracking`: require the exact confirmation literal `DELETE_TRACKING`; delete the selected group’s `user_media_state`, `watched_movies`, playback positions, and all `watched_episodes` reached by the group hierarchy (`media_groups → continuity_tracks → installments → episodes`). It must not delete another group’s state/history or shared canonical catalogue records.

## 6. Release eligibility

Marking requires positive evidence that content has released.

- Exact timestamp: released when `exact_time <= now`.
- Explicit authoritative positive release/finished evidence may establish release immediately when it is current and non-conflicting.
- A finished parent installment establishes that its accepted canonical episodes have released.
- Date-only evidence without stronger positive evidence becomes eligible only when `exact_date < CURRENT_DATE` in UTC. A title dated today remains unconfirmed until an exact/explicit release signal arrives or the UTC date advances.
- Unknown/conflicting evidence: reject with `RELEASE_UNCONFIRMED`.
- Bulk operations include only confirmed released canonical episodes at execution time.

## 7. Progress derivation after M2

Progress is computed from canonical ordering, never a stored provider count.

- A group with no released canonical content and no watched state → `unreleased`; adding it to the library does not change that and allows it to appear in Upcoming.
- Movie: unwatched and unreleased → `unreleased`; unwatched and released → `not_started`; watched → `finished`.
- Episodic group with zero watched canonical episodes and at least one released canonical episode → `not_started`.
- Ongoing/non-ended group: latest released canonical episode watched → `caught_up`, even if intentional earlier gaps remain.
- Ended group: final canonical episode watched → `finished`, even if intentional earlier gaps remain.
- At least one canonical episode watched without satisfying caught-up/finished → `in_progress`.
- Extras remain independently trackable and do not affect canonical completion.

Responses should expose both the watched count and progress frontier so sparse history is not misrepresented.

## 8. Destructive migration sequence

No production/provider history is preserved because the existing rows are disposable development fixtures.

1. Apply and verify M1 migrations.
2. Create new enums/tables/constraints for M2.
3. Delete/drop the legacy `watched_episodes` table and recreate it with canonical `episode_id` identity.
4. Delete/drop legacy `tracked_media`; replace it with `user_media_state`.
5. Create `watched_movies` and `tracking_operations`.
6. Add M1 mapping-version uniqueness hardening.
7. Switch adapters, repositories, core types, and server actions to canonical contracts in the same code checkpoint.
8. Remove obsolete provider-shaped adapters and tests.

The generated migration must clearly identify the destructive development-data reset. It is tested in PGlite first and is not applied to Supabase without explicit owner approval and a database backup.

## 9. Rollback rule

- Before any shared-database migration, create a Supabase backup/snapshot.
- Before M2 contains real user data, rollback means reverting code and recreating the development database from M1 migrations.
- After real canonical tracking data exists, do not run a destructive down migration; use a forward repair migration or restore the backup.
- A failed M2 transaction must leave both watched state and its operation receipt unchanged.

## 10. Required acceptance tests

### PGlite migration and constraints

1. Apply `0000 → 0001 → M2` successfully.
2. Seed legacy development rows before M2; verify the migration explicitly removes them.
3. Reject user state without a profile or group.
4. Reject watched episode without an existing canonical episode.
5. Reject watched movie for a non-movie group at the service boundary.
6. Reject `rewatch_count < 1`.
7. Enforce one state/watched row per user-target.
8. Enforce unique mapping version number per group.

### Mutation behavior

9. A valid first episode mark atomically creates user state and watched state.
10. Duplicate retry with the same operation ID does not increment the counter.
11. Reusing an operation ID with different input is rejected.
12. Two concurrent requests with the same operation ID produce one mutation and the loser returns the winner’s stored result.
13. Concurrent deliberate marks with different operation IDs preserve every atomic rewatch increment.
14. A deliberate new operation on an already watched target increments exactly once and preserves `first_watched_at`.
15. Unmark on `x2` yields `x1`; another unmark deletes the row.
16. `Unmark completely` deletes an `x2+` watched row in one confirmed action.
17. Bulk mark fills gaps while leaving already-watched earlier episodes unchanged.
18. Bulk unmark applies the confirmed once/completely choice consistently to every selected row.
19. Concurrent unmarks serialize without lost updates or deadlocks.
20. Current-season bulk never crosses installments.
21. All-seasons bulk never crosses continuity tracks or includes extras.
22. Unreleased/unconfirmed targets are rejected, while unreleased titles remain addable to the library.
23. Date-only evidence dated today remains unconfirmed without a stronger release signal; a past UTC date is eligible.
24. Movie and episode kind mismatches are rejected.
25. Remove/re-add preserves intent and history, including an untouched hidden state.
26. Delete-tracking removes state plus episode/movie/playback history for only the selected group through the canonical hierarchy.
27. Profile-incomplete users receive `PROFILE_SETUP_REQUIRED`.

### Progress behavior

28. An in-library group with no released content derives `unreleased`, not `not_started`.
29. An unwatched released title derives `not_started`.
30. Watching the latest released episode derives `caught_up` despite earlier gaps.
31. Watching the final episode of a reliably ended group derives `finished` despite earlier gaps.
32. Extras do not change canonical completion.
33. Unknown totals do not falsely produce caught-up/finished; the canonical released/final frontier is used.

### Gates

- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`
- `graphify update .`
- fresh-context independent review before commit
- real Postgres integration remains opt-in via `TEST_DATABASE_URL`

## 11. Explicitly outside M2

- AniList/TMDB/Ani.zip network clients and ingestion jobs
- Search UI and media-detail UI
- Prompt/dialog visual design
- Home/New Releases/Upcoming UI
- Social/friendship/activity-feed implementation
- Supabase RLS rollout and production migration execution
- Playback-position ingestion
- Community watch-order schemes

M2 returns enough operation summary data for a later activity layer to create one bulk event instead of one event per affected episode.

## 12. Approval gate

Implementation must not begin until the owner approves this contract. Any behavioral change after approval updates this file and its durable decision ledger before code changes.
