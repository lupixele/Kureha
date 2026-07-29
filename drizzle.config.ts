import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DIRECT_URL;

if (!databaseUrl) {
  throw new Error('DIRECT_URL is required for Drizzle migrations');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
