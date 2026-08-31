## Before Full Code Review — Spot-Check Two Scenarios First

20/20 passing is good, but before I review everything, I want to verify the two highest-risk tests specifically — not because I doubt the result, but because a passing test can still be a weak test if the assertion doesn't actually pin down the behavior it claims to check.

Paste, in full, just these four things:

1. The complete test body for **Scenario 9** (`tracking.test.ts`)
2. The complete implementation of `markWatched()` from `src/core/tracking.ts` — the part that handles the paused/watch_later → active auto-flip
3. The complete test body for **Scenario 11** (`tracking.test.ts`)
4. The complete implementation of `rewatchSeason()` from `src/core/tracking.ts`

Nothing else yet — not the other 18 tests, not `progress.ts`, not `types.ts`. Just these four pieces.

### What I'm specifically checking once you paste them

**Scenario 9:** Does the test actually assert `intent === 'active'` on the returned/updated `TrackedMedia` object after calling `markWatched()` on a title that started as `paused` or `watch_later`? Or does it only check that the `WatchedEpisode` row was created correctly, while leaving the intent-flip unverified? A test that only checks the episode row would still pass even if the intent-flip logic were deleted entirely — I want to confirm that's not what happened here.

**Scenario 11:** Does the test assert `rewatch_count` **per individual episode** (E01=2, E02=2, E03=2, E04=1) — or does it only assert something looser, like "4 watched rows now exist" or "average rewatch count is correct"? A loose assertion could pass even if every episode got `rewatch_count = 2` uniformly, which would be the *wrong* behavior per spec Section 5's per-episode-accuracy rule.

Reply with just those four code blocks — I'll tell you if anything needs fixing before moving to the rest of the implementation.
