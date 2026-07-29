"use client";

import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '../auth/supabase-browser';
import { useState } from 'react';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        // In local dev, window.location.origin is typically http://localhost:5173
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      // It will redirect on success
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to initiate Google sign-in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Sign in to Kureha</h1>
      <button onClick={handleLogin} disabled={loading}>
        {loading ? 'Signing in...' : 'Sign in with Google'}
      </button>
    </div>
  );
}