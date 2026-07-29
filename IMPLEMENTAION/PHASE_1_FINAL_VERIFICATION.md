## Before Closing Phase 1 — Show Me the Actual Fix, Not Just the Summary

The walkthrough is a good summary, but per how we've been running this: a passing count and a description of a fix aren't verification — I need to see the actual code for the two specific changes.

Paste these four things in full:

1. The complete, current `markWatched` function from `tracking.ts` (post-fix)
2. **Scenario 14** test body (the null-media auto-create case)
3. The complete, current `getSkippedEpisodes` function from `tracking.ts` (confirm it's unchanged, or show the diff if you touched it)
4. **Scenario 15** test body (the mismatched-provider-data edge case)

### What I'm checking once you paste them

**On `markWatched`:** confirm the new signature cleanly separates three real states — full `TrackedMedia` (existing, check for auto-flip), `null` + `mediaInfo` (auto-create fresh), and genuinely invalid input (neither provided). I want to see that `mediaInfo` is actually required/enforced when `media` is `null` — not just present as an optional field that could silently produce a malformed row if omitted.

**On Scenario 14:** confirm it asserts the created `TrackedMedia.intent === 'active'` AND checks the other fields (`userId`, `mediaId`, `mediaType`, etc.) actually came through correctly from `mediaInfo` — not just that *some* object got returned.

**On Scenario 15:** confirm the assertion checks the actual returned skipped-episodes list against a specific expected array, not just "no crash" or array length alone. I want to see what the function actually decided to do with the mismatched episode, asserted explicitly.

Once I've verified these four, Phase 1 is done and we can move to Phase 0/2 planning (auth strategy, backend framework — still open from a few turns back).
