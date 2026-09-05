import { eq, and, sql, lte } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client';
import {
  metadataRefreshJobs,
  providerSyncRuns,
  mediaGroups,
} from '../../db/schema';
import { ProviderError } from '../providers/errors';

export interface QueueRefreshOptions {
  provider: 'anilist' | 'tmdb' | 'anizip' | 'fanart';
  targetType: string;
  targetId: string;
  jobKind: string;
  mediaGroupId?: string;
  priority?: 'interactive' | 'background';
  cadenceTier?: 'airing_15m' | 'upcoming_6h' | 'daily' | 'weekly' | 'monthly' | 'on_demand';
  nextAttemptAt?: Date;
}

export async function queueRefresh(
  options: QueueRefreshOptions,
  db: any = defaultDb
) {
  const {
    provider,
    targetType,
    targetId,
    jobKind,
    mediaGroupId,
    priority = 'background',
    cadenceTier = 'daily',
    nextAttemptAt = new Date(),
  } = options;

  // Insert or update existing job idempotently
  const [job] = await db
    .insert(metadataRefreshJobs)
    .values({
      provider,
      targetType,
      targetId,
      jobKind,
      mediaGroupId,
      priority,
      cadenceTier,
      status: 'queued',
      nextAttemptAt,
      attempts: 0,
    })
    .onConflictDoUpdate({
      target: [
        metadataRefreshJobs.provider,
        metadataRefreshJobs.targetType,
        metadataRefreshJobs.targetId,
        metadataRefreshJobs.jobKind,
      ],
      set: {
        priority,
        nextAttemptAt,
        status: sql`CASE WHEN ${metadataRefreshJobs.status} = 'dead' THEN 'queued' ELSE ${metadataRefreshJobs.status} END`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return job;
}

export async function claimNextRefreshJob(
  workerId: string,
  leaseDurationMs: number = 60000,
  db: any = defaultDb
) {
  const now = new Date();
  const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);

  return await db.transaction(async (tx: any) => {
    // Find claimable job: status is queued or retry_wait, or running with expired lease
    const claimable = await tx
      .select()
      .from(metadataRefreshJobs)
      .where(
        sql`${metadataRefreshJobs.nextAttemptAt} <= ${now} AND (${metadataRefreshJobs.status} IN ('queued', 'retry_wait') OR (${metadataRefreshJobs.status} = 'running' AND ${metadataRefreshJobs.leaseExpiresAt} < ${now}))`
      )
      .orderBy(
        sql`CASE WHEN ${metadataRefreshJobs.priority} = 'interactive' THEN 0 ELSE 1 END`,
        metadataRefreshJobs.nextAttemptAt
      )
      .limit(1);

    if (claimable.length === 0) return null;

    const targetJob = claimable[0];

    const [claimed] = await tx
      .update(metadataRefreshJobs)
      .set({
        status: 'running',
        leaseOwner: workerId,
        leaseExpiresAt,
        attempts: targetJob.attempts + 1,
        updatedAt: now,
      })
      .where(eq(metadataRefreshJobs.id, targetJob.id))
      .returning();

    return claimed;
  });
}

export async function completeRefreshJob(
  jobId: string,
  workerId: string,
  success: boolean,
  error?: { code: string; message: string },
  db: any = defaultDb
) {
  const [job] = await db
    .select()
    .from(metadataRefreshJobs)
    .where(eq(metadataRefreshJobs.id, jobId))
    .limit(1);

  if (!job) return null;

  const now = new Date();

  if (success) {
    const [updated] = await db
      .update(metadataRefreshJobs)
      .set({
        status: 'succeeded',
        lastSucceededAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: null,
        errorMessage: null,
        updatedAt: now,
      })
      .where(eq(metadataRefreshJobs.id, jobId))
      .returning();
    return updated;
  } else {
    // Failure handling: check retry limit
    const isDead = job.attempts >= job.maxAttempts;
    const nextStatus = isDead ? 'dead' : 'retry_wait';
    // Backoff 2^attempts minutes
    const backoffMs = Math.min(Math.pow(2, job.attempts) * 60000, 24 * 3600 * 1000);
    const nextAttempt = new Date(Date.now() + backoffMs);

    const [updated] = await db
      .update(metadataRefreshJobs)
      .set({
        status: nextStatus,
        nextAttemptAt: nextAttempt,
        leaseOwner: null,
        leaseExpiresAt: null,
        errorCode: error?.code || 'UNKNOWN_ERROR',
        errorMessage: error?.message?.slice(0, 255) || null,
        updatedAt: now,
      })
      .where(eq(metadataRefreshJobs.id, jobId))
      .returning();
    return updated;
  }
}
