import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client';
import {
  artworkAssets,
  userArtworkPreferences,
  profiles,
  mediaGroups,
} from '../../db/schema';
import { ProviderError } from '../providers/errors';

export const setArtworkPreferenceSchema = z.object({
  userId: z.string().uuid(),
  mediaGroupId: z.string().uuid(),
  kind: z.enum(['title_logo', 'cover', 'backdrop']),
  assetId: z.string().uuid(),
});

export async function setArtworkPreference(
  input: z.infer<typeof setArtworkPreferenceSchema>,
  db: any = defaultDb
) {
  const { userId, mediaGroupId, kind, assetId } = setArtworkPreferenceSchema.parse(input);

  // 1. Verify profile completed
  const user = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!user || user.length === 0 || !user[0].username) {
    throw new ProviderError('PROFILE_SETUP_REQUIRED' as any, 'anilist');
  }

  // 2. Verify asset belongs to this media group and matches kind
  const asset = await db
    .select()
    .from(artworkAssets)
    .where(and(eq(artworkAssets.id, assetId), eq(artworkAssets.mediaGroupId, mediaGroupId)))
    .limit(1);

  if (!asset || asset.length === 0 || asset[0].kind !== kind || !asset[0].isAvailable) {
    throw new ProviderError('ARTWORK_NOT_ELIGIBLE' as any, 'anilist');
  }

  // 3. Upsert user preference
  const updateData: any = { updatedAt: new Date() };
  if (kind === 'title_logo') updateData.titleLogoAssetId = assetId;
  else if (kind === 'cover') updateData.coverAssetId = assetId;
  else if (kind === 'backdrop') updateData.backdropAssetId = assetId;

  const insertData: any = {
    userId,
    mediaGroupId,
    ...updateData,
  };

  const [pref] = await db
    .insert(userArtworkPreferences)
    .values(insertData)
    .onConflictDoUpdate({
      target: [userArtworkPreferences.userId, userArtworkPreferences.mediaGroupId],
      set: updateData,
    })
    .returning();

  return pref;
}

export const clearArtworkPreferenceSchema = z.object({
  userId: z.string().uuid(),
  mediaGroupId: z.string().uuid(),
  kind: z.enum(['title_logo', 'cover', 'backdrop']),
});

export async function clearArtworkPreference(
  input: z.infer<typeof clearArtworkPreferenceSchema>,
  db: any = defaultDb
) {
  const { userId, mediaGroupId, kind } = clearArtworkPreferenceSchema.parse(input);

  const updateData: any = { updatedAt: new Date() };
  if (kind === 'title_logo') updateData.titleLogoAssetId = null;
  else if (kind === 'cover') updateData.coverAssetId = null;
  else if (kind === 'backdrop') updateData.backdropAssetId = null;

  const [pref] = await db
    .update(userArtworkPreferences)
    .set(updateData)
    .where(
      and(
        eq(userArtworkPreferences.userId, userId),
        eq(userArtworkPreferences.mediaGroupId, mediaGroupId)
      )
    )
    .returning();

  return pref;
}

export async function getArtworkCandidates(
  mediaGroupId: string,
  userId?: string,
  db: any = defaultDb
) {
  const candidates = await db
    .select()
    .from(artworkAssets)
    .where(and(eq(artworkAssets.mediaGroupId, mediaGroupId), eq(artworkAssets.isAvailable, true)));

  let userPreference = null;
  if (userId) {
    const prefs = await db
      .select()
      .from(userArtworkPreferences)
      .where(
        and(
          eq(userArtworkPreferences.userId, userId),
          eq(userArtworkPreferences.mediaGroupId, mediaGroupId)
        )
      )
      .limit(1);
    if (prefs.length > 0) {
      userPreference = prefs[0];
    }
  }

  return {
    candidates,
    userPreference,
  };
}
