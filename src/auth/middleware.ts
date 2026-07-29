import { createMiddleware } from '@tanstack/react-start';
import { getAuthUserId } from './auth.server';
import { supabase } from './supabase-browser';

export const authMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    if (typeof window === 'undefined') {
      return next();
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return next({
      headers: session?.access_token
        ? { authorization: `Bearer ${session.access_token}` }
        : undefined,
    });
  })
  .server(async ({ next }) => {
    const userId = await getAuthUserId();
    return next({ context: { userId } });
  });
