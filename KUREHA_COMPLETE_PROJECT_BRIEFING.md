# Kureha — Complete Project Briefing (Full Session History)

This document is a complete, standalone record of the Kureha project as of this point — decisions made, what's built, what's verified, what's broken, and what's next. Written to be handed to any new tool, person, or session with zero prior context required.

---

## 1. What Kureha Is

Kureha is a personal media tracking web application — comparable to Trakt or TV Time. It tracks movies, TV series, and anime that a user watches: what they've watched, their progress, and their intent (paused, watch later, dropped, etc.).

**Kureha is a pure tracker. It is explicitly NOT a streaming app.** No playback, no torrents, no video player exists or will ever exist in this codebase.

A separate Electron desktop app for streaming is planned for much later. It will be a completely separate codebase that consumes Kureha's tracking data via an API — the same relationship Stremio has with Trakt (Stremio streams; Trakt tracks; they're linked by API, not fused into one app). This is explicitly modeled on that relationship.

### Why This Project Was Rebuilt From Scratch

An earlier version of this project (previously called "Hanami," architecturally based on an open-source app called "Hayase") was a single monolith combining tracking AND torrent-streaming in one codebase, with a legal-safety mechanism (a "7-tap unlock" hiding streaming features from casual users). That entire 27-file specification and its codebase were abandoned. After repeated AI-assisted bug-fixing cycles, the foundation was judged unstable, and the decision was made to rebuild cleanly: tracker first, proven solid, streaming later as a genuinely separate product.

**Working reference code exists from that old project** (a working torrent engine and an extension/plugin system) — kept only as future reference material, not integrated into or influencing this current codebase in any way.

---

## 2. Decisions Log — Source of Truth

### Hard constraints (real, tested code depends on these — do not change without a real reason)

| Decision | Detail |
|---|---|
| Two-axis tracking model | `Progress` (what's actually been watched — always computed at read time, never stored as a decision) is kept completely separate from `Intent` (what the user wants — always explicit, always stored, e.g. `active`/`paused`/`watch_later`/`dropped`). These are never merged into a single status field. This was the single most important architectural fix from the old system, which mixed computed and manual state in one field and caused constant bugs. |
| No playback/percentage tracking | `watched_episodes` has no resume-point or percentage-watched fields. Marking something watched is a binary action — watched or not. This reflects Kureha's identity as a pure tracker: there is no video player, so there is no "how far into the episode" signal to track. |
| User-scoped schema | Every table uses composite primary keys that include `user_id` from the start — `(user_id, media_id)` and `(user_id, media_id, season_number, episode_number)`. |

### Settled architecture

| Decision | Value |
|---|---|
| Product shape | Tracker (this web app) and future streaming app (Electron) are permanently separate codebases, linked only by API |
| Auth | Google OAuth ONLY, via Supabase Auth — no email/password, no other providers |
| Database | Postgres, via Supabase (a fresh project — an earlier Supabase project was deleted and this is a clean restart, not a restore) |
| Backend framework | TanStack Start — fuses frontend and server logic into one project rather than a separate backend + frontend split |
| Query layer | Drizzle ORM, on top of Supabase Postgres |
| `metadata_source` field | `tracked_media` has a `metadata_source: 'tmdb' | 'tvdb'` column, defaulting to `'tmdb'`. This is currently inert (stored but never branched on) — it anticipates a future feature letting users override a specific title's metadata source from TMDB to TVDB, which matters for anime titles where TMDB's episode/season data is sometimes wrong or incomplete. The actual switching logic is a deferred future phase. |
| Electron-to-tracker linking (future, not built) | When the future streaming app is built, it will link to a user's Kureha account using a device-code pairing flow — the same pattern real Trakt uses for linking apps like Stremio (a code is displayed, typed in elsewhere, and polled for confirmation) — explicitly NOT an embedded OAuth browser window inside Electron, which has known reliability problems with Google specifically. |

### Explicitly deferred (known gaps, not being fixed yet, not forgotten)

- Row Level Security (RLS) policies on the database — currently, safety is enforced only at the application/API layer (checking `user_id` matches the authenticated session on every request). This is accepted as sufficient for now but is a hard prerequisite before any real/public release.
- Season-rewatch UI/UX (the underlying batch logic exists and is tested; no UI decision has been made).
- Notification delivery mechanism (only the "should this be notified" yes/no logic exists; no actual push/email/in-app delivery system exists).
- Provider episode-renumbering data integrity (if a provider changes how episodes are numbered, not just how many exist, previously-watched episode records could become mismatched — a known, real gap with no owner yet).
- The actual TMDB→TVDB switching feature itself (the schema field exists; the feature does not).

---

## 3. Development History, In Order

### Phase 1 — Tracking Core Logic (Complete, Verified)

Pure TypeScript logic with zero network/database dependency, fixture-tested in isolation before anything else was built. Lives in `src/core/`:
- `types.ts` — all shared types (`Progress`, `Intent`, `TrackedMedia`, `WatchedEpisode`, etc.)
- `progress.ts` — `deriveProgress()`, `getEffectiveState()`
- `tracking.ts` — `markWatched()`, `unmarkWatched()`, `setIntent()`, `getSkippedEpisodes()`, `rewatchSeason()`
- `schema.sql` — original SQLite-flavored schema definition (superseded by the real Postgres/Drizzle schema in Phase 2, but the shape is identical)

This logic was rigorously fixture-tested against real edge cases (movies vs. series, paused/watch-later auto-reactivating on direct watch, season-level rewatch with partial prior coverage, unreleased titles, etc.) before any wiring work began. **This layer is trusted. Do not modify function signatures here — if a later layer needs a different shape, build an adapter outside `src/core/`, never change core to be more convenient for a database or API layer.**

One addendum was added after initial completion: the `metadata_source` field (see above) was added to the schema and types as an inert, forward-looking field.

### Phase 2 — Wiring the Tracker to a Real Backend (In Progress)

Goal: stand up a real Supabase Postgres database, real Google OAuth login, and real API routes wrapping Phase 1's already-verified logic — with a bare-minimum, unstyled test UI just to prove the whole stack works end-to-end.

**A real security incident occurred and was resolved during this phase:** `.env` (containing API keys) and `node_modules/` had been committed to git from the project's very first commit, before `.gitignore` existed, and pushed to a private GitHub repository. All exposed API keys (TMDB, TVDB, Fanart, OMDB) were rotated as a precaution. Since the repo was private (not public), a full git-history rewrite was judged not worth the effort — instead, `.gitignore` was added and both files were untracked going forward, leaving the now-dead old keys harmlessly in history.

**Checkpoint 1 — Real Postgres schema: verified.** A fresh Supabase project was created. The Drizzle schema was mapped field-by-field against Phase 1's original schema (including `metadata_source`), migrated to the live database, and verified with a real script confirming: both tables exist, correct composite primary keys, the foreign key relationship between `watched_episodes` and `tracked_media` correctly rejects orphan rows, duplicate primary keys are correctly rejected, and `metadata_source` correctly defaults to `'tmdb'`.

**Checkpoint 2 — Google OAuth login: verified, after fixing a real bug.** Initial implementation used cookie-based sessions, but the browser and server ended up using two disconnected session mechanisms — the browser's session lived in localStorage, but the server only checked for a cookie that was never actually being created, so the UI would show "logged in" while the server insisted the user was unauthorized. This was properly diagnosed (not guessed) and fixed by switching to a bearer-token pattern: the browser fetches its current Supabase access token and sends it as an `Authorization: Bearer <token>` header on every protected request; the server verifies that token directly against Supabase Auth and derives the real user ID from it — the server never trusts a user ID sent from the client directly. This was tested for real, by the actual user, in an actual browser, and confirmed working (a real Supabase user UUID was returned from a protected test endpoint while logged in).

**Checkpoint 3 — Tracking API routes and test UI: functionally built, then a serious bug was found and fixed.**

Routes built: `GET /api/library`, `POST /api/mark-watched`, `POST /api/unmark-watched` — all thin wrappers around Phase 1's pure functions, all authenticated via the bearer-token pattern from Checkpoint 2. A bare-minimum, unstyled test page at `/test-library` was built to exercise these routes via real clicks in a browser, using 2-3 hardcoded seed titles (deliberately given obviously-fake IDs like `seed-movie-1` rather than real-looking IMDb IDs, to avoid confusion with real provider data later).

During manual testing, a rewatch-counting UX issue was found and fixed twice: first, the display was showing "Rewatch x1" even on a normal first watch (fixed — now shows a plain checkmark for the first watch, "x2"/"x3" etc. only for genuine rewatches); second, clicking an already-watched item had no way to actually register a rewatch at all (fixed — added an inline choice between "Watch Again (+1)" and "Remove Watched", after first trying a browser-native `window.confirm()` popup which was rejected for being non-customizable and unclear).

**A subsequent independent audit (using a different AI coding tool) found three real, serious bugs that had not been caught previously:**

1. **Critical: marking a brand-new/never-before-tracked title as watched actually failed.** The server code was using a database `UPDATE` for the "create new tracked title" case, which silently affects zero rows when the row doesn't exist yet, causing the subsequent episode-insert to fail against a foreign key constraint. **Fixed**: refactored into a real database transaction using a proper upsert (insert-or-update) operation, with a dedicated integration test specifically re-creating this exact scenario, confirmed passing.
2. **The library read endpoint was silently seeding 3 fake titles into every new user's data on every single read request** — a read endpoint should never have a side effect like this, and it directly contradicted the original plan (seeding was meant to be a one-time, explicit, manual action). **Fixed**: seeding moved to a separate, explicit, manual dev-only script (`scripts/seed-dev-data.ts`); the read endpoint now correctly returns an empty list for a genuinely new user.
3. **An unexplained and shifting test count** (reported as 22, then 21, then 23 across different points) was investigated and explained: during the migration from the original SQLite-based test setup to the real Postgres/Drizzle setup, 3 real database safety-check tests (verifying foreign key rejection and primary key uniqueness enforcement) were accidentally dropped and never replaced with equivalents for the new stack. **Fixed**: these were properly restored as real Postgres-backed integration tests. Current total: 27 tests passing across 5 test files (`tracking.test.ts`, `schema.test.ts`, `schema.integration.test.ts`, `mark-watched.integration.test.ts`, `adapter.test.ts`).

Several smaller code-quality issues from the same audit were also addressed in the same pass: missing transaction error handling on `unmark-watched`, a loosely-typed session state (`useState<any>` replaced with a real Supabase session type), a fragile timing-based auth callback retry (replaced with a proper `onAuthStateChange` event subscription instead of a hardcoded delay), a manually-hand-edited auto-generated route file (regenerated properly instead), and `zod` being used without being declared as a direct dependency (fixed).

---

## 4. Current Status

- **Real, working, tested code exists** for: the core tracking logic (Phase 1), the live Postgres database schema, Google OAuth login, and the core API routes with the critical mark-watched bug now fixed and covered by a real integration test.
- **27 tests passing** across 5 test files as of the last verified report.
- **The last outstanding item**: the user needs to personally verify, in a real browser, that marking a genuinely brand-new title as watched now works cleanly end-to-end — the literal real-world version of the bug that was just fixed in code and covered by an automated test, but not yet confirmed by an actual human click.

## 5. Working Discipline for This Project (Important — Follow This)

This project has been run with a specific, deliberate discipline that should continue:

- **Plan before building.** Any nontrivial change gets proposed as a plan first and is reviewed before implementation begins.
- **Never self-certify.** A tool reporting "tests pass" or "this works" is not sufficient proof on its own — for anything involving real user-facing behavior (like login or a UI interaction), the actual human user must personally verify it in a real browser before it's considered done. This discipline has directly caught multiple real bugs that automated tests alone missed (the cookie/bearer-token auth mismatch, the mark-watched upsert bug, the rewatch UI gap).
- **Show real code and real output, not summaries.** When a fix is reported, the actual changed code and actual command output should be shown, not just a prose description of what was supposedly done.
- **Don't touch `src/core/`** to solve wiring/database/API problems — that layer is proven correct in isolation; if something seems to require changing it, that's a signal the wiring layer's assumptions are wrong, not a reason to change core.
- **Flag genuinely open questions rather than guessing** on anything architectural, and default to the more conservative/simpler option when a judgment call must be made without waiting for input.
