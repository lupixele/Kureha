import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client';
import {
  catalogueReviewItems,
  mappingVersions,
  mappingVersionEntries,
  providerMappings,
  mediaGroups,
  profiles,
} from '../../db/schema';
import { ProviderError } from '../providers/errors';

export function isMaintainer(userId: string): boolean {
  if (!userId) return false;
  const maintainers = (process.env.KUREHA_MAINTAINER_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return maintainers.includes(userId);
}

export function assertMaintainer(userId: string) {
  if (!isMaintainer(userId)) {
    throw new ProviderError('FORBIDDEN_REVIEW_ACTION' as any, 'anilist');
  }
}

export const listReviewItemsSchema = z.object({
  status: z.enum(['pending', 'accepted', 'rejected', 'resolved']).optional(),
  userId: z.string().uuid(),
});

export async function listCatalogueReviewItems(
  input: z.infer<typeof listReviewItemsSchema>,
  db: any = defaultDb
) {
  const { status, userId } = listReviewItemsSchema.parse(input);
  assertMaintainer(userId);

  const query = db.select().from(catalogueReviewItems);
  if (status) {
    return await query.where(eq(catalogueReviewItems.status, status));
  }
  return await query;
}

export const resolveReviewItemSchema = z.object({
  reviewItemId: z.string().uuid(),
  resolution: z.enum(['accepted', 'rejected', 'resolved']),
  notes: z.string().optional(),
  userId: z.string().uuid(),
});

export async function resolveCatalogueReviewItem(
  input: z.infer<typeof resolveReviewItemSchema>,
  db: any = defaultDb
) {
  const { reviewItemId, resolution, notes, userId } = resolveReviewItemSchema.parse(input);
  assertMaintainer(userId);

  const existing = await db
    .select()
    .from(catalogueReviewItems)
    .where(eq(catalogueReviewItems.id, reviewItemId))
    .limit(1);

  if (existing.length === 0) {
    throw new ProviderError('INVALID_QUERY', 'anilist');
  }

  const [updated] = await db
    .update(catalogueReviewItems)
    .set({
      status: resolution,
      resolvedAt: new Date(),
      resolvedBy: userId,
      evidence: notes ? { ...(existing[0].evidence as any || {}), resolutionNotes: notes } : existing[0].evidence,
    })
    .where(eq(catalogueReviewItems.id, reviewItemId))
    .returning();

  return updated;
}

export const activateMappingVersionSchema = z.object({
  mappingVersionId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function activateMappingVersion(
  input: z.infer<typeof activateMappingVersionSchema>,
  db: any = defaultDb
) {
  const { mappingVersionId, userId } = activateMappingVersionSchema.parse(input);
  assertMaintainer(userId);

  return await db.transaction(async (tx: any) => {
    const [targetVer] = await tx
      .select()
      .from(mappingVersions)
      .where(eq(mappingVersions.id, mappingVersionId))
      .limit(1);

    if (!targetVer) {
      throw new ProviderError('INVALID_QUERY', 'anilist');
    }

    // 1. Supersede any currently active version for this media group
    await tx
      .update(mappingVersions)
      .set({ status: 'superseded' })
      .where(
        and(
          eq(mappingVersions.mediaGroupId, targetVer.mediaGroupId),
          eq(mappingVersions.status, 'active')
        )
      );

    // 2. Activate the target version
    const [activated] = await tx
      .update(mappingVersions)
      .set({
        status: 'active',
        activatedAt: new Date(),
      })
      .where(eq(mappingVersions.id, mappingVersionId))
      .returning();

    return activated;
  });
}

export const rollbackMappingVersionSchema = z.object({
  mediaGroupId: z.string().uuid(),
  targetVersionNumber: z.number().int().positive(),
  userId: z.string().uuid(),
});

export async function rollbackMappingVersion(
  input: z.infer<typeof rollbackMappingVersionSchema>,
  db: any = defaultDb
) {
  const { mediaGroupId, targetVersionNumber, userId } = rollbackMappingVersionSchema.parse(input);
  assertMaintainer(userId);

  return await db.transaction(async (tx: any) => {
    const [targetVer] = await tx
      .select()
      .from(mappingVersions)
      .where(
        and(
          eq(mappingVersions.mediaGroupId, mediaGroupId),
          eq(mappingVersions.versionNumber, targetVersionNumber)
        )
      )
      .limit(1);

    if (!targetVer) {
      throw new ProviderError('INVALID_QUERY', 'anilist');
    }

    // Supersede current active
    await tx
      .update(mappingVersions)
      .set({ status: 'superseded' })
      .where(
        and(
          eq(mappingVersions.mediaGroupId, mediaGroupId),
          eq(mappingVersions.status, 'active')
        )
      );

    // Reactivate prior target version
    const [reactivated] = await tx
      .update(mappingVersions)
      .set({
        status: 'active',
        activatedAt: new Date(),
      })
      .where(eq(mappingVersions.id, targetVer.id))
      .returning();

    return reactivated;
  });
}
