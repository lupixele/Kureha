import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../src/db/client';
import { trackedMedia, watchedEpisodes } from '../src/db/schema';
import { sql } from 'drizzle-orm';
// The tests that were dropped in the transition to Drizzle Postgres

describe('Database Schema Constraints (Postgres)', () => {
  const TEST_USER = '00000000-0000-0000-0000-000000000003';
  const ORPHAN_MEDIA_ID = 'schema-orphan-id';
  const VALID_MEDIA_ID = 'schema-valid-id';

  beforeAll(async () => {
    await db.delete(watchedEpisodes).where(sql`user_id = ${TEST_USER}`);
    await db.delete(trackedMedia).where(sql`user_id = ${TEST_USER}`);
  });

  afterAll(async () => {
    await db.delete(watchedEpisodes).where(sql`user_id = ${TEST_USER}`);
    await db.delete(trackedMedia).where(sql`user_id = ${TEST_USER}`);
  });

  const getCauseMessage = (err: any) => err.cause?.message || err.message;

  it('should enforce foreign key constraint on watched_episodes', async () => {
    // Attempting to insert episode without tracked_media parent should throw
    try {
      await db.insert(watchedEpisodes).values({
        userId: TEST_USER,
        mediaId: ORPHAN_MEDIA_ID,
        seasonNumber: 1,
        episodeNumber: 1,
        watchedAt: Math.floor(Date.now() / 1000),
        rewatchCount: 1,
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (e: any) {
      expect(getCauseMessage(e)).toMatch(/foreign key/i);
    }

    // Insert tracked_media first
    await db.insert(trackedMedia).values({
      userId: TEST_USER,
      mediaId: VALID_MEDIA_ID,
      mediaType: 'movie',
      releaseState: 'released',
      addedAt: Math.floor(Date.now() / 1000),
    });

    // Now inserting the watched_episode should succeed
    const res = await db.insert(watchedEpisodes).values({
      userId: TEST_USER,
      mediaId: VALID_MEDIA_ID,
      seasonNumber: 1,
      episodeNumber: 1,
      watchedAt: Math.floor(Date.now() / 1000),
      rewatchCount: 1,
    });
    expect(res).toBeDefined();
  });

  it('should enforce primary key uniqueness on tracked_media', async () => {
    // Media was already inserted above. Inserting again should fail on unique/PK constraint.
    try {
        await db.insert(trackedMedia).values({
            userId: TEST_USER,
            mediaId: VALID_MEDIA_ID,
            mediaType: 'movie',
            releaseState: 'released',
            addedAt: Math.floor(Date.now() / 1000),
        });
        expect(true).toBe(false);
    } catch (e: any) {
        expect(getCauseMessage(e)).toMatch(/duplicate key/i);
    }
  });

  it('should enforce primary key uniqueness on watched_episodes', async () => {
      // Episode 1 was inserted above. Inserting again should fail.
      try {
        await db.insert(watchedEpisodes).values({
            userId: TEST_USER,
            mediaId: VALID_MEDIA_ID,
            seasonNumber: 1,
            episodeNumber: 1,
            watchedAt: Math.floor(Date.now() / 1000),
            rewatchCount: 2,
        });
        expect(true).toBe(false);
      } catch (e: any) {
        expect(getCauseMessage(e)).toMatch(/duplicate key/i);
      }
  });
});
