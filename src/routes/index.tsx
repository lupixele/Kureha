import { createFileRoute } from '@tanstack/react-router';
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
    </main>
  );
}