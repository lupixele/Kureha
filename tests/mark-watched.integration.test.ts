import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/db/client';
import { trackedMedia, watchedEpisodes } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { executeMarkWatched } from '../src/server/mark-watched';

const TEST_USER = '00000000-0000-0000-0000-000000000002';

describe('markWatched Integration (Real Database UPSERT)', () => {
  const TEST_MEDIA_ID = 'integration-brand-new-' + Date.now();

  beforeAll(async () => {
    // Ensure clean state for this mediaId
    await db.delete(watchedEpisodes).where(and(eq(watchedEpisodes.userId, TEST_USER), eq(watchedEpisodes.mediaId, TEST_MEDIA_ID)));
    await db.delete(trackedMedia).where(and(eq(trackedMedia.userId, TEST_USER), eq(trackedMedia.mediaId, TEST_MEDIA_ID)));
  });

  afterAll(async () => {
    // Cleanup
    await db.delete(watchedEpisodes).where(and(eq(watchedEpisodes.userId, TEST_USER), eq(watchedEpisodes.mediaId, TEST_MEDIA_ID)));
    await db.delete(trackedMedia).where(and(eq(trackedMedia.userId, TEST_USER), eq(trackedMedia.mediaId, TEST_MEDIA_ID)));
  });

  it('Scenario: Marking a brand-new/untracked title watched successfully upserts tracked_media and watched_episodes', async () => {
    // Call the exact ServerFn backing implementation
    const res = await executeMarkWatched(TEST_USER, {
         mediaId: TEST_MEDIA_ID,
         mediaType: 'anime',
         totalEpisodes: 12,
         releaseState: 'ongoing',
         seasonNumber: 1,
         episodeNumber: 1
    });

    expect(res).toBeDefined();
    expect(res.ok).toBe(true);

    if (res.ok) {
        expect(res.data.media.mediaId).toBe(TEST_MEDIA_ID);
        expect(res.data.media.intent).toBe('active');
        expect(res.data.watchedEpisodes).toHaveLength(1);
    }

    // Verify side-effects in database directly
    const mediaRows = await db.select().from(trackedMedia).where(and(eq(trackedMedia.userId, TEST_USER), eq(trackedMedia.mediaId, TEST_MEDIA_ID)));
    expect(mediaRows).toHaveLength(1);
    expect(mediaRows[0].intent).toBe('active');

    const epRows = await db.select().from(watchedEpisodes)
      .where(and(eq(watchedEpisodes.userId, TEST_USER), eq(watchedEpisodes.mediaId, TEST_MEDIA_ID)));

    expect(epRows).toHaveLength(1);
    expect(epRows[0].seasonNumber).toBe(1);
    expect(epRows[0].episodeNumber).toBe(1);
  });
});
