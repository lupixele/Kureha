import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as schema from '../../src/db/schema';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import fs from 'fs';
import path from 'path';

async function expectThrows(promise: Promise<any>, errorRegex: RegExp) {
  try {
    await promise;
    expect.fail('Expected promise to throw');
  } catch (e: any) {
    const msg = e.cause ? (e.cause.message || e.cause.toString()) : (e.message || e.toString());
    expect(msg).toMatch(errorRegex);
  }
}

describe('M1 Canonical Media Identity Schema - PGlite Integration', () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    pg = new PGlite();
    db = drizzle(pg, { schema });

    // Read and execute migrations
    const migration0000 = fs.readFileSync(path.join(__dirname, '../../drizzle/0000_great_scarlet_witch.sql'), 'utf8');

    // Find generated 0001 migration
    const drizzleDir = path.join(__dirname, '../../drizzle');
    const files = fs.readdirSync(drizzleDir);
    const migration0001File = files.find(f => f.startsWith('0001_') && f.endsWith('.sql'));
    if (!migration0001File) {
      throw new Error('Could not find 0001 migration file');
    }
    const migration0001 = fs.readFileSync(path.join(drizzleDir, migration0001File), 'utf8');

    await pg.exec(migration0000);
    await pg.exec(migration0001);
  });

  afterAll(async () => {
    await pg.close();
  });

  it('verifies valid creation order and baseline inserts', async () => {
    const profileId = '11111111-1111-1111-1111-111111111111';
    await db.insert(schema.profiles).values({
      id: profileId,
      username: 'test_user',
      displayName: 'Test User'
    });

    const profilesResult = await db.select().from(schema.profiles);
    expect(profilesResult).toHaveLength(1);
    expect(profilesResult[0].visibility).toBe('private');

    const mediaGroupId = '22222222-2222-2222-2222-222222222222';
    await db.insert(schema.mediaGroups).values({
      id: mediaGroupId,
      title: 'Attack on Titan',
      type: 'anime',
      releaseState: 'ended'
    });

    const trackId = '33333333-3333-3333-3333-333333333333';
    await db.insert(schema.continuityTracks).values({
      id: trackId,
      mediaGroupId: mediaGroupId,
      type: 'mainline',
      isCanonical: true
    });

    const installmentId = '44444444-4444-4444-4444-444444444444';
    await db.insert(schema.installments).values({
      id: installmentId,
      continuityTrackId: trackId,
      sequenceNumber: 1,
      title: 'Season 1',
      format: 'TV',
      status: 'finished',
      startDate: '2013-04-07',
      endDate: '2013-09-29',
      totalEpisodes: 25
    });

    const episodeId = '55555555-5555-5555-5555-555555555555';
    await db.insert(schema.episodes).values({
      id: episodeId,
      installmentId: installmentId,
      episodeNumber: 1,
      title: 'To You, in 2000 Years',
      runtimeMinutes: 24,
      airDate: '2013-04-07'
    });

    const episodesResult = await db.select().from(schema.episodes);
    expect(episodesResult).toHaveLength(1);
  });

  it('rejects duplicate canonical mapping per target', async () => {
    const mediaGroupId = '22222222-2222-2222-2222-222222222222';
    const versionId = '66666666-6666-6666-6666-666666666666';

    await db.insert(schema.mappingVersions).values({
      id: versionId,
      mediaGroupId,
      versionNumber: 1,
      status: 'active'
    });

    await db.insert(schema.providerMappings).values({
      mediaGroupId: mediaGroupId,
      provider: 'anilist',
      targetType: 'anime',
      providerId: '16498'
    });

    // Same provider + target media group
    await expectThrows(db.insert(schema.providerMappings).values({
      mediaGroupId: mediaGroupId,
      provider: 'anilist',
      targetType: 'anime',
      providerId: '99999'
    }), /unq_provider_mapping_group/);
  });

  it('enforces one mainline continuity track', async () => {
    const mediaGroupId = '22222222-2222-2222-2222-222222222222';

    await expectThrows(db.insert(schema.continuityTracks).values({
      mediaGroupId: mediaGroupId,
      type: 'mainline',
      isCanonical: true
    }), /continuity_tracks_one_mainline_idx/);

    await expect(db.insert(schema.continuityTracks).values({
      mediaGroupId: mediaGroupId,
      type: 'alternate',
      isCanonical: false
    })).resolves.not.toThrow();
  });

  it('enforces exactly-one-target constraints on provider mappings', async () => {

    await expectThrows(db.insert(schema.providerMappings).values({
      provider: 'anilist',
      targetType: 'anime',
      providerId: '123'
    }), /provider_mapping_single_target/);

    const mediaGroupId = '22222222-2222-2222-2222-222222222222';
    const installmentId = '44444444-4444-4444-4444-444444444444';
    await expectThrows(db.insert(schema.providerMappings).values({
      mediaGroupId,
      installmentId,
      provider: 'anilist',
      targetType: 'anime',
      providerId: '1234'
    }), /provider_mapping_single_target/);
  });

  it('rejects invalid usernames', async () => {
    const tests = [
      { id: 'u1', username: 'a..b', error: /username_format/ },
      { id: 'u2', username: 'admin', error: /username_format/ },
      { id: 'u3', username: 'A', error: /username_format/ },
      { id: 'u4', username: 'system', error: /username_format/ },
    ];

    for (const t of tests) {
      await expectThrows(db.insert(schema.profiles).values({
        id: '12345678-1234-1234-1234-123456789012',
        username: t.username,
        displayName: 'Test'
      }), t.error);
    }
  });

  it('mapping entries coexist across versions', async () => {
    const mediaGroupId = '22222222-2222-2222-2222-222222222222';
    const v1Id = '77777777-7777-7777-7777-777777777777';
    const v2Id = '88888888-8888-8888-8888-888888888888';

    await db.insert(schema.mappingVersions).values({
      id: v1Id,
      mediaGroupId,
      versionNumber: 2,
      status: 'superseded'
    });

    await db.insert(schema.mappingVersions).values({
      id: v2Id,
      mediaGroupId,
      versionNumber: 3,
      status: 'draft'
    });

    await db.insert(schema.mappingVersionEntries).values({
      mappingVersionId: v1Id,
      mediaGroupId,
      provider: 'anilist',
      targetType: 'anime',
      providerId: '987',
      source: 'manual'
    });

    await db.insert(schema.mappingVersionEntries).values({
      mappingVersionId: v2Id,
      mediaGroupId,
      provider: 'anilist',
      targetType: 'anime',
      providerId: '987',
      source: 'manual'
    });

    const entries = await db.select().from(schema.mappingVersionEntries);
    expect(entries.length).toBeGreaterThanOrEqual(2);
  });
});