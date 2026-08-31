## Correction to Phase 1 Implementation Plan — Read Before Proceeding

Your implementation plan is close, but it violates a boundary that `PHASE_1_TRACKING_CORE.md` sets explicitly. Fix the following before writing any code.

---

### 1. Remove Supabase and Fastify from this phase entirely

Your plan assumes a live Supabase Postgres instance (inferred from an old `.env` file that no longer applies — that Supabase project has been deleted) and proposes Fastify "for when we build the API."

Both are out of scope for Phase 1. Quote from the spec, Section 10:

> "No dependencies beyond a test runner and SQLite bindings for the schema — do not pull in Supabase client, HTTP libraries, or UI frameworks for this phase."

Phase 1 has **zero network dependency**, by design (see spec header: "Explicitly excludes: ... HTTP layer"). Do not add `@supabase/*`, `fastify`, or any HTTP/network package to `package.json`. This phase is pure functions + an in-memory/local SQLite schema check, nothing else.

Supabase remains the likely choice for the *real* backend later, but that decision belongs to a future API-building phase, provisioned fresh, not smuggled into this one.

**Action:** Strip any Supabase/Fastify references from `package.json`, the plan, and any code comments. `better-sqlite3` (or equivalent) stays — it's for local schema/constraint validation only, no live connection.

---

### 2. `user_id` — model as UUID string, no auth implementation yet

We don't have a finalized auth provider decision yet, but to unblock the schema:

- Treat `user_id` as an opaque UUID string type everywhere in `types.ts` and `schema.sql`.
- Do NOT implement any auth logic, session handling, or user creation in this phase — the spec assumes `user_id` exists as a given input to every function. Where fixtures need a `user_id`, hardcode a fixed UUID string (e.g. `'test-user-1'`) — don't build a users table or auth stub.
- This is a placeholder assumption, not a locked decision. Flag it as such in a code comment at the top of `types.ts` (e.g. `// user_id assumed to be a UUID string; auth provider not yet decided`).

---

### 3. Confirm scope of `src/core/` — framework-agnostic, no I/O

Your proposed structure (`src/core/types.ts`, `progress.ts`, `tracking.ts`, `schema.sql`) is correct and matches the spec's function breakdown. Keep this structure. Just make sure:

- No file in `src/core/` imports anything network-related, HTTP-related, or Supabase-related.
- `schema.sql` should be tested via a throwaway in-memory SQLite instance created and destroyed within the test file itself — not a persisted `.db` file checked into the repo, and not a live remote connection.

---

### 4. Season-rewatch semantics — confirmed, proceed as specced

Yes — proceed with the **per-episode-accuracy rule**: episodes that were never actually watched before, even when swept up in a "Rewatch Season" batch action, get created fresh with `rewatch_count = 1`, not incremented to 2. Only episodes with an existing watched row get their count incremented. This is settled — implement `rewatchSeason()` exactly as described in spec Section 5.

---

### 5. Re-run your plan against the spec's own scope boundary before resubmitting

Before you finalize the updated plan, re-check it against `PHASE_1_TRACKING_CORE.md` Section 8 ("Explicitly Out of Scope") and Section 10 ("Handoff Notes"). If any proposed file, dependency, or test setup implies a live network call, an HTTP server, a UI, or a playback/player concept — remove it. This phase produces logic and a schema definition that a *future* phase will wrap in a real backend. It does not stand up that backend itself.

Resubmit the corrected plan (package.json, file structure, test approach) before writing implementation code.
