import '@tanstack/react-start/server-only';
import { getRequestHeader } from '@tanstack/react-start/server';
import { createSupabaseAuthClient } from './supabase.server';

function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function getAuthUserId() {
  const accessToken = getBearerToken(getRequestHeader('authorization'));

  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return user.id;
}
