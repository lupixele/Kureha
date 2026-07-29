# Phase 1 — Tracking Core Implementation Plan

This document outlines the plan to build the core tracking logic and data structures for Kureha, strictly adhering to the requirements set out in `PHASE_1_TRACKING_CORE.md`. The focus is on pure functions, type definitions, and in-memory fixture tests—no UI, no HTTP layer, and no playback functionality.

## User Review Required

> [!IMPORTANT]
> Please review the technology choices and the open questions below. This phase establishes the foundation for the tracking system, so we need to be completely aligned before execution.

## Open Questions

These are the remaining open questions from the spec. Please provide your input before we proceed:

> [!WARNING]
> 1. **Auth Strategy:** What is your preferred auth strategy? (e.g., email+password, OAuth-only, magic link?). This will determine the shape of `user_id`. (Since `.env` has Supabase, perhaps Supabase Auth?)
> 2. **Backend Framework/Runtime:** I propose **Node.js with TypeScript**, using **Vitest** for the unit test runner. For the actual backend framework, I suggest **Fastify** for when we build the API (due to its performance and ecosystem), but we will keep this phase purely functional. For schema testing, we can use an in-memory **SQLite** database just to validate the SQL constraints. Do you approve? (Note: Supabase Postgres is assumed for the real backend based on `.env`).
> 3. **Season-Rewatch Semantics:** To confirm, do you approve of the **per-episode-accuracy rule** for batch rewatching (where previously unwatched episodes get `rewatch_count = 1` instead of `2` if a user hits "Rewatch Season")?

## Proposed Changes

We will create a new directory `backend/` or `core/` to house this logic. I propose `src/core` in the root of the project to keep it framework-agnostic.

---

### Project Setup
Initialize a TypeScript project with Vitest for testing.
#### [NEW] package.json
#### [NEW] tsconfig.json

---

### Core Data Models
Define the pure TypeScript interfaces and types.
#### [NEW] src/core/types.ts
- `ReleaseState`, `Progress`, `Intent`
- `TrackedMedia`, `WatchedEpisode`, `EffectiveState`

---

### Pure Functions (Business Logic)
Implement the core pure functions.
#### [NEW] src/core/progress.ts
- `deriveProgress()`: Implementation of the decision table for progress state.
- `getEffectiveState()`: Thin combination logic for effective state.

#### [NEW] src/core/tracking.ts
- `markWatched()`: Binary, no threshold logic for marking an episode/movie watched.
- `unmarkWatched()`: Decrementing rewatch count or deleting the row.
- `setIntent()`: Manual intent changes (e.g., `dropped` -> `active`).
- `getSkippedEpisodes()`: Catch-up prompt support.
- `rewatchSeason()`: Dedicated batch primitive with per-episode accuracy rules.

---

### Database Schema
Define the SQL schema as specified, and set up a lightweight schema test to ensure constraints are valid.
#### [NEW] src/core/schema.sql
- The raw `CREATE TABLE` statements for `tracked_media` and `watched_episodes`.
#### [NEW] tests/schema.test.ts
- Will use a lightweight in-memory SQLite (e.g., `better-sqlite3`) to execute the schema and run basic constraint validations (e.g., foreign keys, default values).

---

### Fixture Test Scenarios
Implement the Definition of Done.
#### [NEW] tests/tracking.test.ts
- Tests covering all 13 fixture scenarios from section 7 of the spec.
- Using purely in-memory fixtures.

## Verification Plan

### Automated Tests
- Run `npm test` (via Vitest) to execute `tests/tracking.test.ts` and `tests/schema.test.ts`.
- Ensure 100% pass rate for the 13 defined fixture scenarios.

### Manual Verification
- Review the code to ensure no I/O, no UI logic, and no playback position logic exists in the core functions.
