## Kureha Project Rules
- **Contract Source of Truth:** `docs/prd/PRD-001-kureha-core.md` is the canonical product contract. Do not implement features or alter tracking semantics outside this approved PRD.
- **No Streaming:** This is a tracker-only tool. No streaming, torrents, or playback logic inside this repository.
- **Architecture Boundaries:** Pure tracking core -> Drizzle ORM -> TanStack Start server functions -> React UI.
- **Identity & Providers:**
  - Kureha owns internal canonical group, continuity-track, installment, and episode IDs.
  - AniList is the canonical provider for anime identity, relations, and airing schedules.
  - Ani.zip is optional non-blocking enrichment for episode metadata and cross-provider IDs.
  - TMDB is canonical for movies and non-anime television, plus optional mapped anime artwork.
- **Supabase & Persistence:**
  - Authentication via Supabase Google OAuth and Postgres (Mumbai `ap-south-1`).
  - Strict server-side authorization and database RLS. Profiles and activity default to `private`.
- **Database & Testing Rules:**
  - No automatic seeds on read. Verify data through isolation tests.
  - Three-tier testing: Unit tests (fast, pure domain, no network) -> PGlite (local DB behavior) -> Real Postgres (opt-in via `TEST_DATABASE_URL`).
  - Watch mutations must execute under transactions with correct idempotency.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
