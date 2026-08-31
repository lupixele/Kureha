## Small Addendum to Phase 1 — Add `metadata_source` Field (No Logic Changes)

This is a minimal, additive change to `tracked_media` — not a reopening of Phase 1's core logic. Nothing in `progress.ts` or the decision tables changes. This is schema/types only.

### Why

Kureha currently assumes TMDB as the metadata provider for everything. We're adding a field now, while the schema has no production data yet, so that a future phase (not this one) can let users override a specific title from TMDB to TVDB — common need for anime where TMDB's season/episode data is sometimes wrong. Adding this field later, after real user rows exist, would be a much more expensive migration than adding it now.

### Change 1 — `schema.sql`

Add one column to `tracked_media`:

```sql
CREATE TABLE tracked_media (
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  metadata_source TEXT NOT NULL DEFAULT 'tmdb',  -- 'tmdb' | 'tvdb' — only 'tmdb' is actually used/fetched right now
  intent TEXT NOT NULL DEFAULT 'active',
  added_at INTEGER NOT NULL,
  intent_changed_at INTEGER,
  total_episodes INTEGER,
  release_state TEXT NOT NULL,
  PRIMARY KEY (user_id, media_id)
);
```

### Change 2 — `types.ts`

Add the type and the field:

```typescript
export type MetadataSource = 'tmdb' | 'tvdb';

export interface TrackedMedia {
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'series' | 'anime';
  metadataSource: MetadataSource;   // new field, default 'tmdb'
  intent: Intent;
  totalEpisodes: number | null;
  releaseState: ReleaseState;
  intentChangedAt?: number | null;
  addedAt: number;
}
```

### Change 3 — Update any fixture/test helper that constructs a `TrackedMedia`

Anywhere a test currently builds a `TrackedMedia` object (e.g. `createMedia(...)` helpers in `tracking.test.ts`), add `metadataSource: 'tmdb'` as the default so existing tests keep passing unmodified in behavior — this field should not affect any existing test outcome.

### What NOT to do

- Do not add any TVDB fetching, switching logic, or UI hooks — that's explicitly a future phase, not this one.
- Do not add any conditional logic anywhere that branches on `metadataSource` — right now it should be a value that exists and gets stored, and nothing reads it yet.
- Do not change `deriveProgress`, `markWatched`, or any other function signature — this field is inert for now.

### Verification

Re-run the full test suite after this change. All existing tests should still pass unmodified in outcome (only the fixture helper constructing `TrackedMedia` needs the new default field added). Report the pass count.
