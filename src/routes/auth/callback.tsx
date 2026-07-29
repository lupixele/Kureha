import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { supabase } from '../../auth/supabase-browser';
import { useEffect } from 'react';

export const Route = createFileRoute('/auth/callback')({
  component: Callback,
});

function Callback() {
  const search = useSearch({ from: '/auth/callback' });
  const navigate = useNavigate();

  useEffect(() => {
    // If Supabase redirected back successfully, the URL typically contains `#access_token=...`
    // or `?code=...`. The Supabase client automatically detects the hash/search
    // fragment on load if it's the standard flow, exchanging it for a session.

    // We listen for the auth state change to happen, or just check the session.
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate({ to: '/', replace: true });
      } else {
        // give it a tiny bit of time if the client is still parsing the hash
        setTimeout(async () => {
          const { data: delayedData } = await supabase.auth.getSession();
          if (delayedData.session) {
            navigate({ to: '/', replace: true });
          } else {
            console.error('No session found after callback');
            navigate({ to: '/login', replace: true });
          }
        }, 500);
      }
    };

    checkSession();
  }, [navigate]);

  return (
    <div>
      <p>Completing sign in...</p>
    </div>
  );
}