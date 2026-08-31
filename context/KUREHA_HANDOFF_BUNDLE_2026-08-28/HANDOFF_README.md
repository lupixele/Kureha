# Kureha Handoff Bundle

Generated: 2026-08-28

## Authority order

1. **Tracking-Core.md** — highest-priority/latest chat context. Treat this as the primary authority when older plans conflict.
2. **reference/Claude-memory-edits.png** — user-supplied Claude project-memory edits; use as additional current context, not as a replacement for Tracking-Core.
3. **source_snapshot/Kureha-implementation-snapshot.zip** — actual implemented project snapshot. Treat code as evidence of what was implemented; implementation can contain bugs or stale choices and must be weighed against Tracking-Core.
4. **implementation_docs/** — phase specs, approvals, corrections, walkthroughs, decisions log, and Phase 2 planning material. Useful for chronology and rationale; older docs may be superseded.
5. **reference/KUREHA_COMPLETE_PROJECT_BRIEFING.md**, **PROGRESS.md**, **Multi_Source_Media_Addon_Architecture_Report.md**, and **index.md** — supporting summaries/reference material from the project snapshot. Do not let these override newer Tracking-Core decisions.

## Working rule for a new agent

Do not invent missing decisions. When sources disagree, prefer the authority order above, preserve unresolved items as unresolved, and distinguish clearly between:

- what was decided,
- what was planned,
- what is actually implemented,
- what has been superseded,
- what remains open or risky.

Kureha is a **tracker-first web service**. Streaming is a separate future Electron application that can link to the tracker, not a feature to be built into the tracker website.
