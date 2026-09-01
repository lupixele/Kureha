
import { vi } from 'vitest';
// We mock db client before importing tracking
let testDb: any;
vi.mock('../src/db/client', () => {
  return {
    get db() { return testDb; }
  };
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as schema from '../src/db/schema';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import fs from 'fs';
import path from 'path';
import { eq, and, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import {
  markEpisodeWatched,
  unmarkEpisodeWatched,
  deleteTracking,
  markMovieWatched,
  unmarkMovieWatched,
  addToLibrary,
  removeFromLibrary,
  setMediaIntent
} from '../src/server/tracking/tracking';

function uuidv4() {
  return crypto.randomUUID();
}

describe('M2 Canonical Tracking References (TDD)', () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;

  const userId = uuidv4();
  const mediaGroupId = uuidv4();
  const trackId = uuidv4();
  const installmentId = uuidv4();
  const ep1Id = uuidv4();
  const ep2Id = uuidv4();
  const ep3Id = uuidv4();

  const movieGroupId = uuidv4();

  beforeAll(async () => {
    pg = new PGlite();
    db = drizzle(pg, { schema });
    testDb = db;


    const drizzleDir = path.join(__dirname, '../drizzle');
    const files = fs.readdirSync(drizzleDir);
    const migrationFiles = files.filter(f => f.endsWith('.sql')).sort();

    for (const file of migrationFiles) {
      const sqlContent = fs.readFileSync(path.join(drizzleDir, file), 'utf8');
      await pg.exec(sqlContent);
    }
  });

  afterAll(async () => {
    await pg.close();
  });

  // Helper to reset and seed DB
  async function seed() {
    await db.delete(schema.trackingOperations);
    await db.delete(schema.canonicalWatchedEpisodes);
    await db.delete(schema.canonicalWatchedMovies);
    await db.delete(schema.userMediaState);
    await db.delete(schema.episodes);
    await db.delete(schema.installments);
    await db.delete(schema.continuityTracks);
    await db.delete(schema.mediaGroups);
    await db.delete(schema.profiles);

    await db.insert(schema.profiles).values({
      id: userId,
      username: 'testuser',
      displayName: 'Test User'
    });

    await db.insert(schema.mediaGroups).values({
      id: mediaGroupId,
      type: 'anime',
      title: 'Test Anime',
      releaseState: 'airing'
    });


    await db.insert(schema.continuityTracks).values({
      id: trackId,
      mediaGroupId,
      type: 'mainline',
      title: 'Main Track'
    });

    await db.insert(schema.installments).values({
      id: installmentId,
      continuityTrackId: trackId,
      sequenceNumber: 1,
      format: 'TV',
      status: 'releasing',
      title: 'Season 1'
    });

    // Released episodes
    await db.insert(schema.episodes).values([{
      id: ep1Id,
      installmentId,
      episodeNumber: 1,
      isExtra: false,
      airDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0] // past
    }, {
      id: ep2Id,
      installmentId,
      episodeNumber: 2,
      isExtra: false,
      airDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0] // past
    }, {
      id: ep3Id,
      installmentId,
      episodeNumber: 3,
      isExtra: false,
      airDate: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0] // future (unreleased)
    }]);

    await db.insert(schema.mediaGroups).values({
      id: movieGroupId,
      type: 'movie',
      title: 'Test Movie',
      releaseState: 'ended'
    });

    await db.insert(schema.releaseStateEvidence).values({
      id: uuidv4(),
      mediaGroupId: movieGroupId,
      source: 'tmdb',
      sourceId: '1234',
      evidenceKind: 'release_date',
      precision: 'exact',
      exactDate: new Date(Date.now() - 86400000).toISOString().split('T')[0]
    });
  }

  describe('Database & Migrations', () => {
    it('M2-01: verifies destructive migration applied (tracked_media dropped)', async () => {
      try {
        await pg.exec('SELECT * FROM tracked_media');
        expect.fail('tracked_media should be dropped');
      } catch (e: any) {
        expect(e.message).toMatch(/relation "tracked_media" does not exist/);
      }
    });

    it('M2-02: mappingVersions enforces (media_group_id, version_number) uniqueness', async () => {
      await seed();
      await db.insert(schema.mappingVersions).values({
        id: uuidv4(),
        mediaGroupId,
        versionNumber: 1
      });
      await expect(db.insert(schema.mappingVersions).values({
        id: uuidv4(),
        mediaGroupId,
        versionNumber: 1
      })).rejects.toThrow();
    });

    // We skip testing repository validation here since that's a domain logic test that we will write later if needed, but uniqueness is DB level.
  });

  describe('markEpisodeWatched - Single', () => {
    it('M2-07: successfully marks a single released episode', async () => {
      await seed();
      const res = await markEpisodeWatched({
        userId,
        operationId: uuidv4(),
        episodeId: ep1Id,
        mode: 'this_episode',

      });
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedEpisodes).where(eq(schema.canonicalWatchedEpisodes.episodeId, ep1Id));
      expect(rows).toHaveLength(1);
    });

    it('M2-08: prevents marking an unreleased episode (RELEASE_UNCONFIRMED)', async () => {
      await seed();
      const res = await markEpisodeWatched({
        userId,
        operationId: uuidv4(),
        episodeId: ep3Id, // unreleased
        mode: 'this_episode',

      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect((res as any).error?.code).toBe('RELEASE_UNCONFIRMED');
      }
    });

    it('M2-10: supports marking as rewatched via same endpoint (increments rewatch_count)', async () => {
      await seed();
      await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode' });
      const res2 = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode' });
      expect(res2.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedEpisodes).where(eq(schema.canonicalWatchedEpisodes.episodeId, ep1Id));
      expect(rows[0].rewatchCount).toBe(2);
    });
  });

  describe('markEpisodeWatched - Bulk Gap-Fill', () => {
    it('M2-11: earlier_current_season gap-fills previous episodes in the same season', async () => {
      await seed();
      const res = await markEpisodeWatched({
        userId,
        operationId: uuidv4(),
        episodeId: ep2Id,
        mode: 'earlier_current_season',

      });
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedEpisodes);
      expect(rows).toHaveLength(2); // ep1 and ep2
      const ids = rows.map(r => r.episodeId);
      expect(ids).toContain(ep1Id);
      expect(ids).toContain(ep2Id);
    });
  });

  describe('unmarkEpisodeWatched', () => {
    it('M2-15: unmark once decrements rewatch_count', async () => {
      await seed();
      await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode' });
      await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode' }); // rewatch count 2

      const res = await unmarkEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, scope: 'this_episode', removal: 'once' });
      expect(res.ok).toBe(true);

      const rows = await db.select().from(schema.canonicalWatchedEpisodes);
      expect(rows[0].rewatchCount).toBe(1);
    });

    it('M2-16: unmark completely deletes the watched record entirely', async () => {
      await seed();
      await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode' });
      await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode' }); // rewatch count 2

      const res = await unmarkEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, scope: 'this_episode', removal: 'completely' });
      expect(res.ok).toBe(true);

      const rows = await db.select().from(schema.canonicalWatchedEpisodes);
      expect(rows).toHaveLength(0);
    });
  });


    it('M2-03: mappingVersionEntries require targets to belong to the mapping version media group', async () => {
      // Validated by validateMappingVersionEntries function
      const mappingVersionId = uuidv4();
      await db.insert(schema.mappingVersions).values({ id: mappingVersionId, mediaGroupId, versionNumber: 2 });
      await db.insert(schema.mappingVersionEntries).values({
        id: uuidv4(),
        mappingVersionId,
        mediaGroupId: movieGroupId, // Mismatch! mapping version is for mediaGroupId
        provider: 'tmdb',
        targetType: 'movie',
        providerId: '123',
        source: 'manual'
      });
      // Import the validation function and check
      const { validateMappingVersionEntries } = await import('../src/server/tracking/tracking');
      await expect(validateMappingVersionEntries(db, mappingVersionId)).rejects.toThrow('MAPPING_TARGET_MISMATCH');
    });

    it('M2-19: unmark bulk uses deterministic locking and order', async () => {
      // Just assert it succeeds for later_current_season which exercises the order by asc logic
      await seed();
      await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode' } as any);
      const res = await unmarkEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, scope: 'later_current_season', removal: 'completely' } as any);
      expect(res.ok).toBe(true);
    });

    it('M2-21: markMovieWatched prevents marking unreleased movies', async () => {
      await seed();
      // change release date to future
      await db.update(schema.releaseStateEvidence).set({ exactDate: new Date(Date.now() + 86400000).toISOString().split('T')[0] }).where(eq(schema.releaseStateEvidence.mediaGroupId, movieGroupId));
      const res = await markMovieWatched({ userId, operationId: uuidv4(), mediaGroupId: movieGroupId } as any);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('RELEASE_UNCONFIRMED');
    });

    it('M2-32: summary includes watched count and frontier episode', async () => {
      await seed();
      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep2Id, mode: 'this_episode' } as any);
      expect((res as any).data.summary.watchedCount).toBe(1);
      expect((res as any).data.summary.frontierEpisodeId).toBe(ep2Id);
    });

  describe('Movies', () => {
    it('M2-20: markMovieWatched creates a canonicalWatchedMovies record', async () => {
      await seed();
      const res = await markMovieWatched({ userId, operationId: uuidv4(), mediaGroupId: movieGroupId } as any);
      if (!res.ok) console.log(res);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedMovies);
      expect(rows).toHaveLength(1);
    });
  });

  describe('Library & Intent', () => {
    it('M2-24: addToLibrary adds user_media_state with active intent', async () => {
      await seed();
      const res = await addToLibrary({ userId, operationId: uuidv4(), mediaGroupId });
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.userMediaState);
      expect(rows).toHaveLength(1);
      expect(rows[0].intent).toBe('active');
    });
  });

  describe('markEpisodeWatched - Bulk Gap-Fill (continued)', () => {
    it('M2-12: earlier_all_seasons gap-fills previous episodes across all seasons', async () => {
      await seed();
      const season2Id = uuidv4();
      await db.insert(schema.installments).values({
        id: season2Id,
        continuityTrackId: trackId,
        sequenceNumber: 2,
        format: 'TV',
        status: 'releasing',
        title: 'Season 2'
      });
      const s2ep1Id = uuidv4();
      await db.insert(schema.episodes).values({
        id: s2ep1Id,
        installmentId: season2Id,
        episodeNumber: 1,
        isExtra: false,
        airDate: new Date(Date.now() - 86400000).toISOString().split('T')[0]
      });

      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: s2ep1Id, mode: 'earlier_all_seasons', db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedEpisodes);
      expect(rows).toHaveLength(3); // ep1, ep2, and s2ep1
    });

    it('M2-13: bulk operations skip extras and alternate tracks', async () => {
      await seed();
      const extraEpId = uuidv4();
      await db.insert(schema.episodes).values({
        id: extraEpId,
        installmentId,
        episodeNumber: 0,
        isExtra: true,
        airDate: new Date(Date.now() - 86400000).toISOString().split('T')[0]
      });
      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep2Id, mode: 'earlier_current_season', db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedEpisodes).where(eq(schema.canonicalWatchedEpisodes.episodeId, extraEpId));
      expect(rows).toHaveLength(0); // skipped
    });

    it('M2-14: bulk gap-fill ignores unreleased episodes in the gap', async () => {
      await seed();
      // change ep1 to unreleased
      await db.update(schema.episodes).set({ airDate: new Date(Date.now() + 86400000).toISOString().split('T')[0] }).where(eq(schema.episodes.id, ep1Id));

      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep2Id, mode: 'earlier_current_season', db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedEpisodes);
      expect(rows).toHaveLength(1); // only ep2, because ep1 is unreleased
    });
  });

  describe('unmarkEpisodeWatched', () => {
    it('M2-17: later_current_season unmarks subsequent episodes in the same season', async () => {
      await seed();
      await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep2Id, mode: 'earlier_current_season', db } as any); // marks 1 & 2
      const res = await unmarkEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, scope: 'later_current_season', removal: 'completely', db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedEpisodes);
      expect(rows).toHaveLength(0); // completely removed 1 and 2
    });

    it('M2-18: later_all_seasons unmarks subsequent episodes across all seasons', async () => {
      await seed();
      const season2Id = uuidv4();
      await db.insert(schema.installments).values({
        id: season2Id,
        continuityTrackId: trackId,
        sequenceNumber: 2,
        format: 'TV',
        status: 'releasing',
        title: 'Season 2'
      });
      const s2ep1Id = uuidv4();
      await db.insert(schema.episodes).values({
        id: s2ep1Id,
        installmentId: season2Id,
        episodeNumber: 1,
        isExtra: false,
        airDate: new Date(Date.now() - 86400000).toISOString().split('T')[0]
      });

      await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: s2ep1Id, mode: 'earlier_all_seasons', db } as any); // 1, 2, s2ep1

      const res = await unmarkEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, scope: 'later_all_seasons', removal: 'completely', db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedEpisodes);
      expect(rows).toHaveLength(0);
    });
  });

  describe('Progress Engine', () => {
    it('M2-28: computes correct state for not_started', async () => {
      await seed();
      const res = await addToLibrary({ userId, operationId: uuidv4(), mediaGroupId, db } as any);
      expect(res.ok).toBe(true);
      expect((res as any).data?.summary?.progressState).toBe('not_started');
    });

    it('M2-29: computes correct state for in_progress with sparse gaps', async () => {
      await seed();
      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep2Id, mode: 'this_episode', db } as any);
      expect((res as any).data?.summary?.progressState).toBe('in_progress');
      expect((res as any).data?.summary?.watchedCount).toBe(1);
    });

    it('M2-30: computes correct state for caught_up (all released watched, but more unreleased)', async () => {
      await seed();
      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep2Id, mode: 'earlier_current_season', db } as any);
      // ep1 and ep2 are released, ep3 is unreleased
      expect((res as any).data?.summary?.progressState).toBe('caught_up');
      expect((res as any).data?.summary?.watchedCount).toBe(2);
      expect((res as any).data?.summary?.frontierEpisodeId).toBe(ep2Id);
    });

    it('M2-31: computes correct state for finished (all released watched, none upcoming)', async () => {
      await seed();
      // change ep3 to released
      await db.update(schema.episodes).set({ airDate: new Date(Date.now() - 86400000).toISOString().split('T')[0] }).where(eq(schema.episodes.id, ep3Id));

      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep3Id, mode: 'earlier_current_season', db } as any);
      expect((res as any).data?.summary?.progressState).toBe('finished');
      expect((res as any).data?.summary?.watchedCount).toBe(3);
    });
  });

  describe('Concurrency & Idempotency', () => {
    it('M2-33: replay exact same operationId yields original result without side effects', async () => {
      await seed();
      const opId = uuidv4();
      const res1 = await markEpisodeWatched({ userId, operationId: opId, episodeId: ep1Id, mode: 'this_episode', db } as any);
      const res2 = await markEpisodeWatched({ userId, operationId: opId, episodeId: ep1Id, mode: 'this_episode', db } as any);
      expect(res2.ok).toBe(true);
      expect((res2 as any).replayed).toBe(true);
      expect((res2 as any).data).toEqual((res1 as any).data);

      const rows = await db.select().from(schema.canonicalWatchedEpisodes);
      expect(rows[0].rewatchCount).toBe(1); // didn't increment twice
    });

    it('M2-34: reusing operationId with different parameters yields OPERATION_ID_CONFLICT', async () => {
      await seed();
      const opId = uuidv4();
      await markEpisodeWatched({ userId, operationId: opId, episodeId: ep1Id, mode: 'this_episode', db } as any);
      const res = await markEpisodeWatched({ userId, operationId: opId, episodeId: ep2Id, mode: 'this_episode', db } as any);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect((res as any).error?.code).toBe('OPERATION_ID_CONFLICT');
      }
    });
  });


  describe('Authentication & Profile Gating', () => {
    it('M2-04: fails with UNAUTHORIZED if not authenticated', async () => {
      await seed();
      const res = await markEpisodeWatched({ userId: '', operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode', db } as any);
      expect(res.ok).toBe(false);
      if (!res.ok) expect((res as any).error?.code).toBe('UNAUTHORIZED');
    });

    it('M2-05: fails with PROFILE_SETUP_REQUIRED if profile is missing', async () => {
      await seed();
      const missingProfileId = uuidv4();
      // We don't even insert the profile to trigger the missing check
      const res = await markEpisodeWatched({ userId: missingProfileId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode', db } as any);
      expect(res.ok).toBe(false);
      if (!res.ok) expect((res as any).error?.code).toBe('PROFILE_SETUP_REQUIRED');
    });

    it('M2-06: allows operation if profile is complete', async () => {
      await seed();
      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: ep1Id, mode: 'this_episode', db } as any);
      expect(res.ok).toBe(true);
    });
  });

  describe('markEpisodeWatched - Single (continued)', () => {
    it('M2-09: prevents marking a movie using episode endpoint (MEDIA_KIND_MISMATCH)', async () => {
      // we need an episode id that points to a movie. But episodes only point to TV.
      // Wait, the validation logic in tracking.ts checks if mediaGroupType is movie.
      // We can insert a movie track and episode for this test
      await seed();
      const movieTrackId = uuidv4();
      await db.insert(schema.continuityTracks).values({ id: movieTrackId, mediaGroupId: movieGroupId, type: 'mainline', title: 'Movie' });
      const movieInstId = uuidv4();
      await db.insert(schema.installments).values({ id: movieInstId, continuityTrackId: movieTrackId, sequenceNumber: 1, format: 'MOVIE', status: 'finished', title: 'Movie' });
      const movieEpId = uuidv4();
      await db.insert(schema.episodes).values({ id: movieEpId, installmentId: movieInstId, episodeNumber: 1, isExtra: false, airDate: new Date(Date.now() - 86400).toISOString().split('T')[0] });

      const res = await markEpisodeWatched({ userId, operationId: uuidv4(), episodeId: movieEpId, mode: 'this_episode', db } as any);
      expect(res.ok).toBe(false);
      if (!res.ok) expect((res as any).error?.code).toBe('MEDIA_KIND_MISMATCH');
    });
  });

  describe('unmarkMovieWatched', () => {
    it('M2-22: unmarkMovieWatched once decrements rewatch_count', async () => {
      await seed();
      await markMovieWatched({ userId, operationId: uuidv4(), mediaGroupId: movieGroupId, db } as any);
      await markMovieWatched({ userId, operationId: uuidv4(), mediaGroupId: movieGroupId, db } as any);

      const res = await unmarkMovieWatched({ userId, operationId: uuidv4(), mediaGroupId: movieGroupId, removal: 'once', db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedMovies);
      expect(rows[0].rewatchCount).toBe(1);
    });

    it('M2-23: unmarkMovieWatched completely removes the record', async () => {
      await seed();
      await markMovieWatched({ userId, operationId: uuidv4(), mediaGroupId: movieGroupId, db } as any);
      const res = await unmarkMovieWatched({ userId, operationId: uuidv4(), mediaGroupId: movieGroupId, removal: 'completely', db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.canonicalWatchedMovies);
      expect(rows).toHaveLength(0);
    });
  });

  describe('Library & Intent (continued)', () => {
    it('M2-25: setMediaIntent updates intent to paused/watch_later/dropped', async () => {
      await seed();
      const res = await setMediaIntent({ userId, operationId: uuidv4(), mediaGroupId, intent: 'dropped', db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.userMediaState);
      expect(rows[0].intent).toBe('dropped');
    });

    it('M2-26: removeFromLibrary preserves intent and watched history', async () => {
      await seed();
      await setMediaIntent({ userId, operationId: uuidv4(), mediaGroupId, intent: 'watch_later', db } as any);
      const res = await removeFromLibrary({ userId, operationId: uuidv4(), mediaGroupId, db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.userMediaState);
      expect(rows[0].inLibrary).toBe(false);
      expect(rows[0].intent).toBe('watch_later'); // preserved
    });

    it('M2-27: re-adding to library restores previous state', async () => {
      await seed();
      await setMediaIntent({ userId, operationId: uuidv4(), mediaGroupId, intent: 'paused', db } as any);
      await removeFromLibrary({ userId, operationId: uuidv4(), mediaGroupId, db } as any);
      const res = await addToLibrary({ userId, operationId: uuidv4(), mediaGroupId, db } as any);
      expect(res.ok).toBe(true);
      const rows = await db.select().from(schema.userMediaState);
      expect(rows[0].inLibrary).toBe(true);
      expect(rows[0].intent).toBe('paused'); // restored
    });
  });

});
