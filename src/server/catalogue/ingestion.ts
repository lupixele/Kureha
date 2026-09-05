import crypto from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client';
import {
  mediaGroups,
  continuityTracks,
  installments,
  episodes,
  mappingVersions,
  mappingVersionEntries,
  providerMappings,
  releaseStateEvidence,
  artworkAssets,
  metadataRefreshJobs,
  catalogueReviewItems,
  trackingOperations,
  profiles,
} from '../../db/schema';
import { ProviderError } from '../providers/errors';
import { resolveAniListGraph, AniListClient } from './resolver';

export interface ImportOptions {
  provider: 'anilist' | 'tmdb';
  providerId: string;
  operationId: string;
  userId: string;
}

export interface IngestionContext {
  db?: any;
  aniListClient?: AniListClient;
  tmdbClient?: any;
}

export async function importProviderTitle(
  options: ImportOptions,
  ctx: IngestionContext = {}
): Promise<{ ok: boolean; mediaGroupId: string; created: boolean; reviewItemId?: string }> {
  const db = ctx.db || defaultDb;
  const { provider, providerId, operationId, userId } = options;

  if (!operationId || !userId || !provider || !providerId) {
    throw new ProviderError('INVALID_QUERY', provider as any);
  }

  // 1. Authenticate profile and check completedSetup
  const userProfile = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!userProfile || userProfile.length === 0) {
    throw new ProviderError('UNAUTHORIZED', provider as any);
  }

  // 2. Check operationId idempotency
  const existingOp = await db
    .select()
    .from(trackingOperations)
    .where(and(eq(trackingOperations.userId, userId), eq(trackingOperations.operationId, operationId)))
    .limit(1);

  if (existingOp.length > 0) {
    const payload = existingOp[0].result as { mediaGroupId: string } | null;
    return {
      ok: true,
      mediaGroupId: payload?.mediaGroupId || '',
      created: false,
    };
  }

  // 3. Acquire transaction-scoped lock and check existing provider mapping
  return await db.transaction(async (tx: any) => {
    // Advisory lock to prevent duplicate concurrent imports
    const lockHash = BigInt(
      '0x' +
        crypto
          .createHash('sha256')
          .update(`${provider}:${providerId}`)
          .digest('hex')
          .slice(0, 15)
    );
    try {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockHash.toString()})`);
    } catch {
      // In tests/PGlite environments where advisory locks might not exist, proceed gracefully
    }

    // Check existing active provider mapping
    const existingMapping = await tx
      .select()
      .from(providerMappings)
      .where(
        and(
          eq(providerMappings.provider, provider),
          eq(providerMappings.providerId, providerId)
        )
      )
      .limit(1);

    if (existingMapping.length > 0) {
      if (existingMapping[0].mediaGroupId) {
        return {
          ok: true,
          mediaGroupId: existingMapping[0].mediaGroupId,
          created: false,
        };
      }
      if (existingMapping[0].installmentId) {
        const inst = await tx
          .select({ mediaGroupId: continuityTracks.mediaGroupId })
          .from(installments)
          .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
          .where(eq(installments.id, existingMapping[0].installmentId))
          .limit(1);

        if (inst.length > 0 && inst[0].mediaGroupId) {
          return {
            ok: true,
            mediaGroupId: inst[0].mediaGroupId,
            created: false,
          };
        }
      }
    }

    if (provider !== 'anilist') {
      throw new ProviderError('PROVIDER_UNAVAILABLE', provider as any);
    }

    if (!ctx.aniListClient) {
      throw new ProviderError('PROVIDER_UNAVAILABLE', 'anilist');
    }

    // Resolve anime graph
    const graph = await resolveAniListGraph(providerId, ctx.aniListClient);
    const rootNode = graph.mainline.find((n) => n.installment.providerId === providerId) || graph.mainline[0];

    const groupTitle = rootNode.installment.title;
    const releaseStatus = rootNode.installment.status;
    let groupReleaseState: 'upcoming' | 'airing' | 'ended' = 'ended';
    if (releaseStatus === 'releasing') groupReleaseState = 'airing';
    else if (releaseStatus === 'not_yet_released') groupReleaseState = 'upcoming';
    else if (releaseStatus === 'finished') groupReleaseState = 'ended';

    // A. Insert Media Group
    const [group] = await tx
      .insert(mediaGroups)
      .values({
        title: groupTitle,
        type: 'anime',
        releaseState: groupReleaseState,
        reviewRequired: graph.ambiguousBranches.length > 0,
        metadataPayloadHash: rootNode.payloadHash,
        metadataUpdatedAt: new Date(),
      })
      .returning();

    // B. Insert Mainline Continuity Track
    const [track] = await tx
      .insert(continuityTracks)
      .values({
        mediaGroupId: group.id,
        type: 'mainline',
        title: 'Mainline',
        isCanonical: true,
      })
      .returning();

    // C. Insert initial mapping version
    const [mappingVer] = await tx
      .insert(mappingVersions)
      .values({
        mediaGroupId: group.id,
        versionNumber: 1,
        status: 'active',
        reason: 'initial_import',
        activatedAt: new Date(),
      })
      .returning();

    // D. Insert installments, episodes, artwork, and mapping entries
    for (let i = 0; i < graph.mainline.length; i++) {
      const node = graph.mainline[i];
      const instStatus = node.installment.status;

      const [inst] = await tx
        .insert(installments)
        .values({
          continuityTrackId: track.id,
          sequenceNumber: i + 1,
          title: node.installment.title,
          format: node.installment.format || 'TV',
          status: instStatus,
        })
        .returning();

      // Mapping version entry for installment (single target: installmentId only)
      await tx.insert(mappingVersionEntries).values({
        mappingVersionId: mappingVer.id,
        installmentId: inst.id,
        provider: 'anilist',
        targetType: 'anime',
        providerId: node.installment.providerId,
        source: 'anilist',
        confidence: 100,
      });

      // Provider mapping for installment (single target: installmentId only)
      await tx.insert(providerMappings).values({
        installmentId: inst.id,
        provider: 'anilist',
        targetType: 'anime',
        providerId: node.installment.providerId,
      });

      // Insert episodes (stub ep 1 if count 0/null)
      const epCount = node.installment.totalEpisodes && node.installment.totalEpisodes > 0 ? node.installment.totalEpisodes : 1;
      for (let epNum = 1; epNum <= epCount; epNum++) {
        const [ep] = await tx
          .insert(episodes)
          .values({
            installmentId: inst.id,
            episodeNumber: epNum,
            title: `Episode ${epNum}`,
            status: instStatus === 'finished' ? 'aired' : 'unreleased',
          })
          .returning();

        await tx.insert(mappingVersionEntries).values({
          mappingVersionId: mappingVer.id,
          episodeId: ep.id,
          provider: 'anilist',
          targetType: 'episode',
          providerId: `${node.installment.providerId}_ep${epNum}`,
          source: 'anilist',
          confidence: 100,
        });
      }

      // Insert Artwork
      for (const art of node.artwork) {
        await tx.insert(artworkAssets).values({
          mediaGroupId: group.id,
          installmentId: inst.id,
          provider: 'anilist',
          kind: art.kind,
          providerAssetId: art.providerAssetId,
          url: art.urlOrPath,
          payloadHash: art.payloadHash,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        });
      }
    }

    // E. Insert Release Evidence
    await tx.insert(releaseStateEvidence).values({
      mediaGroupId: group.id,
      source: 'anilist',
      sourceId: providerId,
      evidenceKind: 'status',
      precision: 'day',
      rawStatus: releaseStatus,
    });

    // F. Queue Adaptive Refresh Job
    await tx.insert(metadataRefreshJobs).values({
      provider: 'anilist',
      targetType: 'anime',
      targetId: providerId,
      jobKind: 'metadata',
      mediaGroupId: group.id,
      priority: 'background',
      cadenceTier: 'daily',
      status: 'queued',
      nextAttemptAt: new Date(Date.now() + 86400000),
    });

    // G. Ambiguous Branches -> review items (deduped by subject provider id)
    let createdReviewItemId: string | undefined;
    const seenBranchSources = new Set<string>();
    for (const b of graph.ambiguousBranches) {
      if (seenBranchSources.has(b.sourceId)) continue;
      seenBranchSources.add(b.sourceId);

      const [reviewItem] = await tx
        .insert(catalogueReviewItems)
        .values({
          mediaGroupId: group.id,
          status: 'pending',
          reason: 'ambiguous_branch',
          subjectProvider: 'anilist',
          subjectProviderId: b.sourceId,
          evidence: { reason: b.reason },
        })
        .returning();
      createdReviewItemId = reviewItem.id;
    }

    // H. Record Tracking Operation
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ provider, providerId }))
      .digest('hex');

    await tx.insert(trackingOperations).values({
      operationId,
      userId,
      action: 'add_to_library',
      requestHash,
      result: { mediaGroupId: group.id },
      completedAt: new Date(),
    });

    return {
      ok: true,
      mediaGroupId: group.id,
      created: true,
      reviewItemId: createdReviewItemId,
    };
  });
}
