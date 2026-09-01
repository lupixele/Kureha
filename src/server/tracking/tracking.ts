import { db } from '../../db/client';
import {
  userMediaState,
  canonicalWatchedEpisodes,
  canonicalWatchedMovies,
  trackingOperations,
  mediaGroups,
  episodes,
  installments,
  continuityTracks,
  profiles,
  releaseStateEvidence,
  mappingVersions,
  mappingVersionEntries
} from '../../db/schema';
import { eq, and, sql, inArray, lt, gt, asc, desc, lte } from 'drizzle-orm';
import { MutationResult, TrackingAction, Progress, TrackingSummary } from '../../core/types';
import * as crypto from 'crypto';

export type MarkMode = 'this_episode' | 'earlier_current_season' | 'earlier_all_seasons';
export type UnmarkScope = 'this_episode' | 'later_current_season' | 'later_all_seasons';
export type RemovalChoice = 'once' | 'completely';

async function checkReceiptAndClaim(tx: any, userId: string, operationId: string, action: TrackingAction, requestHash: string): Promise<{ proceed: boolean, replay?: MutationResult, conflict?: MutationResult }> {
  const existingOp = await tx.select().from(trackingOperations).where(
    and(
      eq(trackingOperations.userId, userId),
      eq(trackingOperations.operationId, operationId)
    )
  );

  if (existingOp.length > 0) {
    const op = existingOp[0];
    if (op.requestHash === requestHash && op.result) {
      return { proceed: false, replay: { ok: true, data: op.result as any, replayed: true } };
    }
    return { proceed: false, conflict: { ok: false, error: { code: 'OPERATION_ID_CONFLICT', message: 'Operation ID reused with different parameters' } } };
  }

  await tx.insert(trackingOperations).values({
    userId,
    operationId,
    action,
    requestHash,
  }).onConflictDoNothing();

  return { proceed: true };
}

async function verifyProfile(tx: any, userId: string) {
  if (!userId) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } };
  const profileRes = await tx.select().from(profiles).where(eq(profiles.id, userId));
  if (profileRes.length === 0) return { ok: false, error: { code: 'PROFILE_SETUP_REQUIRED', message: 'Profile not found' } };
  const p = profileRes[0];
  if (!p.username || !p.displayName) return { ok: false, error: { code: 'PROFILE_SETUP_REQUIRED', message: 'Profile setup is incomplete' } };
  return { ok: true };
}

async function isReleased(dateStr: string | null) {
  if (!dateStr) return false;
  // conservative UTC date-only rules
  const airDate = new Date(dateStr);
  const now = new Date();

  // Ignore time component, only compare UTC dates
  const airUtc = Date.UTC(airDate.getUTCFullYear(), airDate.getUTCMonth(), airDate.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return airUtc <= nowUtc;
}

export async function markEpisodeWatched(params: {
  userId: string;
  operationId: string;
  episodeId: string;
  mode: MarkMode;
}): Promise<MutationResult> {
  const { userId, operationId, episodeId, mode } = params;
  const action: TrackingAction = 'mark_episode';
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ episodeId, mode })).digest('hex');

  return await db.transaction(async (tx) => {
    const prof = await verifyProfile(tx, userId);
    if (!prof.ok) return prof as MutationResult;

    const { proceed, replay, conflict } = await checkReceiptAndClaim(tx, userId, operationId, action, requestHash);
    if (!proceed) return replay || conflict!;

    const episodeData = await tx.select({
      episodeId: episodes.id,
      installmentId: episodes.installmentId,
      trackId: installments.continuityTrackId,
      trackType: continuityTracks.type,
      mediaGroupId: continuityTracks.mediaGroupId,
      mediaGroupType: mediaGroups.type,
      airDate: episodes.airDate,
      episodeNumber: episodes.episodeNumber,
      sequenceNumber: installments.sequenceNumber
    }).from(episodes)
    .innerJoin(installments, eq(episodes.installmentId, installments.id))
    .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
    .innerJoin(mediaGroups, eq(continuityTracks.mediaGroupId, mediaGroups.id))
    .where(eq(episodes.id, episodeId));

    if (episodeData.length === 0) return { ok: false, error: { code: 'UNKNOWN_CATALOGUE_ID', message: 'Episode not found' } };

    const targetEp = episodeData[0];

    if (targetEp.mediaGroupType === 'movie') return { ok: false, error: { code: 'MEDIA_KIND_MISMATCH', message: 'Cannot mark movie as episode' } };

    if (!(await isReleased(targetEp.airDate))) return { ok: false, error: { code: 'RELEASE_UNCONFIRMED', message: 'Episode is unreleased' } };

    const targetEpisodes: typeof targetEp[] = [targetEp];

    if (mode === 'earlier_current_season' || mode === 'earlier_all_seasons') {
      const query = tx.select({
        episodeId: episodes.id,
        installmentId: episodes.installmentId,
        trackId: installments.continuityTrackId,
        trackType: continuityTracks.type,
        mediaGroupId: continuityTracks.mediaGroupId,
        mediaGroupType: mediaGroups.type,
        airDate: episodes.airDate,
        episodeNumber: episodes.episodeNumber,
        sequenceNumber: installments.sequenceNumber
      }).from(episodes)
      .innerJoin(installments, eq(episodes.installmentId, installments.id))
      .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
      .innerJoin(mediaGroups, eq(continuityTracks.mediaGroupId, mediaGroups.id))
      .where(and(
        eq(continuityTracks.mediaGroupId, targetEp.mediaGroupId),
        eq(continuityTracks.type, 'mainline'), // Exclude extras/other tracks
        eq(episodes.isExtra, false)
      ));

      const allEps = await query;

      for (const ep of allEps) {
        if (ep.episodeId === targetEp.episodeId) continue;

        let shouldInclude = false;
        if (mode === 'earlier_current_season') {
          if (ep.installmentId === targetEp.installmentId && ep.episodeNumber < targetEp.episodeNumber) {
            shouldInclude = true;
          }
        } else if (mode === 'earlier_all_seasons') {
          if (ep.sequenceNumber < targetEp.sequenceNumber) {
            shouldInclude = true;
          } else if (ep.sequenceNumber === targetEp.sequenceNumber && ep.episodeNumber < targetEp.episodeNumber) {
            shouldInclude = true;
          }
        }

        if (shouldInclude && await isReleased(ep.airDate)) {
          targetEpisodes.push(ep);
        }
      }
    }

    const now = new Date();
    await tx.insert(userMediaState).values({
      userId, mediaGroupId: targetEp.mediaGroupId, inLibrary: true, intent: 'active',
      firstAddedAt: now, lastAddedAt: now, membershipChangedAt: now, intentChangedAt: now, lastActivityAt: now, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [userMediaState.userId, userMediaState.mediaGroupId],
      set: {
        inLibrary: true, intent: 'active', lastActivityAt: now,
        intentChangedAt: sql`CASE WHEN ${userMediaState.intent} != 'active' THEN ${now.toISOString()} ELSE ${userMediaState.intentChangedAt} END`,
        membershipChangedAt: sql`CASE WHEN ${userMediaState.inLibrary} = false THEN ${now.toISOString()} ELSE ${userMediaState.membershipChangedAt} END`,
        updatedAt: now,
      }
    });

    for (const ep of targetEpisodes) {
      await tx.insert(canonicalWatchedEpisodes).values({
        userId, episodeId: ep.episodeId, firstWatchedAt: now, lastWatchedAt: now, rewatchCount: 1, createdAt: now, updatedAt: now
      }).onConflictDoUpdate({
        target: [canonicalWatchedEpisodes.userId, canonicalWatchedEpisodes.episodeId],
        set: { lastWatchedAt: now, rewatchCount: sql`${canonicalWatchedEpisodes.rewatchCount} + 1`, updatedAt: now }
      });
    }

    const summary = await computeProgressSummary(tx, userId, targetEp.mediaGroupId);

    const resultData = { operationId, mediaGroupId: targetEp.mediaGroupId, action, scope: mode, affectedCount: targetEpisodes.length, summary };
    await tx.update(trackingOperations).set({ result: resultData, completedAt: now }).where(eq(trackingOperations.operationId, operationId));

    return { ok: true, data: resultData };
  });
}

export async function unmarkEpisodeWatched(params: {
  userId: string;
  operationId: string;
  episodeId: string;
  scope: UnmarkScope;
  removal: RemovalChoice;
}): Promise<MutationResult> {
  const { userId, operationId, episodeId, scope, removal } = params;
  const action: TrackingAction = 'unmark_episode';
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ episodeId, scope, removal })).digest('hex');

  return await db.transaction(async (tx) => {
    const prof = await verifyProfile(tx, userId);
    if (!prof.ok) return prof as MutationResult;

    const { proceed, replay, conflict } = await checkReceiptAndClaim(tx, userId, operationId, action, requestHash);
    if (!proceed) return replay || conflict!;

    const episodeData = await tx.select({
      episodeId: episodes.id,
      installmentId: episodes.installmentId,
      trackId: installments.continuityTrackId,
      trackType: continuityTracks.type,
      mediaGroupId: continuityTracks.mediaGroupId,
      mediaGroupType: mediaGroups.type,
      episodeNumber: episodes.episodeNumber,
      sequenceNumber: installments.sequenceNumber
    }).from(episodes)
    .innerJoin(installments, eq(episodes.installmentId, installments.id))
    .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
    .innerJoin(mediaGroups, eq(continuityTracks.mediaGroupId, mediaGroups.id))
    .where(eq(episodes.id, episodeId));

    if (episodeData.length === 0) return { ok: false, error: { code: 'UNKNOWN_CATALOGUE_ID', message: 'Episode not found' } };

    const targetEp = episodeData[0];
    if (targetEp.mediaGroupType === 'movie') return { ok: false, error: { code: 'MEDIA_KIND_MISMATCH', message: 'Cannot unmark movie as episode' } };

    let targetEpisodeIds: string[] = [targetEp.episodeId];

    if (scope === 'later_current_season' || scope === 'later_all_seasons') {
      const allEps = await tx.select({
        episodeId: episodes.id,
        installmentId: episodes.installmentId,
        episodeNumber: episodes.episodeNumber,
        sequenceNumber: installments.sequenceNumber
      }).from(episodes)
      .innerJoin(installments, eq(episodes.installmentId, installments.id))
      .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
      .where(eq(continuityTracks.mediaGroupId, targetEp.mediaGroupId));

      for (const ep of allEps) {
        if (ep.episodeId === targetEp.episodeId) continue;

        if (scope === 'later_current_season') {
          if (ep.installmentId === targetEp.installmentId && ep.episodeNumber > targetEp.episodeNumber) {
            targetEpisodeIds.push(ep.episodeId);
          }
        } else if (scope === 'later_all_seasons') {
          if (ep.sequenceNumber > targetEp.sequenceNumber) {
            targetEpisodeIds.push(ep.episodeId);
          } else if (ep.sequenceNumber === targetEp.sequenceNumber && ep.episodeNumber > targetEp.episodeNumber) {
            targetEpisodeIds.push(ep.episodeId);
          }
        }
      }
    }

    // Apply deterministic locking and order
    targetEpisodeIds.sort();

    const watchedRecords = await tx.select().from(canonicalWatchedEpisodes)
      .where(and(eq(canonicalWatchedEpisodes.userId, userId), inArray(canonicalWatchedEpisodes.episodeId, targetEpisodeIds)))
      .orderBy(asc(canonicalWatchedEpisodes.episodeId)) // deterministic
      .for('update');

    let affectedCount = 0;
    const now = new Date();

    for (const record of watchedRecords) {
      if (removal === 'completely' || record.rewatchCount <= 1) {
        await tx.delete(canonicalWatchedEpisodes).where(and(eq(canonicalWatchedEpisodes.userId, userId), eq(canonicalWatchedEpisodes.episodeId, record.episodeId)));
        affectedCount++;
      } else {
        await tx.update(canonicalWatchedEpisodes)
          .set({ rewatchCount: record.rewatchCount - 1, updatedAt: now })
          .where(and(eq(canonicalWatchedEpisodes.userId, userId), eq(canonicalWatchedEpisodes.episodeId, record.episodeId)));
        affectedCount++;
      }
    }

    // We do NOT remove userMediaState intentionally! PRD M2 lock #5.

    const summary = await computeProgressSummary(tx, userId, targetEp.mediaGroupId);

    const resultData = { operationId, mediaGroupId: targetEp.mediaGroupId, action, scope, affectedCount, summary };
    await tx.update(trackingOperations).set({ result: resultData, completedAt: now }).where(eq(trackingOperations.operationId, operationId));

    return { ok: true, data: resultData };
  });
}

export async function deleteTracking(params: {
  userId: string;
  operationId: string;
  mediaGroupId: string;
}): Promise<MutationResult> {
  const { userId, operationId, mediaGroupId } = params;
  const action: TrackingAction = 'delete_tracking';
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ mediaGroupId })).digest('hex');

  return await db.transaction(async (tx) => {
    const prof = await verifyProfile(tx, userId);
    if (!prof.ok) return prof as MutationResult;

    const { proceed, replay, conflict } = await checkReceiptAndClaim(tx, userId, operationId, action, requestHash);
    if (!proceed) return replay || conflict!;

    // We must find all episodes belonging to this mediaGroup
    const groupEps = await tx.select({ id: episodes.id }).from(episodes)
      .innerJoin(installments, eq(episodes.installmentId, installments.id))
      .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
      .where(eq(continuityTracks.mediaGroupId, mediaGroupId));

    const epIds = groupEps.map(e => e.id);

    if (epIds.length > 0) {
      await tx.delete(canonicalWatchedEpisodes).where(and(eq(canonicalWatchedEpisodes.userId, userId), inArray(canonicalWatchedEpisodes.episodeId, epIds)));
    }

    await tx.delete(canonicalWatchedMovies).where(and(eq(canonicalWatchedMovies.userId, userId), eq(canonicalWatchedMovies.mediaGroupId, mediaGroupId)));
    await tx.delete(userMediaState).where(and(eq(userMediaState.userId, userId), eq(userMediaState.mediaGroupId, mediaGroupId)));

    const now = new Date();
    const resultData = { operationId, mediaGroupId, action, affectedCount: epIds.length };
    await tx.update(trackingOperations).set({ result: resultData, completedAt: now }).where(eq(trackingOperations.operationId, operationId));

    return { ok: true, data: resultData };
  });
}

export async function markMovieWatched(params: {
  userId: string;
  operationId: string;
  mediaGroupId: string;
}): Promise<MutationResult> {
  const { userId, operationId, mediaGroupId } = params;
  const action: TrackingAction = 'mark_movie';
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ mediaGroupId })).digest('hex');

  return await db.transaction(async (tx) => {
    const prof = await verifyProfile(tx, userId);
    if (!prof.ok) return prof as MutationResult;

    const { proceed, replay, conflict } = await checkReceiptAndClaim(tx, userId, operationId, action, requestHash);
    if (!proceed) return replay || conflict!;

    const groupRes = await tx.select().from(mediaGroups).where(eq(mediaGroups.id, mediaGroupId));
    if (groupRes.length === 0) return { ok: false, error: { code: 'UNKNOWN_CATALOGUE_ID', message: 'Movie not found' } };

    const targetGroup = groupRes[0];
    if (targetGroup.type !== 'movie') return { ok: false, error: { code: 'MEDIA_KIND_MISMATCH', message: 'Cannot mark TV/Anime as movie' } };

    // Movie release checking
    const evs = await tx.select().from(releaseStateEvidence).where(and(eq(releaseStateEvidence.mediaGroupId, mediaGroupId), eq(releaseStateEvidence.evidenceKind, 'release_date')));
    if (evs.length === 0) return { ok: false, error: { code: 'RELEASE_UNCONFIRMED', message: 'Movie release date unknown' } };

    let anyReleased = false;
    for (const ev of evs) {
      if (ev.exactDate && await isReleased(ev.exactDate)) anyReleased = true;
      if (ev.exactTime && await isReleased(ev.exactTime.toISOString())) anyReleased = true;
    }
    if (!anyReleased) return { ok: false, error: { code: 'RELEASE_UNCONFIRMED', message: 'Movie is unreleased' } };

    const now = new Date();
    await tx.insert(userMediaState).values({
      userId, mediaGroupId, inLibrary: true, intent: 'active',
      firstAddedAt: now, lastAddedAt: now, membershipChangedAt: now, intentChangedAt: now, lastActivityAt: now, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [userMediaState.userId, userMediaState.mediaGroupId],
      set: {
        inLibrary: true,
        membershipChangedAt: sql`CASE WHEN ${userMediaState.inLibrary} = false THEN ${now.toISOString()} ELSE ${userMediaState.membershipChangedAt} END`,
        updatedAt: now,
      }
    });

    await tx.insert(canonicalWatchedMovies).values({
      userId, mediaGroupId, firstWatchedAt: now, lastWatchedAt: now, rewatchCount: 1, createdAt: now, updatedAt: now
    }).onConflictDoUpdate({
      target: [canonicalWatchedMovies.userId, canonicalWatchedMovies.mediaGroupId],
      set: { lastWatchedAt: now, rewatchCount: sql`${canonicalWatchedMovies.rewatchCount} + 1`, updatedAt: now }
    });

    const summary = await computeProgressSummary(tx, userId, mediaGroupId);

    const resultData = { operationId, mediaGroupId, action, affectedCount: 1, summary };
    await tx.update(trackingOperations).set({ result: resultData, completedAt: now }).where(eq(trackingOperations.operationId, operationId));

    return { ok: true, data: resultData };
  });
}

export async function unmarkMovieWatched(params: {
  userId: string;
  operationId: string;
  mediaGroupId: string;
  removal: RemovalChoice;
}): Promise<MutationResult> {
  const { userId, operationId, mediaGroupId, removal } = params;
  const action: TrackingAction = 'unmark_movie';
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ mediaGroupId, removal })).digest('hex');

  return await db.transaction(async (tx) => {
    const prof = await verifyProfile(tx, userId);
    if (!prof.ok) return prof as MutationResult;

    const { proceed, replay, conflict } = await checkReceiptAndClaim(tx, userId, operationId, action, requestHash);
    if (!proceed) return replay || conflict!;

    const groupRes = await tx.select().from(mediaGroups).where(eq(mediaGroups.id, mediaGroupId));
    if (groupRes.length === 0) return { ok: false, error: { code: 'UNKNOWN_CATALOGUE_ID', message: 'Movie not found' } };
    if (groupRes[0].type !== 'movie') return { ok: false, error: { code: 'MEDIA_KIND_MISMATCH', message: 'Cannot unmark TV/Anime as movie' } };

    const watchedRecords = await tx.select().from(canonicalWatchedMovies)
      .where(and(eq(canonicalWatchedMovies.userId, userId), eq(canonicalWatchedMovies.mediaGroupId, mediaGroupId)))
      .for('update');

    let affectedCount = 0;
    const now = new Date();

    if (watchedRecords.length > 0) {
      const record = watchedRecords[0];
      if (removal === 'completely' || record.rewatchCount <= 1) {
        await tx.delete(canonicalWatchedMovies).where(and(eq(canonicalWatchedMovies.userId, userId), eq(canonicalWatchedMovies.mediaGroupId, mediaGroupId)));
        affectedCount = 1;
      } else {
        await tx.update(canonicalWatchedMovies)
          .set({ rewatchCount: record.rewatchCount - 1, updatedAt: now })
          .where(and(eq(canonicalWatchedMovies.userId, userId), eq(canonicalWatchedMovies.mediaGroupId, mediaGroupId)));
        affectedCount = 1;
      }
    }

    const summary = await computeProgressSummary(tx, userId, mediaGroupId);

    const resultData = { operationId, mediaGroupId, action, affectedCount, summary };
    await tx.update(trackingOperations).set({ result: resultData, completedAt: now }).where(eq(trackingOperations.operationId, operationId));

    return { ok: true, data: resultData };
  });
}

export async function addToLibrary(params: {
  userId: string;
  operationId: string;
  mediaGroupId: string;
}): Promise<MutationResult> {
  const { userId, operationId, mediaGroupId } = params;
  const action: TrackingAction = 'add_to_library';
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ mediaGroupId })).digest('hex');

  return await db.transaction(async (tx) => {
    const prof = await verifyProfile(tx, userId);
    if (!prof.ok) return prof as MutationResult;

    const { proceed, replay, conflict } = await checkReceiptAndClaim(tx, userId, operationId, action, requestHash);
    if (!proceed) return replay || conflict!;

    const groupRes = await tx.select().from(mediaGroups).where(eq(mediaGroups.id, mediaGroupId));
    if (groupRes.length === 0) return { ok: false, error: { code: 'UNKNOWN_CATALOGUE_ID', message: 'Group not found' } };

    const now = new Date();
    await tx.insert(userMediaState).values({
      userId, mediaGroupId, inLibrary: true, intent: 'active',
      firstAddedAt: now, lastAddedAt: now, membershipChangedAt: now, intentChangedAt: now, lastActivityAt: now, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [userMediaState.userId, userMediaState.mediaGroupId],
      set: {
        inLibrary: true,
        membershipChangedAt: sql`CASE WHEN ${userMediaState.inLibrary} = false THEN ${now.toISOString()} ELSE ${userMediaState.membershipChangedAt} END`,
        updatedAt: now,
      }
    });

    const summary = await computeProgressSummary(tx, userId, mediaGroupId);

    const resultData = { operationId, mediaGroupId, action, affectedCount: 1, summary };
    await tx.update(trackingOperations).set({ result: resultData, completedAt: now }).where(eq(trackingOperations.operationId, operationId));

    return { ok: true, data: resultData };
  });
}

export async function removeFromLibrary(params: {
  userId: string;
  operationId: string;
  mediaGroupId: string;
}): Promise<MutationResult> {
  const { userId, operationId, mediaGroupId } = params;
  const action: TrackingAction = 'remove_from_library';
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ mediaGroupId })).digest('hex');

  return await db.transaction(async (tx) => {
    const prof = await verifyProfile(tx, userId);
    if (!prof.ok) return prof as MutationResult;

    const { proceed, replay, conflict } = await checkReceiptAndClaim(tx, userId, operationId, action, requestHash);
    if (!proceed) return replay || conflict!;

    const groupRes = await tx.select().from(mediaGroups).where(eq(mediaGroups.id, mediaGroupId));
    if (groupRes.length === 0) return { ok: false, error: { code: 'UNKNOWN_CATALOGUE_ID', message: 'Group not found' } };

    const now = new Date();
    await tx.update(userMediaState)
      .set({
        inLibrary: false,
        membershipChangedAt: sql`CASE WHEN ${userMediaState.inLibrary} = true THEN ${now.toISOString()} ELSE ${userMediaState.membershipChangedAt} END`,
        updatedAt: now
      })
      .where(and(eq(userMediaState.userId, userId), eq(userMediaState.mediaGroupId, mediaGroupId)));

    const summary = await computeProgressSummary(tx, userId, mediaGroupId);

    const resultData = { operationId, mediaGroupId, action, affectedCount: 1, summary };
    await tx.update(trackingOperations).set({ result: resultData, completedAt: now }).where(eq(trackingOperations.operationId, operationId));

    return { ok: true, data: resultData };
  });
}

export async function setMediaIntent(params: {
  userId: string;
  operationId: string;
  mediaGroupId: string;
  intent: 'active' | 'paused' | 'watch_later' | 'dropped';
}): Promise<MutationResult> {
  const { userId, operationId, mediaGroupId, intent } = params;
  const action: TrackingAction = 'set_intent';
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({ mediaGroupId, intent })).digest('hex');

  return await db.transaction(async (tx) => {
    const prof = await verifyProfile(tx, userId);
    if (!prof.ok) return prof as MutationResult;

    const { proceed, replay, conflict } = await checkReceiptAndClaim(tx, userId, operationId, action, requestHash);
    if (!proceed) return replay || conflict!;

    const groupRes = await tx.select().from(mediaGroups).where(eq(mediaGroups.id, mediaGroupId));
    if (groupRes.length === 0) return { ok: false, error: { code: 'UNKNOWN_CATALOGUE_ID', message: 'Group not found' } };

    const now = new Date();
    await tx.insert(userMediaState).values({
      userId, mediaGroupId, inLibrary: true, intent, // Usually setting intent implies library addition
      firstAddedAt: now, lastAddedAt: now, membershipChangedAt: now, intentChangedAt: now, lastActivityAt: now, createdAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: [userMediaState.userId, userMediaState.mediaGroupId],
      set: {
        intent,
        intentChangedAt: sql`CASE WHEN ${userMediaState.intent} != ${intent} THEN ${now.toISOString()} ELSE ${userMediaState.intentChangedAt} END`,
        updatedAt: now,
      }
    });

    const summary = await computeProgressSummary(tx, userId, mediaGroupId);

    const resultData = { operationId, mediaGroupId, action, affectedCount: 1, summary };
    await tx.update(trackingOperations).set({ result: resultData, completedAt: now }).where(eq(trackingOperations.operationId, operationId));

    return { ok: true, data: resultData };
  });
}

// Ensure unique mappings in repository layer validation
export async function validateMappingVersionEntries(tx: any, mappingVersionId: string) {
  const versionInfo = await tx.select().from(mappingVersions).where(eq(mappingVersions.id, mappingVersionId));
  if (versionInfo.length === 0) throw new Error('Mapping version not found');

  const entries = await tx.select().from(mappingVersionEntries).where(eq(mappingVersionEntries.mappingVersionId, mappingVersionId));

  for (const entry of entries) {
    if (entry.mediaGroupId && entry.mediaGroupId !== versionInfo[0].mediaGroupId) {
      throw new Error('MAPPING_TARGET_MISMATCH');
    }
    if (entry.installmentId) {
      const inst = await tx.select({ mediaGroupId: continuityTracks.mediaGroupId })
        .from(installments)
        .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
        .where(eq(installments.id, entry.installmentId));
      if (inst.length === 0 || inst[0].mediaGroupId !== versionInfo[0].mediaGroupId) {
        throw new Error('MAPPING_TARGET_MISMATCH');
      }
    }
    if (entry.episodeId) {
      const ep = await tx.select({ mediaGroupId: continuityTracks.mediaGroupId })
        .from(episodes)
        .innerJoin(installments, eq(episodes.installmentId, installments.id))
        .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
        .where(eq(episodes.id, entry.episodeId));
      if (ep.length === 0 || ep[0].mediaGroupId !== versionInfo[0].mediaGroupId) {
        throw new Error('MAPPING_TARGET_MISMATCH');
      }
    }
  }
}

async function computeProgressSummary(tx: any, userId: string, mediaGroupId: string): Promise<TrackingSummary> {
  const groupRes = await tx.select().from(mediaGroups).where(eq(mediaGroups.id, mediaGroupId));
  if (groupRes.length === 0) throw new Error('Media group not found');
  const group = groupRes[0];

  let watchedCount = 0;
  let frontierEpisode: any = null;
  let progressState: Progress = 'not_started';
  let totalReleased = 0;
  let totalUnreleased = 0;

  if (group.type === 'movie') {
    let totalReleased = 0;
    let totalUnreleased = 0;
    const evs = await tx.select().from(releaseStateEvidence).where(and(eq(releaseStateEvidence.mediaGroupId, mediaGroupId), eq(releaseStateEvidence.evidenceKind, 'release_date')));

    let isRel = false;
    for (const ev of evs) {
      if (ev.exactDate && await isReleased(ev.exactDate)) isRel = true;
      if (ev.exactTime && await isReleased(ev.exactTime.toISOString())) isRel = true;
    }
    if (isRel) totalReleased = 1; else totalUnreleased = 1;

    const watchedRes = await tx.select().from(canonicalWatchedMovies).where(and(eq(canonicalWatchedMovies.userId, userId), eq(canonicalWatchedMovies.mediaGroupId, mediaGroupId)));
    if (watchedRes.length > 0) {
      watchedCount = 1;
      progressState = totalUnreleased === 0 ? 'finished' : 'caught_up';
    } else {
      progressState = totalReleased > 0 ? 'not_started' : 'unreleased';
    }
  } else {
    // TV/Anime
    const allEps = await tx.select({
      episodeId: episodes.id,
      airDate: episodes.airDate,
      isExtra: episodes.isExtra,
      trackType: continuityTracks.type,
      episodeNumber: episodes.episodeNumber,
      sequenceNumber: installments.sequenceNumber
    }).from(episodes)
    .innerJoin(installments, eq(episodes.installmentId, installments.id))
    .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
    .where(eq(continuityTracks.mediaGroupId, mediaGroupId))
    .orderBy(asc(installments.sequenceNumber), asc(episodes.episodeNumber));

    // Only mainline non-extra for progress math
    const mainlineEps = allEps.filter((e: any) => e.trackType === 'mainline' && !e.isExtra);

    const epIds = allEps.map((e: any) => e.episodeId);

    let watchedSet = new Set<string>();
    if (epIds.length > 0) {
      const watched = await tx.select({ episodeId: canonicalWatchedEpisodes.episodeId }).from(canonicalWatchedEpisodes).where(and(
        eq(canonicalWatchedEpisodes.userId, userId),
        inArray(canonicalWatchedEpisodes.episodeId, epIds)
      ));
      watched.forEach((w: any) => watchedSet.add(w.episodeId));
    }

    let maxWatchedIndex = -1;

    for (let i = 0; i < mainlineEps.length; i++) {
      const ep = mainlineEps[i];
      const isRel = await isReleased(ep.airDate);
      if (isRel) totalReleased++; else totalUnreleased++;

      if (watchedSet.has(ep.episodeId)) {
        watchedCount++;
        maxWatchedIndex = i;
      }
    }

    if (maxWatchedIndex >= 0) {
      frontierEpisode = mainlineEps[maxWatchedIndex].episodeId;
    }

    if (watchedCount === 0) {
      progressState = totalReleased > 0 ? 'not_started' : 'unreleased';
    } else if (watchedCount < totalReleased) {
      progressState = 'in_progress';
    } else {
      // Watched all released
      if (totalUnreleased > 0) {
        progressState = 'caught_up';
      } else {
        progressState = 'finished';
      }
    }
  }

  return {
    progressState,
    watchedCount,
    frontierEpisodeId: frontierEpisode
  };
}
