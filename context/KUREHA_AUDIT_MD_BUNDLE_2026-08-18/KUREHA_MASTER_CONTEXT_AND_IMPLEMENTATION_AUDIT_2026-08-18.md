# Kureha — Master Context and Implementation Audit — 2026-08-18

> Reconstructed on 2026-08-28 from `Tracking-Core.md`, `Kureha.zip`, and the implementation records contained in that archive. The filename/date is retained because this is the requested handoff set. Where historical documents disagree, the latest Tracking-Core decisions and current implementation take precedence.

## 0. How to Use This Handoff

Use this document to initialize a new agent without forcing it to re-read every historical transcript first. It is intentionally explicit about what is **current**, what is **implemented**, what is **historical**, and what remains **open**.

### Authority hierarchy

1. **Tracking-Core.md** — latest conversation/decision record; treat as the primary narrative authority.
2. **Current implementation in `Kureha.zip`** — authoritative evidence of what code actually exists, but not proof that every implementation choice is desired forever.
3. **IMPLEMENTAION/*.md** — valuable phase specs, review trail, and decision rationale; can become stale when later Tracking-Core changes supersede them.
4. **Older Hanami/Kureha design/spec/reference material** — history/reference only unless re-adopted explicitly.
5. **Generated/vendor/tooling material** (`node_modules`, `.git`, Graphify output, generated route tree, etc.) — implementation environment, not product requirements.

## 1. Product Identity — Current

- Kureha is being rebuilt as a **web-first media tracking service**. The tracker must stand on its own and should not contain streaming/playback logic.
- A future **separate Electron streaming app** may integrate with Kureha as an external client, similar to how a streaming client connects to Trakt. It should use Kureha APIs/device linking rather than turning the tracker website into a player.
- The old torrent engine/extensions were retained as reference for that future app, not as current tracker architecture.
- The immediate goal is a world-class tracker: clean data model, reliable episode marking, library/progress state, metadata accuracy, auth, API/service boundaries, and eventually polished UX.

## 2. Why the Reboot Happened

The previous implementation was deliberately discarded after repeated patch/fix cycles suggested the foundation itself was unstable. The reboot reset technical decisions rather than preserving old architecture by inertia. Existing documents/code became inputs to challenge, not sacred requirements. This led to a tracker-first domain redesign before rebuilding the live backend/web layer.

## 3. Major Decision Changes Over Time

- **Monolithic tracker+streaming → separate products:** Old Kureha/Hanami material mixed tracking and BYOC/torrent streaming. Current direction is a pure tracker web service plus a later separate Electron streaming client.
- **Single stored status → two-axis model:** Progress is computed from watch data and release metadata; intent is stored explicitly. This removes ambiguity between factual progress and user preference.
- **Playback percentage/resume logic → removed from tracker:** The 85% threshold/resume-point idea was correctly rejected because a tracking website is not the player and has no authoritative playback position.
- **Single-user/local assumptions → multi-user backend:** Core schema is user-scoped by `(user_id, media_id)` and watched rows carry the same user identity.
- **Old Supabase project → fresh Supabase setup:** The old project was deleted; a new Supabase Postgres/Auth setup was created for the reboot.
- **Backend split consideration → TanStack Start:** The chosen web architecture keeps frontend/server in one TypeScript project while preserving proper server/service boundaries and future external API capability.
- **Raw/manual schema → Drizzle + Postgres:** Drizzle is used for type-safe DB access and migrations; Supabase remains auth/hosting/infrastructure.
- **TMDB-only assumption → source-aware schema:** TMDB remains primary, but `metadata_source` exists now so specific titles can later be switched to TVDB when TMDB episode/season data is wrong.
- **Firebase → not in current stack:** Current code uses Supabase Auth/Postgres. Firebase/Firestore are not part of the reviewed implementation.

## 4. Current Tracking Domain Model

### 4.1 Progress — computed, never a manual status

`unreleased | not_started | in_progress | caught_up | finished`

Rules implemented in `src/core/progress.ts`:

- Unreleased media always derives `unreleased`.
- Movie: no watched row → `not_started`; watched row → `finished`.
- Series/anime with zero watched rows → `not_started`.
- Ongoing series/anime: watched count < available total → `in_progress`; otherwise `caught_up`.
- Ended series/anime: watched count < total → `in_progress`; otherwise `finished`.

### 4.2 Intent — explicit user state

`active | paused | watch_later | dropped`

- Intent does not rewrite factual progress.
- Directly marking watched auto-activates `paused` or `watch_later`.
- `dropped → active` is a simple explicit state change, currently without confirmation semantics at domain level.

### 4.3 Watch events

- Tracking is **binary**, not percentage-based.
- One watched row per user/title/season/episode; movies use a conventional episode key.
- `rewatchCount` starts at 1 and increments for repeated marks.
- Rewatching keeps the original `watchedAt` in the pure core implementation.
- Unmark decrements a rewatch count >1; otherwise the row is deleted.
- Season rewatch applies per-episode accuracy: previously watched episodes increment; previously unwatched episodes become first watches with count 1.

## 5. Metadata Model

- **TMDB is the primary metadata source.**
- TVDB is intended as a per-title alternate/fallback when TMDB has materially wrong season/episode organization. It is not a blanket global switch.
- Current schema contains `metadata_source: tmdb | tvdb`, default `tmdb`.
- Current tracking logic does not branch on provider yet.
- The hard future problem is not the UI toggle; it is safe remapping of existing watched episodes when provider numbering differs. That remains intentionally deferred until metadata integration is mature enough to design with real examples.
- Fanart and other API keys may exist for future metadata/artwork use; presence in `.env` is not evidence that those integrations are implemented.

## 6. Authentication and User Identity

- Website launch auth decision: **Google OAuth only** through Supabase Auth.
- `user_id` is the Supabase Auth user UUID.
- Server functions derive user identity from authenticated context; user IDs are not accepted as trusted request-body input.
- Future Electron app should link to an existing Kureha account using a device-code/pairing flow, not by embedding Google OAuth inside Electron.

## 7. Current Technical Stack — Implemented

- TypeScript project, ESM (`"type": "module"`).
- React `^19.2.8` / React DOM `^19.2.8`.
- TanStack Start `^1.168.32` + TanStack Router `^1.170.18`.
- Supabase JS `^2.110.8` and SSR helpers `^0.12.3`.
- Drizzle ORM `^0.45.2` + Postgres.js `^3.4.9`.
- Zod `^4.4.3` for server input validation.
- Vitest for tests; Drizzle Kit for schema generation/migration; `tsx` for DB verification scripts.

## 8. What Is Actually Implemented

- **Core domain:** `types.ts`, `progress.ts`, `tracking.ts`, and legacy schema fixture SQL.
- **Drizzle/Postgres schema:** `tracked_media` and `watched_episodes` with composite primary keys and parent FK.
- **Adapters:** Snake_case DB rows ↔ camelCase core types.
- **Supabase auth plumbing:** Browser/server clients, middleware, auth functions, login/callback routes.
- **Library read:** Authenticated server function loads the current user library and derives progress/effective state.
- **Mark watched:** Authenticated, Zod-validated DB transaction that uses Phase-1 core logic and persists the result. Rewatch conflict increments atomically in Postgres.
- **Unmark watched:** Authenticated transaction calling the core unmark semantics and persisting delete/decrement behavior.
- **Diagnostic tracker UI:** `/test-library` provides a development surface for proving auth/library/marking flows. It is not the final design language/product library.
- **Schema verification:** Script checks real Postgres table existence, metadata default, FK rejection, duplicate PK rejection, and rewatch upsert increment.
- **Integration tests:** Real-database tests exist for constraints and the brand-new title mark-watched path.

## 9. Testing State

- Tracking fixture suite contains 17 tests covering the original 15 scenarios with Scenario 8 split into focused checks.
- Schema/unit and adapter tests are present.
- The tracking history records a later run of **27/27 passing tests** after restoring real schema integration tests and mark-watched coverage. Treat this as a recorded historical verification result, not a fresh run performed by this regenerated audit.
- Current archive includes `tests/schema.integration.test.ts` and `tests/mark-watched.integration.test.ts`, which are stronger evidence than summaries alone because they directly exercise Postgres behavior.
- Do not casually run real-DB tests against an unknown production/user database; use dedicated test credentials/environment when automating them.

## 10. Important Implementation Caveats / Audit Findings

- **DB-level enum validation:** `media_type`, `metadata_source`, `intent`, and `release_state` are text columns with Drizzle compile-time `$type` annotations. Postgres itself does not reject arbitrary strings unless CHECK constraints are added.
- **Provider renumbering:** Watched episodes are identified by season/episode numbers. Switching or refreshing providers can be dangerous if numbering changes. This is explicitly not solved yet.
- **Cached episode totals:** Progress uses `totalEpisodes`; metadata changes can legitimately move an ongoing show from caught-up to in-progress without user action. UX/refresh rules need to acknowledge this.
- **Integration test isolation:** Real DB tests clean up their dedicated IDs, but a dedicated test DB/project/schema is still the correct long-term safeguard.
- **Diagnostic UI only:** The current route proves flows; it should not be mistaken for the final Kureha UX or design system.
- **Error contracts:** Some server code returns generic error strings. Production API/UX should eventually use stable error categories and safe messages.
- **RLS status:** Current server-derived auth boundary is important, but DB RLS policy design is not evidenced as a completed, tested production layer in the audited source. Do not claim it is done without checking Supabase itself/migrations.

## 11. What Is Explicitly NOT Part of the Current Tracker

- Torrent playback, file selection, stream serving, extension/Grove systems, BYOC streaming unlocks.
- Playback percentages, resume positions, “85% watched” thresholds, scrobbling from a built-in player.
- Electron process/IPC architecture inside this web tracker repo.
- Global automatic switch from TMDB to TVDB.
- Speculative social/collaborative systems unless they are deliberately brought back in a later tracker phase.

## 12. Open / Parked Decisions

- Production library/home UX and visual design.
- Search/discovery and live TMDB ingestion architecture.
- Per-title TVDB override UX and, more importantly, episode mapping/remapping rules.
- Notification delivery channel(s) and eligibility beyond the current simple predicate.
- Season rewatch UX/confirmation placement.
- Metadata refresh cadence, source provenance, failure/staleness behavior.
- Public/external API design for the future Electron client and device linking details.
- RLS policies and hardening if/when clients gain any direct Supabase data access.
- Large-library pagination/performance only after measurement demonstrates need.

## 13. Recommended Continuation Order

1. **Close browser verification of the current diagnostic flow** if not already done in the environment being handed off: sign in, mark a brand-new title, verify persistence and library refresh, unmark, verify state.
2. **Freeze the core/service boundaries** unless a concrete bug proves they are wrong. Add regression tests before changing semantics.
3. **Build metadata ingestion/search as its own small phase**, TMDB first. Do not mix TVDB switching into the first ingestion slice.
4. **Design the real tracker UX only after data flows are reliable**, replacing `/test-library` rather than polishing it into production by accident.
5. **Add DB/RLS hardening and test isolation** as the external API surface grows.
6. **Only after the tracker is mature**, design the separate Electron streaming app and its Kureha account-link/API integration.

## 14. Agent Working Rules

- Explain technical steps to the user in short, plain language by default. Read long coding-agent output yourself and surface only what the user needs to decide or do.
- Do not trust “all tests passed” as sufficient proof when an AI wrote both implementation and tests. Spot-check the riskiest tests and the exact code paths they claim to verify.
- For phase work: plan first, explicit out-of-scope list, clear exit criteria, small implementation slice, then checkpoints with real code/output rather than summaries.
- Do not silently change public core function signatures. Adapt outside the domain core unless a deliberate redesign is approved.
- Do not resurrect old decisions just because an old file says so. Identify whether it is current, superseded, reference-only, or truly unresolved.
- Keep secrets out of git. `.env` stays ignored. Previously exposed provider keys were rotated during the project history.

## 15. Final Current-State Summary

Kureha has progressed beyond a theoretical Phase-1 tracker core. The audited implementation contains the pure tracking domain plus a real TanStack/Supabase/Drizzle web backend slice: authentication, persisted user libraries, mark/unmark operations, adapters, schema verification, and real-DB tests. The architecture direction is coherent with the tracker-first reboot. The highest-value next work is metadata ingestion and production tracker UX, while preserving the current separation from streaming. The largest unresolved technical risk is provider identity/episode remapping, especially the planned per-title TMDB→TVDB override; it should be designed deliberately rather than hidden behind a simple toggle.