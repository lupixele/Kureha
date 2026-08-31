# Phase 1 — Tracking Core (Backend Logic + Schema, No UI, No Player, No Streaming)

**Status:** Not started
**Depends on:** Nothing. This is the foundation.
**Produces:** User-scoped tracking logic + schema, designed to live in a real backend service — testable in isolation, ready to sit behind an API in a later phase.
**Explicitly excludes:** UI, HTTP layer, auth implementation (schema assumes a `user_id` exists — issuing/verifying it is a separate phase), streaming, playback, extensions, notifications delivery.

**Product reality this phase is built for:** This is a tracking service ONLY — the same category of product as Trakt or the old TV Time. A user manually marks things as watched. There is no player, no video element, no playback position. Any logic that assumes the app knows *how far into* an episode someone got does not belong here, because nothing in this product ever observes that.

---

## 0. Why This Phase Is Scoped This Way — and a Correction From the Previous Draft

The first draft of this phase carried over a "85% completion threshold" and `resume_point_seconds` field from the old Kureha spec, which was a media *player* with a real video element reporting live position. This app has no player. There is no signal to threshold against. That entire mechanism has been removed, not renamed — it was solving a problem that doesn't exist in a pure tracker.

The remaining real problem from before still stands and is still the core of this phase: the old status model mixed **computed truth** (what the user has actually watched) with **manual override** (pause, later, drop) in a single field, which made every edge case a special case. That's still fixed the same way — two independent axes, not one enum.

**Definition of done for this phase:** a coding agent can run a test suite against the fixture scenarios in §7 and every assertion passes, using only the schema and pure functions defined here. No UI, no HTTP server, no player.

---

## 1. Core Data Model

### 1.1 The Two-Axis Principle (unchanged from before, still correct)

| Axis | Nature | Values | Who sets it |
|---|---|---|---|
| **Progress** | Computed, never stored as a decision | `unreleased`, `not_started`, `in_progress`, `caught_up`, `finished` | System, derived every read |
| **Intent** | Explicit, stored, user-controlled | `active`, `paused`, `watch_later`, `dropped` | User, direct action |

Progress is always computed from watch data. Intent is always an explicit user decision. Nothing is ever "derived, except when overridden." A show's effective state for display is the combination of both, computed at read time — never stored as a merged value.

### 1.2 User-Scoped Schema

Every tracking row belongs to a user. This was missing from the first draft — it assumed single-device local storage, which doesn't hold up the moment this is a real backend serving a website with accounts.

```sql
-- One row per (user, title) the user is tracking
CREATE TABLE tracked_media (
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,             -- canonical id from the metadata provider
  media_type TEXT NOT NULL,           -- 'movie' | 'series' | 'anime'
  intent TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'paused' | 'watch_later' | 'dropped'
  added_at INTEGER NOT NULL,
  intent_changed_at INTEGER,          -- null if never changed from default
  total_episodes INTEGER,             -- null for movies; cached provider data
  release_state TEXT NOT NULL,        -- 'unreleased' | 'released' | 'ongoing' | 'ended'
  PRIMARY KEY (user_id, media_id)
);

-- One row per (user, title, episode) that's been marked watched
-- Movies use season_number = 0, episode_number = 0
CREATE TABLE watched_episodes (
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  season_number INTEGER NOT NULL DEFAULT 0,
  episode_number INTEGER NOT NULL,
  watched_at INTEGER NOT NULL,        -- timestamp of most recent watch
  rewatch_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, media_id, season_number, episode_number),
  FOREIGN KEY (user_id, media_id) REFERENCES tracked_media(user_id, media_id)
);
```

**What's gone from the first draft, and why:**
- `progress_percentage`, `resume_point_seconds` — deleted. No player exists to produce this data. A `watched_episodes` row now means exactly one thing: **marked watched.** There is no partial-watch state, because a tracker has no way to observe "partial."
- No threshold logic anywhere. Marking watched is a direct, binary user action — they click "watched," or they don't.

### 1.3 Movies

A movie is `media_type = 'movie'`, `total_episodes = NULL`, tracked via a single synthetic `(0, 0)` row in `watched_episodes`. Binary: watched or not. No partial-watch concept applies here either — same as episodes.

---

## 2. Progress Computation (Pure Functions)

All functions are pure: same input, same output, no I/O, no hidden state.

```typescript
type ReleaseState = 'unreleased' | 'released' | 'ongoing' | 'ended'
type Progress = 'unreleased' | 'not_started' | 'in_progress' | 'caught_up' | 'finished'
type Intent = 'active' | 'paused' | 'watch_later' | 'dropped'

interface TrackedMedia {
  userId: string
  mediaId: string
  mediaType: 'movie' | 'series' | 'anime'
  intent: Intent
  totalEpisodes: number | null
  releaseState: ReleaseState
}

interface WatchedEpisode {
  seasonNumber: number
  episodeNumber: number
  watchedAt: number
  rewatchCount: number
}

function deriveProgress(
  media: TrackedMedia,
  watchedEpisodes: WatchedEpisode[]
): Progress
```

### 2.1 Decision Table

| media_type | release_state | watched count | Result |
|---|---|---|---|
| any | `unreleased` | — | `unreleased` (watch data, if any exists, is ignored while unreleased) |
| movie | `released` / `ended` | 0 | `not_started` |
| movie | `released` / `ended` | 1 | `finished` |
| series/anime | any released state | 0 | `not_started` |
| series/anime | `ongoing` | > 0, < available episodes | `in_progress` |
| series/anime | `ongoing` | = available episodes | `caught_up` |
| series/anime | `ended` | > 0, < total episodes | `in_progress` |
| series/anime | `ended` | = total episodes | `finished` |

No partial-episode math anywhere — "watched count" is a simple integer count of fully-marked episodes, nothing fractional.

### 2.2 Mid-Season Episode Count Change

Same principle as before, simplified: `deriveProgress` recomputes from current inputs every call. There is no stored progress value to go stale, so a provider updating `total_episodes` (a new episode airs, a correction) is reflected correctly on the very next computation, with zero migration needed. (Episode *renumbering*, as opposed to count changes, is still a data-sources/provider-ID concern deferred out of this phase — same as before.)

---

## 3. Effective State

```typescript
interface EffectiveState {
  progress: Progress
  intent: Intent
  isNotifiable: boolean
}

function getEffectiveState(media: TrackedMedia, progress: Progress): EffectiveState {
  return {
    progress,
    intent: media.intent,
    isNotifiable: media.intent === 'active' && progress === 'caught_up'
  }
}
```

Thin combination only. Display decisions belong to a later UI phase, not here.

---

## 4. Write Operations

### 4.1 Marking an Episode Watched — Binary, No Threshold

```typescript
function markWatched(
  media: TrackedMedia,
  existing: WatchedEpisode | null,
  target: { seasonNumber: number; episodeNumber: number }
): WatchedEpisode
```

```
if existing row does not exist:
    create it: watched_at = now, rewatch_count = 1
if existing row exists and is already watched:
    this is a rewatch — increment rewatch_count, do NOT change watched_at
    (watched_at always reflects the FIRST watch, per your rewatch design)
```

That's the entire function. No percentage input, no threshold check — a caller either calls `markWatched` or doesn't. There's no intermediate state to represent.

### 4.2 Unmarking an Episode

```typescript
function unmarkWatched(existing: WatchedEpisode): WatchedEpisode | null
```

```
if rewatch_count > 1: decrement it, row survives
if rewatch_count === 1: delete the row entirely (back to fully unwatched)
```

### 4.3 Auto-Add to Library + Intent Auto-Activation

Two related rules, both confirmed by you:

1. **Marking any episode watched for a title not yet in `tracked_media`** auto-creates the row with `intent = 'active'`.
2. **Marking an episode watched on a title whose current intent is `paused` or `watch_later`** auto-resets intent to `active`. Directly watching something is definitionally incompatible with "later" or "paused" — the action itself overrides the flag. This is NOT the same mechanism as the `dropped → active` toggle (§4.4) — this is implicit, driven by the watch action itself, not a manual switch.

```typescript
function markWatched(
  media: TrackedMedia | null,   // null if title isn't tracked yet
  existing: WatchedEpisode | null,
  target: { seasonNumber: number; episodeNumber: number }
): { media: TrackedMedia; episode: WatchedEpisode } {
  const resolvedMedia = media ?? createTrackedMedia({ intent: 'active', ... })
  if (resolvedMedia.intent === 'paused' || resolvedMedia.intent === 'watch_later') {
    resolvedMedia.intent = 'active'
    resolvedMedia.intentChangedAt = now()
  }
  // ...proceed with watched_episodes upsert from §4.1
}
```

### 4.4 Manual Intent Changes

```typescript
function setIntent(media: TrackedMedia, newIntent: Intent): TrackedMedia
```

Confirmed behavior:
- **`dropped → active`**: silent, single-action toggle. No confirmation step.
- **Any other intent change** (`active → paused`, `active → watch_later`, `active → dropped`, etc.): also a direct, single-action write — no confirmation logic lives in this phase; if a later UI phase wants a confirmation dialog for `dropped`, that's presentation, not core logic.

Purely a field update + timestamp. Never touches `watched_episodes`, never recomputes progress — progress doesn't depend on intent, by design.

### 4.5 Skipped Episode Detection (Catch-Up Prompt Support)

```typescript
function getSkippedEpisodes(
  allKnownEpisodes: EpisodeRef[],
  watchedEpisodes: WatchedEpisode[],
  target: EpisodeRef
): EpisodeRef[]
```

Returns episodes between the last-watched point and `target` with no watched row. A later UI phase decides whether/how to prompt "mark these as watched too" — this phase only exposes the pure computation.

---

## 5. Season-Level Rewatch — Dedicated Batch Primitive

You confirmed this needs real UX, not just sugar over per-episode calls — so it gets its own primitive with defined semantics, decided here rather than left ambiguous:

```typescript
function rewatchSeason(
  media: TrackedMedia,
  seasonEpisodes: EpisodeRef[],           // every episode in the season, per provider data
  existingWatched: WatchedEpisode[]       // this user's current watched rows for the season
): WatchedEpisode[]
```

**Defined behavior:**
```
for each episode in seasonEpisodes:
    if a watched row already exists for it:
        increment rewatch_count (this episode gets counted as rewatched)
        watched_at unchanged (still reflects first watch)
    if no watched row exists (they never actually watched this episode):
        create it fresh: watched_at = now, rewatch_count = 1
        (this is a "watched for the first time," not a rewatch, even though
         it's happening via the season-rewatch action — see rationale below)
```

**Rationale for this specific rule:** if someone hits "rewatch season 1" on a season where they'd actually skipped episode 4 the first time through, episode 4 shouldn't get `rewatch_count = 2` — it's genuinely their first watch of that specific episode, even if it's their second pass at the season as a whole. This keeps `rewatch_count` per-episode accurate rather than inflated by a batch action. Flagging this as a real design decision rather than an obvious default, in case you'd rather the batch action force everything to `+1` uniformly regardless of individual history — but per-episode accuracy seems like the more honest choice and matches how the per-episode `markWatched` already behaves.

This function is the backend primitive; the UI phase later decides the actual button/confirmation flow ("Rewatch Season 1" trigger), but the semantics are settled now so nobody has to guess when building it.

---

## 6. Notification Eligibility (Logic Only, No Delivery)

Unchanged in principle: one predicate, already shown in §3 (`isNotifiable`). No scheduling, no push, no delivery mechanism — this phase only produces the yes/no answer for "should this title's owner be told about updates," to be consumed by a later phase.

---

## 7. Fixture Test Scenarios (Definition of Done)

1. **New movie added, not watched** → `deriveProgress` = `not_started`
2. **Movie marked watched** → `deriveProgress` = `finished`. (No partial-movie state exists anymore — confirming this replaces the old open question from draft 1, which no longer applies since there's no percentage input at all.)
3. **Ongoing series, all currently-available episodes watched** → `caught_up`
4. **Same series, provider adds a new episode** (simulated via changed input, no stored state) → next `deriveProgress` call → `in_progress`
5. **Ended series, all episodes watched** → `finished`
6. **Paused show with existing watched episodes** → `deriveProgress` unaffected by intent; `isNotifiable` = `false`
7. **Watch Later, nothing watched yet** → `deriveProgress` = `not_started`, `isNotifiable` = `false`
8. **Rewatch flow (single episode)**: mark watched (count=1) → mark again (count=2, `watched_at` unchanged) → unmark once (count=1) → unmark again (row deleted)
9. **Watching directly overrides paused/watch_later intent**: title has `intent = 'watch_later'` → user marks an episode watched → `intent` auto-flips to `active`
10. **Skipped episode detection**: watched S01E01–03, mark S01E05 watched → `getSkippedEpisodes` returns S01E04 only
11. **Season rewatch, partial prior coverage**: user previously watched S01E01–03 only (never saw E04), season has 4 episodes → `rewatchSeason` called → E01–03 get `rewatch_count` incremented to 2, E04 gets created fresh with `rewatch_count = 1`
12. **Unreleased title** → `deriveProgress` = `unreleased` regardless of any watch data present
13. **`dropped → active`** → silent field update, no side effects on watch data, no confirmation logic invoked

---

## 8. Explicitly Out of Scope for Phase 1

- Any HTTP/API layer — this phase produces functions and schema a future API phase will wrap, not the API itself.
- Auth implementation — schema assumes `user_id` exists as a string; issuing/verifying real user identity is a separate phase.
- Notification delivery — only the `isNotifiable` predicate is in scope.
- Metadata refresh/staleness/caching — this phase assumes `tracked_media` fields (like `total_episodes`, `release_state`) are correct as given. How they get refreshed from a provider is a data-sources phase concern.
- Anything related to streaming, playback, torrents, or extensions — this codebase never touches that, by design (see product reality note at the top).
- Episode-renumbering data integrity (provider changes episode numbering, not just count) — flagged, deferred, needs provider episode IDs to solve properly.

---

## 9. Remaining Open Questions

1. **Auth strategy** — not decided yet, and it determines the real shape of `user_id` (opaque UUID from a sessions table? OAuth subject ID? something else?). Needed before a Phase 0/backend-setup spec can be written concretely. What are you thinking — email+password, OAuth-only, magic link?
2. **Backend framework/runtime** — TypeScript is assumed throughout this doc for the function signatures, but no decision has been made on the actual server framework (Node/Express, Fastify, something else) or database (this doc assumes SQL but hasn't picked Postgres vs. SQLite vs. something else for the *real* backend, as opposed to what was previously assumed to be local-only storage).
3. **Season-rewatch semantics** (§5) — confirm the per-episode-accuracy rule is what you want, versus a simpler "force everything to `rewatch_count + 1` uniformly" rule.

---

## 10. Handoff Notes for the Coding Agent

- No player, no video element, no playback-position concept should appear anywhere in this codebase — if a future request implies one, stop and flag it, don't build it.
- Every function in §2, §4, §5 should be unit-testable with in-memory fixtures — no live database required to validate logic, though schema constraints (§1.2) should also be tested separately.
- This code should be written as it will eventually live in a backend service — no assumptions about running inside Electron, a browser, or any specific client.
