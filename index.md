# Kureha Project Index

Full-stack media platform built with TanStack Start, Drizzle ORM, Supabase Auth/Postgres, and React 19.

## Metadata
- Path: `Projects/Kureha`
- Tech Stack: React 19, TanStack Start, Drizzle ORM, Supabase (Auth + Postgres), TypeScript

## File Structure
- `drizzle/`: Database schema and migrations
- `graphify-out/`: Knowledge graph output
- `.tanstack/`: Router build artifacts

## Knowledge Sources
- [Canonical PRD](docs/prd/PRD-001-kureha-core.md) — Approved product contract and source of truth.
- [Milestone ledger](docs/implementation/MILESTONES.md) — Built/verified checkpoints, acceptance evidence, and next milestone boundaries.
- [Current progress](PROGRESS.md) — Current branch, status, and immediate next actions.
- [M2 canonical tracking contract](docs/architecture/M2-canonical-tracking-contract.md) — Owner-approved schema, API, migration, rollback, and acceptance-test contract.
- [Tracking Core History](P:\Download\Kureha\CONTEXT\KUREHA_TRACKING_CORE_TURN_INDEX_2026-08-18.md)
- [Master Context Audit](P:\Download\Kureha\CONTEXT\KUREHA_MASTER_CONTEXT_AND_IMPLEMENTATION_AUDIT_2026-08-18.md)
- [Graphify graph data](graphify-out/graph.json) — Generated nodes, edges, and communities; read-only evidence.
- [Graphify structural report](graphify-out/GRAPH_REPORT.md) — Generated hubs, communities, and surprising connections. NOTE: Contains stale tooling/streaming context.

## Goal
Build a clean, robust media tracker. Streaming/playback application development is deferred to a future, separate Electron project.
