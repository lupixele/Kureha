import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { supabase } from '../../auth/supabase-browser';
import { useEffect } from 'react';

export const Route = createFileRoute('/auth/callback')({
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase client automatically detects the hash/search fragment on load
    // and exchanges it for a session. We wait for that event.

    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const init = async () => {
      // 1. Setup listener for the SIGN_IN event
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session && isMounted) {
          if (fallbackTimer) clearTimeout(fallbackTimer);
          navigate({ to: '/', replace: true });
        }
      });
      subscription = data.subscription;

      // 2. Check if already signed in immediately
      const { data: currentData } = await supabase.auth.getSession();
      if (currentData.session && isMounted) {
        navigate({ to: '/', replace: true });
        return;
      }

      // 3. Fallback: if after 5 seconds no event fired, error out
      fallbackTimer = setTimeout(() => {
        if (isMounted) {
            console.error('Timeout waiting for session after callback');
            navigate({ to: '/login', replace: true });
        }
      }, 5000);
    };

    init();

    return () => {
      isMounted = false;
      if (subscription) subscription.unsubscribe();
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [navigate]);

  return (
    <div>
      <p>Completing sign in...</p>
    </div>
  );
}