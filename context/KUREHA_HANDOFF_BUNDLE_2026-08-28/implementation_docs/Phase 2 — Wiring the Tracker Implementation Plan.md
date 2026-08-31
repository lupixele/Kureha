# Phase 2 — Wiring the Tracker: Implementation Plan

Wire Phase 1's verified pure tracking logic into a real, running web application — Supabase Postgres, Google OAuth, Drizzle ORM, TanStack Start. No new tracking logic.

## User Review Required

> [!IMPORTANT]
> **Supabase project creation and Google OAuth setup are manual steps that must be completed by you before I can write any code that talks to the database or auth.** I cannot create a Supabase project or configure Google Cloud OAuth credentials on your behalf. See Step 1 below for exactly what's needed.

> [!WARNING]
> **The current `tsconfig.json` uses `"module": "CommonJS"`.** TanStack Start requires ESM (`"module": "ESNext"` or `"Preserve"`). This change will also affect how Vitest resolves Phase 1's tests. I will configure Vitest to handle this cleanly (it natively supports ESM), but flagging it because the existing `tsconfig.json` will be replaced by TanStack Start's own config. Phase 1's tests must still pass after this change — that's a verification gate.

## Open Questions

> [!IMPORTANT]
> 1. **Timestamp storage**: Phase 1 uses `INTEGER` timestamps (Unix epoch seconds). For Postgres via Drizzle, should I keep `integer()` columns (staying consistent with Phase 1's contract), or migrate to `timestamp()` with timezone? Keeping `integer()` is safer for Phase 1 compatibility — the core functions produce/consume plain numbers, not `Date` objects. **I recommend `integer()` to avoid any adapter complexity.** Please confirm.
> 2. **Seed titles**: The spec suggests hardcoding 2-3 TMDB IDs directly in the route for the minimal UI. Do you have specific titles in mind, or should I pick 2-3 well-known ones (e.g., Breaking Bad, Attack on Titan, Inception)?
> 3. **`.env` cleanup**: The current `.env` has stale `VITE_SUPABASE_*` keys from the deleted project, plus `VITE_` prefixes that won't apply since TanStack Start uses server functions (not client-side env exposure). I'll remove the stale Supabase keys and add the new ones without `VITE_` prefix. The TMDB/TVDB/Fanart keys stay untouched. OK?

---

## Proposed Changes

Organized by the spec's natural checkpoints: infrastructure first, then database, then auth, then API routes, then minimal UI.

---

### Step 1 — Infrastructure Setup (Manual, by you)

Before any code is written, you need to:

1. Create a **new Supabase project** (fresh, not restored).
2. Enable **Google OAuth** in Supabase Auth settings (requires a Google Cloud OAuth Client ID/Secret with the correct redirect URI from Supabase).
3. Provide me the following values to populate `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL` (Postgres connection string — use the **Transaction pooler** URI, port 6543)

I will proceed with code once these are provided.

---

### Step 2 — Project Scaffold (TanStack Start)

#### [MODIFY] [package.json](file:///P:/Projects/Kureha/package.json)
- Change `"type"` from `"commonjs"` to `"module"`.
- Add dependencies: `@tanstack/react-start`, `@tanstack/react-router`, `react`, `react-dom`, `drizzle-orm`, `postgres`, `@supabase/ssr`, `@supabase/supabase-js`, `vinxi`.
- Add dev dependencies: `drizzle-kit`, `@types/react`, `@types/react-dom`.
- Add scripts: `"dev"`, `"build"`, `"start"`, `"db:generate"`, `"db:migrate"`.
- Phase 1's `"test": "vitest run"` stays.

#### [MODIFY] [tsconfig.json](file:///P:/Projects/Kureha/tsconfig.json)
- Will be replaced by TanStack Start's required config (JSX support, ESM module resolution, path aliases).

#### [NEW] app.config.ts
- TanStack Start's Vinxi-based app configuration.

#### [NEW] .gitignore
- Add `.env`, `node_modules/`, `dist/`, `.vinxi/`, `drizzle/` to `.gitignore`. This file does not currently exist — it **must** be created before any commit in this phase, per the spec.

---

### Step 3 — Drizzle Schema (Highest-Risk for Silent Drift)

#### [NEW] src/db/schema.ts
Re-express Phase 1's `schema.sql` as Drizzle `pgTable` definitions. Field-by-field cross-check:

| Phase 1 (`schema.sql` / `types.ts`) | Drizzle (`src/db/schema.ts`) |
|---|---|
| `user_id TEXT NOT NULL` | `text('user_id').notNull()` |
| `media_id TEXT NOT NULL` | `text('media_id').notNull()` |
| `media_type TEXT NOT NULL` | `text('media_type').notNull()` |
| `metadata_source TEXT NOT NULL DEFAULT 'tmdb'` | `text('metadata_source').notNull().default('tmdb')` |
| `intent TEXT NOT NULL DEFAULT 'active'` | `text('intent').notNull().default('active')` |
| `added_at INTEGER NOT NULL` | `integer('added_at').notNull()` |
| `intent_changed_at INTEGER` | `integer('intent_changed_at')` |
| `total_episodes INTEGER` | `integer('total_episodes')` |
| `release_state TEXT NOT NULL` | `text('release_state').notNull()` |
| Composite PK `(user_id, media_id)` | `primaryKey({ columns: [t.userId, t.mediaId] })` |
| `season_number INTEGER NOT NULL DEFAULT 0` | `integer('season_number').notNull().default(0)` |
| `episode_number INTEGER NOT NULL` | `integer('episode_number').notNull()` |
| `watched_at INTEGER NOT NULL` | `integer('watched_at').notNull()` |
| `rewatch_count INTEGER NOT NULL DEFAULT 1` | `integer('rewatch_count').notNull().default(1)` |
| Composite PK `(user_id, media_id, season_number, episode_number)` | `primaryKey({ columns: [...] })` |
| FK `(user_id, media_id) → tracked_media` | `foreignKey({ columns: [...], foreignColumns: [...] })` |

#### [NEW] src/db/client.ts
- Postgres client via `postgres` package, using `DATABASE_URL`.
- Drizzle instance wrapping that client.
- `prepare: false` on the postgres client (required for Supabase connection pooler).

#### [NEW] drizzle.config.ts
- Points at `src/db/schema.ts`, outputs migrations to `drizzle/`.

---

### Step 4 — DB Adapter Layer

#### [NEW] src/db/adapters.ts
Conversion functions between Drizzle row shapes (snake_case DB columns) and Phase 1's TypeScript interfaces (camelCase). This is the boundary layer that exists so `src/core/` never needs to change.

- `dbRowToTrackedMedia(row): TrackedMedia`
- `trackedMediaToDbRow(media): DbRow`
- `dbRowToWatchedEpisode(row): WatchedEpisode`
- `watchedEpisodeToDbRow(ep): DbRow`

---

### Step 5 — Schema Verification Script (§3.3 — Do Not Skip)

#### [NEW] scripts/verify-schema.ts
A standalone script that:
1. Inserts a `tracked_media` row via Drizzle.
2. Inserts a `watched_episodes` row referencing it.
3. Attempts to insert a `watched_episodes` row with a non-existent `media_id` and confirms the FK constraint rejects it.
4. Cleans up after itself.

This re-proves Phase 1's schema guarantees against real Postgres. **Checkpoint: report output of this script before proceeding to API routes.**

---

### Step 6 — Auth Wiring

#### [NEW] src/auth/supabase.server.ts
- Creates a cookie-aware Supabase server client using `@supabase/ssr`.
- Exports a `getSessionUser(request)` helper that extracts the authenticated `user_id` (Supabase UUID) from the request cookies, or returns `null`.

#### [NEW] src/auth/middleware.ts
- TanStack Start middleware (`createMiddleware`) that validates the session via `getSessionUser` and attaches `user_id` to the server function context.
- Rejects unauthenticated requests with a 401.

#### [NEW] src/routes/login.tsx
- Single "Sign in with Google" button.
- Calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
- Redirects to `/` on successful callback.

---

### Step 7 — API Routes (Thin Wrappers)

Each route follows the same pattern: authenticate → fetch existing rows via Drizzle → pass into Phase 1 pure function → write result back via Drizzle → return response. **No tracking logic lives in these files.**

#### [NEW] src/routes/api/mark-watched.ts
- `POST` — wraps `core.markWatched()`.
- Fetches existing `TrackedMedia` and `WatchedEpisode` rows (or null).
- Converts via adapter, calls `markWatched`, writes result back.
- Returns the updated `EffectiveState` (via `deriveProgress` + `getEffectiveState`).

#### [NEW] src/routes/api/unmark-watched.ts
- `POST` — wraps `core.unmarkWatched()`.
- Handles `null` return as a real `DELETE` via Drizzle (not soft-delete).

#### [NEW] src/routes/api/library.ts
- `GET` — returns all `tracked_media` rows for the current user.
- Computes `deriveProgress()` at request time for each title (never stored).

---

### Step 8 — Minimal Verification UI

Explicitly NOT a design phase — bare HTML/JSX, no styling, no component library.

#### [NEW] src/routes/index.tsx
- After login, shows 2-3 hardcoded/seeded titles with:
  - Title name
  - Current `progress` state (computed via `deriveProgress`)
  - A "Mark Episode N Watched" button
  - A "Unmark" button
- Clicking calls the appropriate API route, then re-fetches `/api/library` and re-renders.

---

### Phase 1 Untouched (Verification Gate)

#### [UNCHANGED] src/core/types.ts
#### [UNCHANGED] src/core/progress.ts
#### [UNCHANGED] src/core/tracking.ts
#### [UNCHANGED] src/core/schema.sql
#### [UNCHANGED] tests/tracking.test.ts
#### [UNCHANGED] tests/schema.test.ts

> [!CAUTION]
> If at any point during implementation I find that a Phase 1 function signature doesn't fit the wiring layer's needs, I will stop and flag it explicitly rather than modifying `src/core/`. The adapter layer in `src/db/adapters.ts` exists specifically to absorb shape differences.

---

## Verification Plan

### Automated Tests
- `npm test` — Phase 1's 22 tests must still pass after the project restructure.

### Schema Verification
- Run `scripts/verify-schema.ts` against real Postgres and report the FK constraint check output.

### End-to-End Checks (Manual, per spec §8)
1. Visit `/login`, sign in with Google, land on `/` authenticated.
2. `/api/library` returns empty list for new user.
3. Mark watched on seeded title → real rows appear in Supabase table editor.
4. Page refresh → watched state persists.
5. Same action while signed out → API rejects with 401.
6. FK constraint check passes (§3.3).
7. Mark same episode twice → `rewatch_count` = 2.
8. Manually set intent to `watch_later` in DB, mark episode via UI → API returns `intent: 'active'`.

### Natural Checkpoints (Stop-and-Report)
1. **After Step 3+5**: Drizzle schema generated, migration run, FK verification script passes. Report before moving to auth/API.
2. **After Step 6**: Auth flow working (sign in, session read). Report before moving to API routes.
3. **After Step 7+8**: Full end-to-end working. Final report.
