import { createFileRoute, Link } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

const getStatus = createServerFn({ method: 'GET' }).handler(async () => {
  return 'Phase 2 wiring scaffold ready';
});

export const Route = createFileRoute('/')({
  loader: () => getStatus(),
  component: HomePage,
});

function HomePage() {
  const status = Route.useLoaderData();

  return (
    <main>
      <h1>Kureha Library</h1>
      <p>Status: {status}</p>
      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px dashed #ccc' }}>
        <h3>Diagnostic Tooling</h3>
        <p>The actual wiring verification UI lives in the temporary diagnostic page below:</p>
        <Link to="/test-library">
          <button style={{ padding: '0.5rem 1rem' }}>Open Test Library</button>
        </Link>
      </div>
    </main>
  );
}