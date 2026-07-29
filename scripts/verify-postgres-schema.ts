import 'dotenv/config';
import postgres from 'postgres';

const directUrl = process.env.DIRECT_URL;

if (!directUrl) {
  throw new Error('DIRECT_URL is required for schema verification');
}

const sql = postgres(directUrl, { prepare: false });

const testUserId = '00000000-0000-0000-0000-000000000001';
const trackedMediaId = 'schema-verify-movie';
const orphanMediaId = 'schema-verify-orphan';

async function tableExists(tableName: string) {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `;

  return rows[0]?.exists === true;
}

async function columnDefault(tableName: string, columnName: string) {
  const rows = await sql<{ column_default: string | null }[]>`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
  `;

  return rows[0]?.column_default ?? null;
}

async function cleanup() {
  await sql`
    DELETE FROM watched_episodes
    WHERE user_id = ${testUserId}
      AND media_id IN (${trackedMediaId}, ${orphanMediaId})
  `;
  await sql`
    DELETE FROM tracked_media
    WHERE user_id = ${testUserId}
      AND media_id IN (${trackedMediaId}, ${orphanMediaId})
  `;
}

async function main() {
  try {
    await cleanup();

    const hasTrackedMedia = await tableExists('tracked_media');
    const hasWatchedEpisodes = await tableExists('watched_episodes');

    if (!hasTrackedMedia) throw new Error('tracked_media table does not exist');
    if (!hasWatchedEpisodes) throw new Error('watched_episodes table does not exist');

    console.log('✓ tracked_media table exists');
    console.log('✓ watched_episodes table exists');

    const metadataSourceDefault = await columnDefault('tracked_media', 'metadata_source');
    if (!metadataSourceDefault?.includes('tmdb')) {
      throw new Error(`metadata_source default should include tmdb, got: ${metadataSourceDefault}`);
    }
    console.log(`✓ metadata_source default is ${metadataSourceDefault}`);

    let orphanRejected = false;
    try {
      await sql`
        INSERT INTO watched_episodes (
          user_id,
          media_id,
          season_number,
          episode_number,
          watched_at,
          rewatch_count
        ) VALUES (${testUserId}, ${orphanMediaId}, 0, 0, 1234567890, 1)
      `;
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('foreign key')) {
        orphanRejected = true;
      } else {
        throw error;
      }
    }

    if (!orphanRejected) {
      throw new Error('orphan watched_episodes insert was not rejected');
    }
    console.log('✓ orphan watched_episodes row rejected by foreign key');

    await sql`
      INSERT INTO tracked_media (
        user_id,
        media_id,
        media_type,
        added_at,
        release_state
      ) VALUES (${testUserId}, ${trackedMediaId}, 'movie', 1234567890, 'released')
    `;

    await sql`
      INSERT INTO watched_episodes (
        user_id,
        media_id,
        season_number,
        episode_number,
        watched_at,
        rewatch_count
      ) VALUES (${testUserId}, ${trackedMediaId}, 0, 0, 1234567890, 1)
    `;
    console.log('✓ watched_episodes row accepted when tracked_media parent exists');

    let duplicateRejected = false;
    try {
      await sql`
        INSERT INTO watched_episodes (
          user_id,
          media_id,
          season_number,
          episode_number,
          watched_at,
          rewatch_count
        ) VALUES (${testUserId}, ${trackedMediaId}, 0, 0, 1234567890, 1)
      `;
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('duplicate key')) {
        duplicateRejected = true;
      } else {
        throw error;
      }
    }

    if (!duplicateRejected) {
      throw new Error('duplicate watched_episodes primary key insert was not rejected');
    }
    console.log('✓ duplicate watched_episodes row rejected by primary key');

    await cleanup();
    console.log('✓ verification rows cleaned up');
  } finally {
    await sql.end();
  }
}

main().catch(async (error: unknown) => {
  console.error('Schema verification failed:');
  console.error(error);
  await cleanup().catch(() => undefined);
  await sql.end().catch(() => undefined);
  process.exit(1);
});
