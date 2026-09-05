import { z } from 'zod';
import { ProviderError } from '../providers/errors';
import {
  NormalizedInstallment,
  NormalizedRelation,
  NormalizedArtworkCandidate,
  SchemaDrift
} from '../providers/types';

export interface AniListClient {
  details(id: string): Promise<{
    installment: NormalizedInstallment;
    relations: NormalizedRelation[];
    artwork: NormalizedArtworkCandidate[];
    drift: SchemaDrift[];
    payloadHash: string;
  }>;
}

export interface ResolvedAnimeNode {
  installment: NormalizedInstallment;
  artwork: NormalizedArtworkCandidate[];
  drift: SchemaDrift[];
  payloadHash: string;
  directRelations: NormalizedRelation[];
}

export interface ResolvedAnimeGraph {
  rootId: string;
  mainline: ResolvedAnimeNode[];
  extrasAndRelations: NormalizedRelation[];
  ambiguousBranches: {
    sourceId: string;
    targetId: string;
    reason: string;
  }[];
}

const MAX_NODES = 25;
const MAX_DEPTH = 8;

export async function resolveAniListGraph(
  rootId: string,
  client: AniListClient
): Promise<ResolvedAnimeGraph> {
  const visited = new Map<string, ResolvedAnimeNode>();
  const ambiguousBranches: ResolvedAnimeGraph['ambiguousBranches'] = [];
  const extrasAndRelations: NormalizedRelation[] = [];

  // Fetch root
  const rootData = await client.details(rootId);
  visited.set(rootId, {
    installment: rootData.installment,
    artwork: rootData.artwork,
    drift: rootData.drift,
    payloadHash: rootData.payloadHash,
    directRelations: rootData.relations,
  });

  // Mainline chain starts with root
  const mainlineIds: string[] = [rootId];

  // Helper to step along PREQUEL or SEQUEL
  async function traverseDirection(
    startId: string,
    direction: 'PREQUEL' | 'SEQUEL',
    depth: number
  ) {
    let currentId = startId;
    let currentDepth = depth;

    while (currentDepth < MAX_DEPTH && visited.size < MAX_NODES) {
      const node = visited.get(currentId);
      if (!node) break;

      // Find all candidates pointing in this direction
      const candidates = node.directRelations.filter((r) => r.relationType === direction);

      // Collect non-mainline relations
      for (const r of node.directRelations) {
        if (r.relationType !== 'PREQUEL' && r.relationType !== 'SEQUEL') {
          extrasAndRelations.push(r);
        }
      }

      if (candidates.length === 0) {
        break;
      }

      if (candidates.length > 1) {
        // Ambiguous branching detected: multiple prequels or sequels
        for (const c of candidates) {
          ambiguousBranches.push({
            sourceId: currentId,
            targetId: c.targetProviderId,
            reason: `Multiple ${direction} candidates (${candidates.length}) at node ${currentId}`,
          });
        }
        break;
      }

      const nextTarget = candidates[0];
      const nextId = nextTarget.targetProviderId;

      if (visited.has(nextId)) {
        // Cycle detected or already visited
        break;
      }

      try {
        const nextData = await client.details(nextId);
        const resolvedNext: ResolvedAnimeNode = {
          installment: nextData.installment,
          artwork: nextData.artwork,
          drift: nextData.drift,
          payloadHash: nextData.payloadHash,
          directRelations: nextData.relations,
        };
        visited.set(nextId, resolvedNext);

        // Mainline candidate qualification
        // Filter out OVAs, Specials, Movies, etc. if they break strict TV continuation
        const format = (resolvedNext.installment.format || '').toUpperCase();
        const isExcludedFormat = ['OVA', 'ONA', 'SPECIAL', 'MUSIC'].includes(format);

        if (isExcludedFormat) {
          extrasAndRelations.push(nextTarget);
          break;
        }

        if (direction === 'PREQUEL') {
          mainlineIds.unshift(nextId);
        } else {
          mainlineIds.push(nextId);
        }

        currentId = nextId;
        currentDepth++;
      } catch (err) {
        // Network or client failure fetching continuation, terminate direction cleanly
        break;
      }
    }
  }

  // Traverse backward (prequels) then forward (sequels)
  await traverseDirection(rootId, 'PREQUEL', 0);
  await traverseDirection(rootId, 'SEQUEL', 0);

  const mainline = mainlineIds.map((id) => visited.get(id)!);

  return {
    rootId,
    mainline,
    extrasAndRelations,
    ambiguousBranches,
  };
}
