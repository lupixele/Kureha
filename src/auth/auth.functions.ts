import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { authMiddleware } from './middleware';

export const getAuthenticatedUser = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader('cache-control', 'no-store');
    setResponseHeader('vary', 'authorization');

    if (!context.userId) {
      return { ok: false as const, error: 'Unauthorized' };
    }

    return { ok: true as const, userId: context.userId };
  });
