## Test Structure Approved — One Refinement, Then Proceed

All 13 scenarios are present, correctly scoped, and not merged into vaguer tests. Scenarios 9 and 11 specifically look right — they assert the actual behavior (intent auto-flip, per-episode rewatch accuracy), not just "something happened."

One refinement before you populate bodies:

**Scenario 8** bundles three distinct behaviors into one test name (count increments, `watched_at` unchanged, unmark decrements/deletes). If this stays as a single `it()` block asserting all three in sequence, a failure partway through will only tell us "Scenario 8 failed," not which of the three broke.

Split it into three separate `it()` blocks:
- `Scenario 8a: rewatching an already-watched episode increments rewatch_count`
- `Scenario 8b: rewatching an already-watched episode does not change watched_at`
- `Scenario 8c: unmarking decrements rewatch_count if >1, deletes the row if =1`

Apply the same principle anywhere else in the suite if you notice a test name bundling more than one distinct assertion — I'd rather have more, narrowly-named tests than fewer broad ones.

Once that split is done, populate all test bodies and implement the corresponding logic in `src/core/`. Run the full suite and report back:

1. Pass/fail count
2. Any scenario that fails, with the actual vs. expected output
3. Confirmation that `schema.test.ts` constraint checks (foreign keys, defaults, primary key uniqueness) also pass

Do not show me the full implementation source yet — just the test run results first. If everything passes, I'll review the actual code next.
