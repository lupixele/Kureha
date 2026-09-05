import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '../../auth/middleware';
import * as catalogueLogic from './ingestion';

const importInputSchema = z.object({
  provider: z.enum(['anilist', 'tmdb']),
  providerId: z.string().min(1),
  operationId: z.string().uuid(),
});

export const importProviderTitleFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator((data: unknown) => importInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    return catalogueLogic.importProviderTitle({
      userId: context.userId as string,
      provider: data.provider,
      providerId: data.providerId,
      operationId: data.operationId,
    });
  });
