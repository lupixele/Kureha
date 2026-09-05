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
import { eq, and } from 'drizzle-orm';
import {
  listCatalogueReviewItems,
  resolveCatalogueReviewItem,
  activateMappingVersion,
  rollbackMappingVersion,
} from '../../src/server/catalogue/review';
import {
  queueRefresh,
  claimNextRefreshJob,
  completeRefreshJob,
} from '../../src/server/catalogue/refresh';
import {
  setArtworkPreference,
  clearArtworkPreference,
  getArtworkCandidates,
} from '../../src/server/catalogue/artwork';

describe('Blockers 3, 5, 7, 9 & 10: Review, Refresh, and Artwork (PGlite)', () => {
  let pg: PGlite;
  let db: ReturnType<typeof drizzle>;

  const maintainerId = '11111111-0000-4000-8000-000000000001';
  const normalUserId = '22222222-0000-4000-8000-000000000002';
  const testGroupId = '33333333-0000-4000-8000-000000000003';

  beforeAll(async () => {
    vi.stubEnv('KUREHA_MAINTAINER_USER_IDS', maintainerId);

    pg = new PGlite();
    db = drizzle(pg, { schema });
    testDb = db;

    // Apply migrations 0000..0003
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
    await pg.exec('TRUNCATE profiles, media_groups, catalogue_review_items, metadata_refresh_jobs, artwork_assets, user_artwork_preferences CASCADE;');

    // Seed profiles
    await pg.exec(`
      INSERT INTO profiles (id, username, display_name, visibility)
      VALUES
        ('${maintainerId}', 'maintainer', 'Maintainer One', 'private'),
        ('${normalUserId}', 'normaluser', 'Normal User', 'private');
    `);

    // Seed media group
    await db.insert(schema.mediaGroups).values({
      id: testGroupId,
      title: 'Review Test Title',
      type: 'anime',
      releaseState: 'airing',
    });
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await pg.close();
  });

  describe('Blocker 3: Maintainer Authorization & Review Resolution', () => {
    it('denies list, resolve, activate, and rollback to non-maintainers by default', async () => {
      await expect(
        listCatalogueReviewItems({ userId: normalUserId }, db)
      ).rejects.toMatchObject({ code: 'FORBIDDEN_REVIEW_ACTION' });

      await expect(
        resolveCatalogueReviewItem(
          {
            userId: normalUserId,
            reviewItemId: '44444444-0000-4000-8000-000000000004',
            resolution: 'resolved',
          },
          db
        )
      ).rejects.toMatchObject({ code: 'FORBIDDEN_REVIEW_ACTION' });

      await expect(
        activateMappingVersion(
          {
            userId: normalUserId,
            mappingVersionId: '55555555-0000-4000-8000-000000000005',
          },
          db
        )
      ).rejects.toMatchObject({ code: 'FORBIDDEN_REVIEW_ACTION' });

      await expect(
        rollbackMappingVersion(
          {
            userId: normalUserId,
            mediaGroupId: testGroupId,
            targetVersionNumber: 1,
          },
          db
        )
      ).rejects.toMatchObject({ code: 'FORBIDDEN_REVIEW_ACTION' });
    });

    it('allows maintainer to list and resolve catalogue review items', async () => {
      // Seed pending review item
      const [item] = await db
        .insert(schema.catalogueReviewItems)
        .values({
          mediaGroupId: testGroupId,
          subjectProvider: 'anilist',
          subjectProviderId: '100',
          reason: 'ambiguous_branch',
          status: 'pending',
          evidence: { reason: 'test ambiguous branch' },
        })
        .returning();

      // List as maintainer
      const list = await listCatalogueReviewItems({ userId: maintainerId, status: 'pending' }, db);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(item.id);

      // Resolve as maintainer
      const resolved = await resolveCatalogueReviewItem(
        {
          userId: maintainerId,
          reviewItemId: item.id,
          resolution: 'resolved',
          notes: 'Manually verified as standalone spin-off',
        },
        db
      );

      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedBy).toBe(maintainerId);
      expect(resolved.resolvedAt).toBeDefined();

      const updated = await db.select().from(schema.catalogueReviewItems).where(eq(schema.catalogueReviewItems.id, item.id));
      expect(updated[0].status).toBe('resolved');
    });

    it('activates and rolls back mapping versions safely under transaction', async () => {
      // Seed version 1 and 2
      const [v1] = await db
        .insert(schema.mappingVersions)
        .values({
          mediaGroupId: testGroupId,
          versionNumber: 1,
          status: 'active',
        })
        .returning();

      const [v2] = await db
        .insert(schema.mappingVersions)
        .values({
          mediaGroupId: testGroupId,
          versionNumber: 2,
          status: 'draft',
        })
        .returning();

      // Activate v2
      await activateMappingVersion({ userId: maintainerId, mappingVersionId: v2.id }, db);

      const checkV1 = await db.select().from(schema.mappingVersions).where(eq(schema.mappingVersions.id, v1.id));
      const checkV2 = await db.select().from(schema.mappingVersions).where(eq(schema.mappingVersions.id, v2.id));
      expect(checkV1[0].status).toBe('superseded');
      expect(checkV2[0].status).toBe('active');

      // Rollback to v1
      await rollbackMappingVersion({ userId: maintainerId, mediaGroupId: testGroupId, targetVersionNumber: 1 }, db);

      const checkV1Rollback = await db.select().from(schema.mappingVersions).where(eq(schema.mappingVersions.id, v1.id));
      const checkV2Rollback = await db.select().from(schema.mappingVersions).where(eq(schema.mappingVersions.id, v2.id));
      expect(checkV1Rollback[0].status).toBe('active');
      expect(checkV2Rollback[0].status).toBe('superseded');
    });
  });

  describe('Blockers 5 & 7: Refresh Job Transitions & Idempotent Queueing', () => {
    it('queues refresh jobs idempotently without duplicate records', async () => {
      const job1 = await queueRefresh(
        {
          provider: 'anilist',
          targetType: 'anime',
          targetId: '500',
          jobKind: 'metadata',
          mediaGroupId: testGroupId,
          priority: 'interactive',
        },
        db
      );

      const job2 = await queueRefresh(
        {
          provider: 'anilist',
          targetType: 'anime',
          targetId: '500',
          jobKind: 'metadata',
          mediaGroupId: testGroupId,
          priority: 'interactive',
        },
        db
      );

      expect(job1.id).toBe(job2.id);

      const allJobs = await db.select().from(schema.metadataRefreshJobs);
      expect(allJobs).toHaveLength(1);
    });

    it('claims next job with lease and transitions status through valid lifecycle', async () => {
      const queuedJob = await queueRefresh(
        {
          provider: 'anilist',
          targetType: 'anime',
          targetId: '600',
          jobKind: 'metadata',
          priority: 'interactive',
          nextAttemptAt: new Date(Date.now() - 1000), // ready now
        },
        db
      );

      // Claim job
      const claimed = await claimNextRefreshJob('worker-A', 5000, db);
      expect(claimed).toBeDefined();
      expect(claimed?.id).toBe(queuedJob.id);
      expect(claimed?.status).toBe('running');
      expect(claimed?.leaseOwner).toBe('worker-A');
      expect(claimed?.attempts).toBe(1);

      // Complete job with failure -> retry_wait
      const failed = await completeRefreshJob(
        claimed!.id,
        'worker-A',
        false,
        { code: 'RATE_LIMITED', message: 'AniList 429' },
        db
      );

      expect(failed?.status).toBe('retry_wait');
      expect(failed?.errorCode).toBe('RATE_LIMITED');
      expect(failed?.leaseOwner).toBeNull();

      // Complete job with success -> succeeded
      const succeeded = await completeRefreshJob(claimed!.id, 'worker-A', true, undefined, db);
      expect(succeeded?.status).toBe('succeeded');
      expect(succeeded?.errorCode).toBeNull();
      expect(succeeded?.lastSucceededAt).toBeDefined();
    });
  });

  describe('Blockers 9 & 10: Artwork Preferences & Authorization', () => {
    it('enforces completed profile and eligible asset constraints for artwork preferences', async () => {
      // Seed eligible artwork asset
      const [coverAsset] = await db
        .insert(schema.artworkAssets)
        .values({
          mediaGroupId: testGroupId,
          provider: 'anilist',
          kind: 'cover',
          providerAssetId: 'c999',
          url: 'https://images.invalid/cover.jpg',
          payloadHash: 'hash-cover',
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
          isAvailable: true,
        })
        .returning();

      // Non-existent user fails
      await expect(
        setArtworkPreference(
          {
            userId: '00000000-0000-4000-8000-999999999999',
            mediaGroupId: testGroupId,
            kind: 'cover',
            assetId: coverAsset.id,
          },
          db
        )
      ).rejects.toMatchObject({ code: 'PROFILE_SETUP_REQUIRED' });

      // Ineligible asset kind mismatch
      await expect(
        setArtworkPreference(
          {
            userId: normalUserId,
            mediaGroupId: testGroupId,
            kind: 'title_logo', // Mismatch with 'cover' asset
            assetId: coverAsset.id,
          },
          db
        )
      ).rejects.toMatchObject({ code: 'ARTWORK_NOT_ELIGIBLE' });

      // Valid preference set
      const pref = await setArtworkPreference(
        {
          userId: normalUserId,
          mediaGroupId: testGroupId,
          kind: 'cover',
          assetId: coverAsset.id,
        },
        db
      );

      expect(pref.coverAssetId).toBe(coverAsset.id);

      // Verify candidates and user preference query
      const result = await getArtworkCandidates(testGroupId, normalUserId, db);
      expect(result.candidates).toHaveLength(1);
      expect(result.userPreference?.coverAssetId).toBe(coverAsset.id);

      // Clear preference
      const cleared = await clearArtworkPreference(
        {
          userId: normalUserId,
          mediaGroupId: testGroupId,
          kind: 'cover',
        },
        db
      );

      expect(cleared.coverAssetId).toBeNull();
    });
  });
});
