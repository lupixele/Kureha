## Plan Approved — Proceed to Implementation

Your corrected plan is approved. Build exactly as described:

- `package.json` / `tsconfig.json` per your proposal
- `src/core/types.ts`, `src/core/progress.ts`, `src/core/tracking.ts`, `src/core/schema.sql`
- `tests/schema.test.ts`, `tests/tracking.test.ts`

Implement all pure functions and the schema exactly as defined in `PHASE_1_TRACKING_CORE.md` (Sections 1–6), including `rewatchSeason()`'s per-episode-accuracy rule as you confirmed it.

---

### Before I review the implementation — one verification step

Once `tests/tracking.test.ts` is written, do NOT show me the full test file yet. Instead, first reply with just the list of `describe`/`it` block titles — the test names only, not the bodies — so I can confirm all 13 fixture scenarios from spec Section 7 are present as distinct, separate tests before I review implementation logic.

Pay particular attention to these two — they're the easiest to accidentally collapse or weaken:

- **Scenario 9** (watching directly overrides `paused`/`watch_later` intent) — this must be its own explicit test asserting `intent` flips to `active` as a side effect of `markWatched()`, not folded into a general "mark watched" test that only checks the episode row.
- **Scenario 11** (season rewatch with partial prior coverage) — this must assert per-episode outcomes individually: previously-watched episodes end up with `rewatch_count = 2` (unchanged `watched_at`), and the previously-unwatched episode ends up with `rewatch_count = 1` (fresh `watched_at`). Don't just assert "all episodes now have a watched row" — that would pass even if the per-episode-accuracy rule were implemented wrong.

If any of the 13 scenarios got merged, dropped, or renamed into something vaguer, tell me before I see the code — don't let me discover it by reading test bodies line by line.

Once I confirm all 13 are present and correctly scoped, you can share the full implementation for review.
