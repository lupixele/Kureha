## Spot-Check Passed — One Cleanup Item Before Full Review

Both Scenario 9 and Scenario 11 verified correctly:

- **Scenario 9**: genuinely asserts the intent flip (`intent === 'active'`, `intentChangedAt` stamped) on a title that started as `watch_later` — not a weaker check that would pass even if the auto-activation logic were broken.
- **Scenario 11**: genuinely asserts `rewatchCount` per individual episode (E01–03 = 2, E04 = 1) with correct `watchedAt` freezing/refresh — not a loose check that would pass under the wrong "uniform +1" behavior.

Logic is correct in both cases. One structural issue to fix before I review the rest of the implementation.

---

### Fix: `markWatchedWithAutoCreate` vs. spec's `markWatched`

The spec (`PHASE_1_TRACKING_CORE.md`, Section 4.3) defines a single function called `markWatched()`. What's been implemented is a differently-named, differently-shaped function — `markWatchedWithAutoCreate`, taking five positional arguments (`mediaInfo, media, existing, target, currentTime`).

Two questions, not just one fix:

1. **Is `markWatchedWithAutoCreate` now the only mark-watched function in `tracking.ts`, or does a separate `markWatched` also exist alongside it?** If both exist, that's a problem — future phases (and the eventual API layer) need one unambiguous entry point for "mark an episode watched," not two similarly-named functions with unclear scope boundaries between them.

2. **Why did the auto-create-on-first-watch path need to change the function signature rather than living inside the original `markWatched(media, existing, target)` shape from the spec?** If the reason is "constructing a fresh `TrackedMedia` needs more input fields than a shorthand `markWatched` call would have," that's legitimate — but the cleaner fix is usually to accept a single options object rather than five positional parameters, e.g.:

```typescript
function markWatched(
  input: {
    media: TrackedMedia | { userId: string; mediaId: string; mediaType: 'movie' | 'series' | 'anime'; totalEpisodes: number | null; releaseState: ReleaseState } | null
    existing: WatchedEpisode | null
    target: { seasonNumber: number; episodeNumber: number }
    currentTime?: number
  }
): { media: TrackedMedia; episode: WatchedEpisode }
```

### What to do

- Rename `markWatchedWithAutoCreate` to `markWatched` — there should be exactly one function with this responsibility, matching the spec's naming.
- Refactor the signature to a single options object (as above, or your own cleaner equivalent) instead of five positional args.
- Update the Scenario 9 test call site to match the new signature.
- Confirm no other test or function in the codebase still calls a differently-named or differently-shaped version of this function.

Once that's done, re-run the full suite to confirm all 20 (still passing under the renamed/reshaped function), then share the complete implementation (`types.ts`, `progress.ts`, `tracking.ts`, `schema.sql`) for full review.
