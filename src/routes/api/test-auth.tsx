import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { getAuthenticatedUser } from '../../auth/auth.functions';

type AuthStatus =
  | { state: 'checking' }
  | { state: 'error'; error: string }
  | { state: 'complete'; result: Awaited<ReturnType<typeof getAuthenticatedUser>> };

export const Route = createFileRoute('/api/test-auth')({
  component: TestAuthPage,
});

function TestAuthPage() {
  const [status, setStatus] = useState<AuthStatus>({ state: 'checking' });

  useEffect(() => {
    getAuthenticatedUser()
      .then((result) => setStatus({ state: 'complete', result }))
      .catch((error: unknown) => {
        setStatus({
          state: 'error',
          error: error instanceof Error ? error.message : 'Authentication check failed',
        });
      });
  }, []);

  return (
    <div>
      <h2>Auth Check Endpoint</h2>
      <pre>
        {status.state === 'checking'
          ? 'Checking authenticated session...'
          : status.state === 'error'
            ? JSON.stringify({ ok: false, error: status.error }, null, 2)
            : JSON.stringify(status.result, null, 2)}
      </pre>
    </div>
  );
}
