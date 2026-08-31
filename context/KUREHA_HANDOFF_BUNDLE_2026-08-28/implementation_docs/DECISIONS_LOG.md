# Kureha — Decisions Log

This file exists because the charter we're working under says "nothing is locked just because it existed before" — but that doesn't mean *nothing* can ever be settled. It means every decision should be **labeled honestly**: is this a hard constraint, or a current best guess we're comfortable revisiting?

Update this file whenever a real decision is made or changed. Each entry should say what changed and why, not just the new value — so nobody has to guess later whether a change was considered and rejected, or just never came up.

---

## Tier 1 — Hard Constraints (changing these means redoing real work)

These aren't "locked because we said so" — they're locked because changing them later would invalidate code/schema/tests that already exist and pass.

| Decision | Value | Why it's hard to change |
|---|---|---|
| Two-axis tracking model | Progress (computed) + Intent (stored), never merged into one field | Phase 1's entire schema, all pure functions, and all 22 tests are built on this split. Reverting to a single status enum means rewriting Phase 1 from scratch. |
| No playback/percentage tracking in the tracker codebase | `watched_episodes` has no `progress_percentage` or `resume_point_seconds` — marking watched is binary | This is a product-identity decision (tracker, not player), not just a technical one. Adding it back would require re-introducing a whole class of state Phase 1 deliberately removed. |
| Schema is user-scoped from the start | `(user_id, media_id)` composite keys throughout | Already built this way in Phase 1. Retrofitting user-scoping onto a single-user schema later is a real migration, not a config change. |

---

## Tier 2 — Settled Direction (current best answer, real cost to change, but not "rewrite everything")

| Decision | Current Answer | What changing it would cost |
|---|---|---|
| Product shape | Tracker (web) and streaming app (Electron) are separate codebases, linked by API — not one app with a hidden mode | Moderate. Would mean redesigning the API boundary, but Phase 1's core logic wouldn't need to change either way. |
| Auth method | Google OAuth only, via Supabase Auth | Low-moderate. Supabase supports adding more providers without touching `user_id` shape (still a UUID either way). Removing Supabase Auth entirely (e.g. switching to Clerk) would mean re-doing the auth wiring, not the tracking logic. |
| Database | Postgres via a new Supabase project | Moderate. Postgres itself is portable (any Postgres host works); Supabase-specific features (RLS, Auth) are the sticky part if we ever left Supabase specifically. |
| Backend framework | TanStack Start (fused frontend + server, not a separate backend project) | Moderate-high once real code exists on top of it — but right now, zero code has been written against this choice yet, so changing it today is still cheap. |
| Query layer | Drizzle ORM on top of Supabase Postgres, for type-safe queries matching Phase 1's schema | Low. Drizzle schema definitions are additive — could be swapped for raw SQL or another query builder without touching the pure functions in `progress.ts`/`tracking.ts`. |
| Electron-to-tracker linking (future) | Device-code pairing flow, same pattern as Trakt | Low right now (nothing built yet). Would matter more once the Electron app exists. |
| Metadata source scoping | `tracked_media` gets a `metadata_source: 'tmdb' \| 'tvdb'` field from the start, defaulting to `'tmdb'`, even though only TMDB is actually wired up right now | Low today (additive column, not yet load-bearing for any logic). Would become expensive if skipped now and added after real user data exists — `media_id` meaning would need retroactive disambiguation across two providers. Added 2026-07-22 per user request: users need a per-title override from TMDB to TVDB for titles where TMDB's season/episode data is wrong (common for anime). |

---

## Tier 3 — Open Questions (no answer yet, don't assume one)

| Question | Status |
|---|---|
| Season-rewatch UI (button placement, confirmation step) | Backend semantics settled (Phase 1, §5); UI/UX not designed yet |
| `dropped → active` — confirmation dialog or silent? | Backend confirmed silent; matches current UI-less phase, but worth re-confirming once a real UI exists |
| Notification delivery mechanism (push, email, in-app only?) | Only the eligibility predicate (`isNotifiable`) exists. Delivery is fully undecided. |
| Provider episode-renumbering fix (episode IDs vs. numbers) | Flagged as a real data-integrity gap in Phase 1, explicitly deferred, no owner yet |
| TMDB→TVDB per-title switching logic | Schema field added (see Tier 2), but the actual switching UI, TVDB data-fetching, and re-mapping of existing `watched_episodes` when a title is switched are all fully undecided. Needs its own phase once TMDB integration is stable. |

---

## How to Use This File

- **Before proposing a change to a Tier 1 item**, make sure the cost (rewriting real, tested code) is worth it — these aren't off-limits, just expensive.
- **Tier 2 items are genuinely open to revisiting** — if a better option shows up, or circumstances change (like the Supabase account deletion did), update the table and note why.
- **Tier 3 items should stay unresolved until someone actually needs the answer** — per the charter, don't design for a phase that isn't happening yet.
- When something moves tiers (e.g., a Tier 2 decision becomes Tier 1 because real code now depends on it), update this file in the same pass as the code change — don't let the log go stale.
