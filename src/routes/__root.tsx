"use client";

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate, createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { supabase } from '../auth/supabase-browser';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Kureha' },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <RootDocument>
      <div style={{ fontFamily: 'sans-serif', margin: '2rem' }}>
        {loading ? (
          <div>Loading...</div>
        ) : !session ? (
          <div>
            <p>You are not signed in.</p>
            <button onClick={() => navigate({ to: '/login' })}>Go to Login</button>
            <hr style={{ margin: '2rem 0' }} />
            <Outlet />
          </div>
        ) : (
          <div>
            <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span>Logged in as: {session.user.email}</span>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: '/login' });
                }}
              >
                Sign out
              </button>
            </nav>
            <hr style={{ margin: '2rem 0' }} />
            <Outlet />
          </div>
        )}
      </div>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}