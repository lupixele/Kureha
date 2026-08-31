## Full Review — One Real Bug Found, One Edge Case to Cover

`types.ts`, `progress.ts`, and `schema.sql` all check out clean against the spec — no changes needed there.

`tracking.ts` has one real regression that needs fixing before this phase is done, plus one untested edge case worth covering.

---

### Bug: `markWatched` now throws on `null` media, which breaks auto-add-to-library

Spec Section 4.3 defines the input as `media: TrackedMedia | null` — `null` is the expected signal for **"this title isn't tracked yet, auto-create it."** That's the entire point of the auto-add-to-library rule.

Current code does this instead:

```typescript
if (!input.media) {
  throw new Error("markWatched requires a media object or mediaInfo base properties");
}
```

This means calling `markWatched` with `media: null` — exactly what the spec says should happen when a user marks an episode for an untracked title — now throws instead of creating a new `TrackedMedia` row. The auto-add-to-library behavior is broken.

It looks like the intent was to distinguish "no media info at all" (should throw — genuinely invalid) from "partial base info without tracking state" (should auto-create) via the `'intent' in input.media` duck-type check further down. But that check only runs if `input.media` is truthy — so the actual `null` case never reaches the auto-create branch at all.

**Fix:** `input.media` needs three real states, not two:
1. Full `TrackedMedia` (has `intent`) → check for paused/watch_later auto-flip, proceed
2. Partial base info (userId, mediaId, mediaType, totalEpisodes, releaseState — no `intent`) → auto-create fresh with `intent: 'active'`
3. `null` → this is the actual spec case for a completely untracked title. Decide: does the caller pass base info via a separate parameter when media is null (so the base info is always available even when there's no existing row), or does this function need the caller to supply *both* `null` (as "not tracked") and separately the info needed to create it? Right now the signature conflates "existing tracked media" and "info needed to create new tracked media" into a single `input.media` field with two different possible shapes, which is what caused this bug. Clean this up — likely the simplest fix is: `input.media` is always `TrackedMedia | null`, and a separate required field `input.mediaInfo` (base fields only) is always passed by the caller regardless of whether `media` is null or not. Then the logic is unambiguous: if `media` is null, build from `mediaInfo` with `intent: 'active'`; if `media` exists, check its `intent` for the auto-flip.

Add a test for this specific case — mark an episode watched for a title with `media: null` — asserting a new `TrackedMedia` row gets created with `intent: 'active'`. This isn't one of the original 13 fixtures by name, but it's directly required by spec Section 4.3 point 1 ("Marking any episode watched for a title not yet in tracked_media auto-creates the row") and needs its own explicit test.

---

### Edge case to add: `getSkippedEpisodes` with a watched episode not present in the known-episodes list

Not a bug I can confirm without a test, but worth locking down explicitly since this is the most complex function in the file. Add a test case:

- `allKnownEpisodes` = 5 episodes
- `watchedEpisodes` contains one episode NOT present in `allKnownEpisodes` (simulating stale/mismatched provider data)
- Assert what `getSkippedEpisodes` returns

Confirm the behavior is intentional either way — I'd guess "ignore the unrecognized watched episode, compute skipped based only on recognized watched episodes" is the safer behavior, but I want this decided and tested, not just whatever the current index math happens to produce.

---

Once the `markWatched` null-media bug is fixed (with a test covering it) and the `getSkippedEpisodes` edge case is tested and confirmed intentional, re-run the full suite and report the new pass count.
