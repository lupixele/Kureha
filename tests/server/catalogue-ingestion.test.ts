import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let testDb: any;
vi.mock('../../src/db/client', () => {
  return {
    get db() {
      return testDb;
    },
  };
});

import * as schema from '../../src/db/schema';
import { eq, sql } from 'drizzle-orm';
import { importProviderTitle } from '../../src/server/catalogue/ingestion';
import { AniListClient } from '../../src/server/catalogue/resolver';

describe('Slice M3-C Catalogue Ingestion & Graph Resolution (PGlite)', () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;

  const userId = '00000000-0000-4000-8000-000000000001';

  beforeAll(async () => {
    pg = new PGlite();
    db = drizzle(pg, { schema });
    testDb = db;

    // Apply migrations 0000 to 0003
    for (const file of [
      '0000_great_scarlet_witch.sql',
      '0001_M1_canonical_media_identity.sql',
      '0002_M2_canonical_tracking.sql',
      '0003_M3_metadata_providers.sql',
    ]) {
      const sql = readFileSync(resolve(process.cwd(), 'drizzle', file), 'utf8');
      await pg.exec(sql);
    }
  });

  beforeEach(async () => {
    // Reset data
    await pg.exec('TRUNCATE profiles, media_groups, tracking_operations CASCADE;');

    // Seed profile using raw sql to avoid Drizzle insert inference quirk on id
    await pg.exec(`
      INSERT INTO profiles (id, username, display_name, visibility)
      VALUES ('${userId}', 'tester', 'Test User', 'private');
    `);
  });

  afterAll(async () => {
    await pg.close();
  });

  it('imports linear anime graph (prequel -> S1 -> sequel) into a single media group with ordered installments and initial mapping version', async () => {
    // Mock AniList graph: S1 (id: 100), Prequel (id: 99), Sequel (id: 101)
    const mockClient: AniListClient = {
      async details(id: string) {
        if (id === '100') {
          return {
            installment: { source: 'anilist', providerId: '100', title: 'Season 1', format: 'TV', status: 'finished', totalEpisodes: 12, startDate: '2020-01-01', endDate: '2020-03-31', nextAiringEpisode: null, nextAiringTime: null, payloadHash: 'hash100' },
            relations: [
              { sourceProviderId: '100', relationType: 'PREQUEL', targetProviderId: '99', targetFormat: 'TV', targetIsAdult: false },
              { sourceProviderId: '100', relationType: 'SEQUEL', targetProviderId: '101', targetFormat: 'TV', targetIsAdult: false },
            ],
            artwork: [{ provider: 'anilist', kind: 'cover', providerAssetId: 'c100', urlOrPath: 'https://art.invalid/c100.jpg', payloadHash: 'h100', language: null, voteScore: null, width: null, height: null, sourceMappingId: null }],
            drift: [],
            payloadHash: 'hash100',
          };
        } else if (id === '99') {
          return {
            installment: { source: 'anilist', providerId: '99', title: 'Prequel OVA', format: 'TV', status: 'finished', totalEpisodes: 1, startDate: '2019-01-01', endDate: '2019-03-31', nextAiringEpisode: null, nextAiringTime: null, payloadHash: 'hash99' },
            relations: [
              { sourceProviderId: '99', relationType: 'SEQUEL', targetProviderId: '100', targetFormat: 'TV', targetIsAdult: false },
            ],
            artwork: [],
            drift: [],
            payloadHash: 'hash99',
          };
        } else if (id === '101') {
          return {
            installment: { source: 'anilist', providerId: '101', title: 'Season 2', format: 'TV', status: 'finished', totalEpisodes: 12, startDate: '2021-01-01', endDate: '2021-03-31', nextAiringEpisode: null, nextAiringTime: null, payloadHash: 'hash101' },
            relations: [
              { sourceProviderId: '101', relationType: 'PREQUEL', targetProviderId: '100', targetFormat: 'TV', targetIsAdult: false },
            ],
            artwork: [],
            drift: [],
            payloadHash: 'hash101',
          };
        }
        throw new Error('Not found');
      },
    };

    const res = await importProviderTitle(
      {
        provider: 'anilist',
        providerId: '100',
        operationId: '11111111-1111-4000-8000-111111111111',
        userId,
      },
      { db, aniListClient: mockClient }
    );

    expect(res.ok).toBe(true);
    expect(res.created).toBe(true);
    expect(res.mediaGroupId).toBeDefined();

    // Verify media group
    const groups = await db.select().from(schema.mediaGroups).where(eq(schema.mediaGroups.id, res.mediaGroupId));
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Season 1');

    // Verify mainline track
    const tracks = await db.select().from(schema.continuityTracks).where(eq(schema.continuityTracks.mediaGroupId, res.mediaGroupId));
    expect(tracks).toHaveLength(1);
    expect(tracks[0].type).toBe('mainline');

    // Verify installments ordered: 99 (Prequel), 100 (S1), 101 (S2)
    const insts = await db.select().from(schema.installments).where(eq(schema.installments.continuityTrackId, tracks[0].id));
    expect(insts).toHaveLength(3);
    expect(insts.map((i) => i.sequenceNumber)).toEqual([1, 2, 3]);
    expect(insts.map((i) => i.title)).toEqual(['Prequel OVA', 'Season 1', 'Season 2']);

    // Verify initial mapping version (Blocker 2)
    const versions = await db.select().from(schema.mappingVersions).where(eq(schema.mappingVersions.mediaGroupId, res.mediaGroupId));
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].status).toBe('active');

    // Verify mapping entries created for installments & episodes
    const entries = await db.select().from(schema.mappingVersionEntries).where(eq(schema.mappingVersionEntries.mappingVersionId, versions[0].id));
    expect(entries.length).toBeGreaterThanOrEqual(3);

    const installmentMappings = await db
      .select()
      .from(schema.providerMappings)
      .where(sql`${schema.providerMappings.installmentId} IN (${sql.join(insts.map(i => sql`${i.id}`), sql`, `)})`);
    expect(installmentMappings).toHaveLength(3);
    expect(installmentMappings.map((m) => m.providerId).sort()).toEqual(['100', '101', '99']);

    // Verify refresh job created
    const jobs = await db
      .select()
      .from(schema.metadataRefreshJobs)
      .where(eq(schema.metadataRefreshJobs.mediaGroupId, res.mediaGroupId));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('queued');
  });

  it('rejects import if user profile is missing or not setup', async () => {
    const unauthUserId = '00000000-0000-4000-8000-999999999999';
    await expect(
      importProviderTitle(
        {
          provider: 'anilist',
          providerId: '100',
          operationId: '22222222-2222-4000-8000-222222222222',
          userId: unauthUserId,
        },
        { db }
      )
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('creates catalogue review item when ambiguous relation branch is detected', async () => {
    const mockClient: AniListClient = {
      async details(id: string) {
        return {
          installment: { source: 'anilist', providerId: '200', title: 'Branching Anime', format: 'TV', status: 'finished', totalEpisodes: 12, startDate: null, endDate: null, nextAiringEpisode: null, nextAiringTime: null, payloadHash: 'hash200' },
          relations: [
            // Ambiguous branch: two sequels
            { sourceProviderId: '200', relationType: 'SEQUEL', targetProviderId: '201', targetFormat: 'TV', targetIsAdult: false },
            { sourceProviderId: '200', relationType: 'SEQUEL', targetProviderId: '202', targetFormat: 'TV', targetIsAdult: false },
          ],
          artwork: [],
          drift: [],
          payloadHash: 'hash200',
        };
      },
    };

    const res = await importProviderTitle(
      {
        provider: 'anilist',
        providerId: '200',
        operationId: '33333333-3333-4000-8000-333333333333',
        userId,
      },
      { db, aniListClient: mockClient }
    );

    expect(res.ok).toBe(true);
    expect(res.reviewItemId).toBeDefined();

    // Verify catalogue review item
    const reviewItems = await db.select().from(schema.catalogueReviewItems).where(eq(schema.catalogueReviewItems.id, res.reviewItemId!));
    expect(reviewItems).toHaveLength(1);
    expect(reviewItems[0].status).toBe('pending');
    expect(reviewItems[0].reason).toBe('ambiguous_branch');
  });

  it('returns existing group idempotently on repeated import of the same provider title', async () => {
    const mockClient: AniListClient = {
      async details() {
        return {
          installment: { source: 'anilist', providerId: '300', title: 'Solo Anime', format: 'TV', status: 'finished', totalEpisodes: 12, startDate: null, endDate: null, nextAiringEpisode: null, nextAiringTime: null, payloadHash: 'hash300' },
          relations: [],
          artwork: [],
          drift: [],
          payloadHash: 'hash300',
        };
      },
    };

    // First import
    const res1 = await importProviderTitle(
      {
        provider: 'anilist',
        providerId: '300',
        operationId: '44444444-4444-4000-8000-444444444444',
        userId,
      },
      { db, aniListClient: mockClient }
    );
    expect(res1.created).toBe(true);

    // Second import with new operationId but same providerId
    const res2 = await importProviderTitle(
      {
        provider: 'anilist',
        providerId: '300',
        operationId: '55555555-5555-4000-8000-555555555555',
        userId,
      },
      { db, aniListClient: mockClient }
    );
    expect(res2.created).toBe(false);
    expect(res2.mediaGroupId).toBe(res1.mediaGroupId);

    // Third import with identical operationId (idempotent receipt)
    const res3 = await importProviderTitle(
      {
        provider: 'anilist',
        providerId: '300',
        operationId: '44444444-4444-4000-8000-444444444444',
        userId,
      },
      { db, aniListClient: mockClient }
    );
    expect(res3.created).toBe(false);
    expect(res3.mediaGroupId).toBe(res1.mediaGroupId);
  });
});
