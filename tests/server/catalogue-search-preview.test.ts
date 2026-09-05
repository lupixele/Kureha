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
import { eq } from 'drizzle-orm';
import { searchCatalogue, getCanonicalMediaDetails } from '../../src/server/catalogue/search';
import { previewProviderTitle } from '../../src/server/catalogue/preview';

describe('Catalogue Search & Preview Headless Backend (PGlite)', () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    pg = new PGlite();
    db = drizzle(pg, { schema });
    testDb = db;

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
    await pg.exec('TRUNCATE media_groups, continuity_tracks, installments, episodes, provider_mappings CASCADE;');
  });

  afterAll(async () => {
    await pg.close();
  });

  it('searches providers concurrently and cross-references existing Kureha media groups', async () => {
    // Seed existing media group with active provider mapping
    const [group] = await db
      .insert(schema.mediaGroups)
      .values({
        title: 'Frieren',
        type: 'anime',
        releaseState: 'ended',
      })
      .returning();

    await db.insert(schema.providerMappings).values({
      mediaGroupId: group.id,
      provider: 'anilist',
      targetType: 'anime',
      providerId: '154587',
    });

    const mockAniList = {
      search: vi.fn().mockResolvedValue({
        items: [
          { providerId: '154587', title: 'Sousou no Frieren', format: 'TV', year: 2023, posterUrl: 'https://img.invalid/frieren.jpg' },
        ],
      }),
    };

    const mockTmdb = {
      search: vi.fn().mockResolvedValue({
        items: [
          { providerId: '12345', title: 'Frieren Movie', year: 2024, posterUrl: 'https://img.invalid/movie.jpg' },
        ],
      }),
    };

    const res = await searchCatalogue(
      { query: 'Frieren' },
      { db, aniListClient: mockAniList, tmdbClient: mockTmdb }
    );

    expect(res.partial).toBe(false);
    expect(res.items).toHaveLength(2);

    // Existing group ID resolved on AniList item
    const anilistItem = res.items.find((i) => i.provider === 'anilist');
    expect(anilistItem?.existingMediaGroupId).toBe(group.id);

    // Unmapped TMDB item has no existingMediaGroupId
    const tmdbItem = res.items.find((i) => i.provider === 'tmdb');
    expect(tmdbItem?.existingMediaGroupId).toBeUndefined();
  });

  it('marks search partial if one provider fails without throwing an error', async () => {
    const mockAniList = {
      search: vi.fn().mockRejectedValue(new Error('Network outage')),
    };

    const mockTmdb = {
      search: vi.fn().mockResolvedValue({
        items: [
          { providerId: '999', title: 'Surviving Movie', year: 2022 },
        ],
      }),
    };

    const res = await searchCatalogue(
      { query: 'Surviving' },
      { db, aniListClient: mockAniList, tmdbClient: mockTmdb }
    );

    expect(res.partial).toBe(true);
    expect(res.unavailableProviders).toContain('anilist');
    expect(res.items).toHaveLength(1);
    expect(res.items[0].title).toBe('Surviving Movie');
  });

  it('provides safe read-only preview without creating canonical database rows', async () => {
    const mockAniList = {
      details: vi.fn().mockResolvedValue({
        installment: {
          source: 'anilist',
          providerId: '888',
          title: 'Preview Anime',
          format: 'TV',
          status: 'finished',
          totalEpisodes: 24,
          startDate: '2022-01-01',
          endDate: '2022-06-30',
          nextAiringEpisode: null,
          nextAiringTime: null,
          payloadHash: 'hash-preview',
        },
        relations: [],
        artwork: [],
        drift: [],
      }),
    };

    const preview = await previewProviderTitle(
      { provider: 'anilist', providerId: '888' },
      { aniListClient: mockAniList }
    );

    expect(preview.provider).toBe('anilist');
    expect(preview.installment.title).toBe('Preview Anime');

    // Confirm ZERO database records were created
    const groups = await db.select().from(schema.mediaGroups);
    expect(groups).toHaveLength(0);
  });

  it('loads canonical media details with continuity tracks, installments, and episodes', async () => {
    const [group] = await db
      .insert(schema.mediaGroups)
      .values({
        title: 'Full Franchise',
        type: 'anime',
        releaseState: 'ended',
      })
      .returning();

    const [track] = await db
      .insert(schema.continuityTracks)
      .values({
        mediaGroupId: group.id,
        type: 'mainline',
        title: 'Mainline',
      })
      .returning();

    const [inst] = await db
      .insert(schema.installments)
      .values({
        continuityTrackId: track.id,
        sequenceNumber: 1,
        title: 'Season 1',
        format: 'TV',
        status: 'finished',
      })
      .returning();

    await pg.exec(`
      INSERT INTO episodes (installment_id, episode_number, title)
      VALUES ('${inst.id}', 1, 'Episode 1');
    `);

    const details = await getCanonicalMediaDetails(group.id, db);
    expect(details.mediaGroup.title).toBe('Full Franchise');
    expect(details.continuityTracks).toHaveLength(1);
    expect(details.installments).toHaveLength(1);
    expect(details.episodes).toHaveLength(1);
    expect(details.episodes[0].title).toBe('Episode 1');
  });
});
