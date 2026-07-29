# Phase 2 — Wiring the Tracker (Real Database, Real Auth, No New Tracking Logic)

**Status:** Not started
**Depends on:** Phase 1 (tracking core) — complete, verified, 22/22 tests passing, plus the `metadata_source` addendum.
**Produces:** A real, running web application — sign in with Google, mark something watched, see it persist in an actual Postgres database. First time any of this touches a network.
**Explicitly excludes:** Any new tracking logic or rules beyond what Phase 1 already defined. No streaming. No social features. No notification delivery. No TMDB/TVDB switching UI. No Electron.

---

## 0. Why This Phase Is Scoped This Way

Phase 1 proved the tracking logic is correct in isolation — pure functions, fixture-tested, no I/O. Phase 2's entire job is to **wire that already-correct logic into a real, running system** without changing what it does. If this phase finds itself redesigning `deriveProgress` or adding a new status value, that's scope creep — the bug, if there is one, is in how Phase 2 is calling Phase 1's code, not in Phase 1 itself.

This is also the first phase with real infrastructure decisions at stake — an actual Supabase project gets created, actual API keys get generated, actual user data starts existing. Get the shape right here, because Tier 1 in the decisions log exists specifically to name what becomes expensive to change once real data is flowing.

**Definition of done for this phase:** you can open a browser, sign in with your real Google account, search isn't built yet so use a hardcoded/seeded title, mark an episode watched, refresh the page, and see it still marked watched — end to end, through a real database, with your real login.

---

## 1. Infrastructure Setup (Do This First, Before Any Code)

### 1.1 New Supabase Project

- Create a fresh Supabase project (the old one was deleted — this is a clean start, not a restore).
- Enable **Google OAuth** as the sign-in provider in Supabase Auth settings. This requires a Google Cloud OAuth Client ID/Secret — if you don't already have one from before, this needs to be created in Google Cloud Console first (Supabase's docs walk through the redirect URI setup).
- Note the project's connection string, anon key, and service role key — these go into `.env`, never committed to git.

### 1.2 Environment Variables

Add to `.env` (alongside the existing TMDB/TVDB/Fanart keys, which stay untouched):

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=          # Postgres connection string, for Drizzle
```

**Self-check:** confirm `.env` is in `.gitignore` before committing anything in this phase. If it isn't already, add it now — this is the first phase with real secrets in this file.

---

## 2. Project Scaffold — TanStack Start

### 2.1 What Gets Created

Initialize TanStack Start in the existing `Kureha` project root (where `src/`, `tests/`, `package.json` from Phase 1 already live — don't create a new separate project, extend this one).

Expected new structure, layered on top of what exists:

```
Kureha/
├── src/
│   ├── core/              ← Phase 1, untouched — deriveProgress, markWatched, etc.
│   ├── db/                ← NEW — Drizzle schema + client setup
│   │   ├── schema.ts
│   │   └── client.ts
│   ├── routes/             ← NEW — TanStack Start file-based routes
│   │   ├── index.tsx        (home — shows tracked media list)
│   │   ├── login.tsx
│   │   └── api/
│   │       ├── mark-watched.ts
│   │       ├── unmark-watched.ts
│   │       └── library.ts
│   └── auth/               ← NEW — Supabase Auth helpers (server-side session check)
├── tests/                  ← Phase 1 tests, untouched
├── drizzle/                ← NEW — Drizzle migration output
```

### 2.2 What NOT to Restructure

Do not move, rename, or modify anything inside `src/core/` or `tests/` in this phase. If Phase 2 code needs something from Phase 1 that doesn't exist (e.g., a function that takes raw DB rows instead of already-typed objects), write an **adapter** in `src/db/` that converts between them — don't reach into `src/core/` and change its signatures to be more convenient for the database layer. Phase 1's functions are the contract; Phase 2 conforms to them, not the other way around.

---

## 3. Drizzle Schema — Must Match Phase 1 Exactly

This is the highest-risk part of this phase for silent drift. Phase 1's `schema.sql` and `types.ts` were hand-written and matched to each other manually — now they get re-expressed as a Drizzle schema, which becomes the new single source of truth going forward.

### 3.1 Required Fields (Cross-Check List)

Before writing `src/db/schema.ts`, open Phase 1's `schema.sql` and `types.ts` side by side and confirm every field is represented, including the ones added by the metadata_source addendum:

**`tracked_media`:**
- `user_id`, `media_id` (composite PK)
- `media_type`
- `metadata_source` (default `'tmdb'`)
- `intent` (default `'active'`)
- `added_at`
- `intent_changed_at` (nullable)
- `total_episodes` (nullable)
- `release_state`

**`watched_episodes`:**
- `user_id`, `media_id`, `season_number`, `episode_number` (composite PK)
- `watched_at`
- `rewatch_count` (default `1`)
- Foreign key to `tracked_media(user_id, media_id)`

### 3.2 Drizzle-Specific Notes

- Use Drizzle's `pgTable` with explicit column types matching Postgres equivalents of the SQLite types Phase 1 used (`TEXT` → `text()`, `INTEGER` timestamps → `integer()` or `timestamp()` — pick one and be consistent, don't mix).
- Set up the Postgres client with `prepare: false` when connecting through Supabase's connection pooler (a known requirement — Supabase's pooler doesn't support prepared statements by default, and Drizzle needs to be told not to use them).
- Generate the actual migration (`drizzle-kit generate` + `drizzle-kit migrate`, or equivalent) and run it against the real Supabase Postgres instance. Confirm the tables exist in the Supabase dashboard's table editor before writing any application code against them.

### 3.3 Verification Step (Do Not Skip)

Write a standalone script (or one-off test) that:
1. Inserts a `tracked_media` row via Drizzle
2. Inserts a `watched_episodes` row referencing it
3. Attempts to insert a `watched_episodes` row with a `media_id` that has no matching `tracked_media` row, and confirms it's rejected by the foreign key constraint

This directly re-proves, against the real Postgres database, the same guarantee Phase 1's `schema.test.ts` proved against in-memory SQLite. Don't assume the constraint carried over correctly just because the SQL looks similar — Postgres and SQLite have real differences in constraint syntax, and this phase is exactly where that gap could hide a bug.

---

## 4. Auth Wiring

### 4.1 Sign-In Flow

- A `/login` route with a single "Sign in with Google" button, using Supabase Auth's OAuth flow (standard browser redirect — no device pairing in this phase, that's Electron-only and doesn't exist yet).
- On successful callback, Supabase issues a session; TanStack Start's server-side code reads that session to get the authenticated `user_id` (Supabase's UUID) for subsequent requests.

### 4.2 What This Phase Does NOT Build

- No email/password fallback (per Decisions Log Tier 2 — Google-only for now).
- No user profile page, avatar, settings — just "am I signed in, and what's my `user_id`."
- No Row Level Security (RLS) policies yet. **Flagging this explicitly rather than silently skipping it**: for this phase, since there's no social/sharing feature yet and only one real user (you) testing this, it's acceptable for the API routes themselves to check `user_id` matches the session before querying — but RLS as a database-level enforcement layer is a real gap worth naming, not forgetting. See Open Questions §7.

---

## 5. API Routes (Thin Wrappers Around Phase 1 Logic)

Every route in this section should be a **thin wrapper**: read the request, fetch whatever existing rows are needed from the database via Drizzle, pass them into the appropriate Phase 1 pure function, write the result back via Drizzle, return the response. The route itself should contain no tracking logic — if you find yourself writing an `if` statement about progress or intent inside a route handler, that logic belongs in `src/core/`, not here.

### 5.1 `POST /api/mark-watched`

```typescript
// Input: { mediaId, mediaInfo (for auto-create), seasonNumber, episodeNumber }
// 1. Get user_id from session
// 2. Fetch existing TrackedMedia row (or null) via Drizzle
// 3. Fetch existing WatchedEpisode row (or null) via Drizzle
// 4. Call core.markWatched({ mediaInfo, media, existing, target })
// 5. Upsert the returned media + episode rows via Drizzle
// 6. Return the updated effective state (core.getEffectiveState + core.deriveProgress)
```

### 5.2 `POST /api/unmark-watched`

Same shape, wrapping `core.unmarkWatched()`. Handle the `null` return (row deletion) as an actual `DELETE` via Drizzle, not a soft-delete.

### 5.3 `GET /api/library`

Returns all `tracked_media` rows for the current user, each with its `deriveProgress()` output computed at request time — not cached, not stored. This is the first place Phase 1's "progress is always computed, never stored" principle gets proven against real request/response cycles.

### 5.4 What's Deliberately Not Built Yet

- No `rewatchSeason` route — the backend function is ready, but there's no UI need for it yet in this minimal phase. Add the route only when the UI phase actually needs it.
- No `setIntent` route (pause/watch_later/dropped) — same reasoning. Phase 2's job is to prove the wiring pattern works end-to-end with the two most essential actions (mark/unmark watched); the remaining routes are mechanical repeats of the same pattern once this is proven.

---

## 6. Minimal UI (Just Enough to Verify End-to-End)

This is NOT a design phase — no real styling, no component library decisions, nothing from a future design-system phase. Just enough HTML/JSX to prove the wiring works:

- `/login` — a button
- `/` (home) — after login, shows a hardcoded/seeded list of 2-3 titles (don't build search yet), each with a "Mark Episode 1 Watched" button and a display of current `progress` state
- Clicking the button calls `/api/mark-watched`, then re-fetches `/api/library` and re-renders

**Explicitly out of scope for this phase's UI:** search, posters, any design system, any of the visual polish from old spec files. This is a wiring proof, not a product screen.

---

## 7. Open Questions

1. **RLS policies** — deferred in this phase (§4.2) with API-level `user_id` checks as the interim safeguard. Before any social/sharing feature is built, RLS needs to become real, not just assumed. Flagging now so it's not forgotten, not solving it here.
2. **Seed data for the minimal UI** (§6) — hardcode 2-3 real TMDB IDs directly in the route, or build a tiny seed script? Leaning toward hardcoding directly in the route for this phase — a seed script is infrastructure this phase doesn't need yet.
3. **Where does the actual TMDB fetch for `mediaInfo` happen** in this phase? Phase 1's `markWatched` needs `mediaInfo` (title, type, episode count, release state) for the auto-create path — but this phase hasn't built a TMDB integration yet. For this phase only, hardcode `mediaInfo` for the 2-3 seed titles rather than building a real TMDB API client — that's its own future phase.

---

## 8. Fixture / Verification Scenarios (Definition of Done)

Unlike Phase 1, these aren't pure-function unit tests — they're **end-to-end checks** against the real running system:

1. Visit `/login`, sign in with Google, land back on `/` authenticated.
2. `/api/library` returns an empty list for a brand-new user (no rows yet).
3. Click "mark watched" on a seeded title → `/api/mark-watched` succeeds → a real row appears in Supabase's table editor for `tracked_media` and `watched_episodes`.
4. Refresh the page → the watched state persists (proves it's reading from the database, not local component state).
5. Attempt the same action while signed out (session cleared) → API route rejects it, doesn't silently use a stale/cached user_id.
6. Foreign key check from §3.3 passes against real Postgres.
7. Mark the same episode watched twice → `rewatch_count` increments to 2, matching Phase 1's `markWatched` behavior — proving the real wiring didn't accidentally change Phase 1's semantics.
8. Manually set a seeded title's intent to `watch_later` directly in the database, then mark an episode watched via the UI → confirm the API response shows `intent: 'active'` (the auto-flip from Phase 1, now proven through the real stack).

---

## 9. Explicitly Out of Scope for Phase 2

- Search/discovery, posters, any visual design — this is wiring, not product UI.
- TMDB/TVDB API integration as a real, general-purpose client — seed data only this phase.
- RLS policies — flagged, deferred, not forgotten.
- `rewatchSeason` and `setIntent` API routes — mechanical additions once the pattern is proven; not needed to hit this phase's definition of done.
- Notifications, social, lists, comments — untouched, far future.
- Electron, device pairing — untouched, far future.
- Any change to `src/core/` logic itself — if this phase reveals a real bug in Phase 1's logic, stop and flag it explicitly rather than patching it inline here.

---

## 10. Handoff Notes for the Coding Agent

- If anything in this phase seems to require changing a function signature inside `src/core/`, stop and ask — that's a signal the wiring layer's assumptions don't match Phase 1's actual contract, not a reason to change Phase 1.
- Treat `src/db/schema.ts` (Drizzle) as the new source of truth for the database shape going forward — but it must be verified against Phase 1's `schema.sql`/`types.ts` field-by-field (§3.1) before being trusted, not assumed equivalent.
- Report back with the actual Drizzle schema file and the foreign-key verification script's output before proceeding to the API routes — this phase has a natural checkpoint at "database is real and correct" before "application code talks to it."
