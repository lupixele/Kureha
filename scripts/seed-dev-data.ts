import 'dotenv/config';
import { db } from '../src/db/client';
import { trackedMedia } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { toDbTrackedMedia } from '../src/db/adapter';

async function seed() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: tsx scripts/seed-dev-data.ts <userId>');
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);

  const seedTitles = [
    {
      userId,
      mediaId: 'tmdb-84', // Kureha TVDB equivalent anime, etc
      mediaType: 'anime' as const,
      metadataSource: 'tmdb' as const,
      intent: 'active' as const,
      totalEpisodes: 24,
      releaseState: 'ended' as const,
      addedAt: now,
      intentChangedAt: null,
    },
    {
      userId,
      mediaId: 'tmdb-1396', // Breaking Bad, random example
      mediaType: 'series' as const,
      metadataSource: 'tmdb' as const,
      intent: 'active' as const,
      totalEpisodes: 62,
      releaseState: 'ended' as const,
      addedAt: now,
      intentChangedAt: null,
    },
    {
      userId,
      mediaId: 'tmdb-155', // The Dark Knight movie
      mediaType: 'movie' as const,
      metadataSource: 'tmdb' as const,
      intent: 'watch_later' as const,
      totalEpisodes: 1,
      releaseState: 'released' as const,
      addedAt: now,
      intentChangedAt: null,
    }
  ];

  console.log(`Seeding dev data for user ${userId}...`);

  for (const title of seedTitles) {
    const dbRow = toDbTrackedMedia(title);
    await db.insert(trackedMedia)
      .values(dbRow)
      .onConflictDoNothing({ target: [trackedMedia.userId, trackedMedia.mediaId] });
  }

  console.log('Seeding complete.');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
