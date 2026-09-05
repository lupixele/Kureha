import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// M3 contract §§7, 19.51: exercise actual migrations, without providers or credentials.
const migrationDir = resolve(__dirname, '../../drizzle');
const journal = JSON.parse(readFileSync(resolve(migrationDir, 'meta/_journal.json'), 'utf8'));
const user = '10000000-0000-4000-8000-000000000001';
const group = '20000000-0000-4000-8000-000000000001';
const track = '30000000-0000-4000-8000-000000000001';
const installment = '40000000-0000-4000-8000-000000000001';
const episode = '50000000-0000-4000-8000-000000000001';
const asset = '60000000-0000-4000-8000-000000000001';

describe('M3-A additive migration contract (PGlite)', () => {
  let pg: PGlite;
  let preserved: Record<string, unknown[]>;
  const legacyTables = ['profiles', 'media_groups', 'continuity_tracks', 'installments', 'episodes',
    'user_media_state', 'canonical_watched_episodes', 'canonical_watched_movies', 'tracking_operations',
    'release_state_evidence', 'profile_name_change_events', 'mapping_versions', 'provider_mappings', 'mapping_version_entries'];

  beforeAll(async () => {
    pg = new PGlite();
    for (const entry of journal.entries.filter((e: { idx: number }) => e.idx <= 2)) {
      await pg.exec(readFileSync(resolve(migrationDir, `${entry.tag}.sql`), 'utf8'));
    }
    await pg.exec(`
      INSERT INTO profiles (id, username, display_name) VALUES ('${user}', 'm3_test', 'M3');
      INSERT INTO media_groups (id, title, type, release_state) VALUES ('${group}', 'Retained title', 'anime', 'airing');
      INSERT INTO continuity_tracks (id, media_group_id) VALUES ('${track}', '${group}');
      INSERT INTO installments (id, continuity_track_id, sequence_number, title, format, status)
        VALUES ('${installment}', '${track}', 1, 'Season 1', 'TV', 'releasing');
      INSERT INTO episodes (id, installment_id, episode_number) VALUES ('${episode}', '${installment}', 1);
      INSERT INTO user_media_state (user_id, media_group_id, in_library, intent) VALUES ('${user}', '${group}', true, 'paused');
      INSERT INTO canonical_watched_episodes (user_id, episode_id, rewatch_count) VALUES ('${user}', '${episode}', 3);
      INSERT INTO canonical_watched_movies (user_id, media_group_id) VALUES ('${user}', '${group}');
      INSERT INTO tracking_operations (user_id, operation_id, action, request_hash, result)
        VALUES ('${user}', '${episode}', 'mark_episode', 'fixture-hash', '{"ok":true}');
      INSERT INTO profile_name_change_events (user_id, change_type, new_name) VALUES ('${user}', 'display_name', 'M3');
      INSERT INTO mapping_versions (id, media_group_id, version_number, status) VALUES ('${asset}', '${group}', 1, 'active');
      INSERT INTO provider_mappings (media_group_id, provider, target_type, provider_id) VALUES ('${group}', 'anilist', 'anime', '1');
      INSERT INTO mapping_version_entries (id, mapping_version_id, media_group_id, provider, target_type, provider_id, source)
        VALUES ('${asset}', '${asset}', '${group}', 'anilist', 'anime', '1', 'fixture');
      INSERT INTO release_state_evidence (media_group_id, source, source_id, evidence_kind, precision, payload)
        VALUES ('${group}', 'anilist', '1', 'status', 'unknown', '{"status":"RELEASING"}');
    `);
    preserved = {};
    for (const table of legacyTables) preserved[table] = (await pg.query(`SELECT * FROM ${table}`)).rows;
    for (const entry of journal.entries.filter((e: { idx: number }) => e.idx > 2)) {
      await pg.exec(readFileSync(resolve(migrationDir, `${entry.tag}.sql`), 'utf8'));
    }
  });
  afterAll(async () => { await pg?.close(); });

  it('applies 0000 through 0003 and preserves every populated M1/M2 row', async () => {
    expect(journal.entries.map((e: { idx: number }) => e.idx)).toEqual([0, 1, 2, 3]);
    for (const table of legacyTables) {
      const columns = Object.keys(preserved[table][0] as object).map(c => `"${c}"`).join(', ');
      expect((await pg.query(`SELECT ${columns} FROM ${table}`)).rows).toEqual(preserved[table]);
    }
    for (const table of ['media_groups', 'installments']) {
      expect((await pg.query(`SELECT metadata_updated_at, metadata_payload_hash FROM ${table}`)).rows)
        .toEqual([{ metadata_updated_at: null, metadata_payload_hash: null }]);
    }
    expect((await pg.query('SELECT payload_hash FROM release_state_evidence')).rows).toEqual([{ payload_hash: null }]);
  });

  it('keeps the canonical provider enum unchanged and defines dedicated M3 enums exactly', async () => {
    const enums: Record<string, string[]> = {
      provider: ['tmdb', 'anilist', 'tvdb', 'mal', 'anidb'],
      artwork_provider: ['anilist', 'tmdb', 'fanart'],
      refresh_job_provider: ['anilist', 'tmdb', 'anizip', 'fanart'],
      refresh_cadence_tier: ['airing_15m', 'upcoming_6h', 'daily', 'weekly', 'monthly', 'on_demand'],
      refresh_job_status: ['queued', 'running', 'retry_wait', 'succeeded', 'dead'],
    };
    for (const [name, values] of Object.entries(enums)) {
      const result = await pg.query<{ enumlabel: string }>(`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = $1 ORDER BY enumsortorder`, [name]);
      expect(result.rows.map(r => r.enumlabel)).toEqual(values);
    }
  });

  describe('new catalogue constraints', () => {
    beforeEach(async () => {
      await pg.exec('TRUNCATE user_artwork_preferences, artwork_assets, media_relations, catalogue_review_items, metadata_refresh_jobs, provider_sync_runs CASCADE');
    });

    it('retains preview relations, deduplicates edges, and checks classification/review state', async () => {
      const insert = `INSERT INTO media_relations (source_installment_id, target_provider, target_provider_id, relation_type, classification, review_state, first_seen_at, last_seen_at)
        VALUES ('${installment}', 'anilist', 'next', 'SEQUEL', 'mainline_candidate', 'pending', now(), now())`;
      await pg.exec(insert);
      expect((await pg.query('SELECT target_installment_id FROM media_relations')).rows).toEqual([{ target_installment_id: null }]);
      await expect(pg.exec(insert)).rejects.toMatchObject({ code: '23505' });
      await expect(pg.exec("UPDATE media_relations SET classification = 'invalid'")).rejects.toMatchObject({ code: '23514' });
      await expect(pg.exec("UPDATE media_relations SET review_state = 'invalid'")).rejects.toMatchObject({ code: '23514' });
      await expect(pg.exec(`UPDATE media_relations SET target_installment_id = '${episode}'`)).rejects.toMatchObject({ code: '23503' });
    });

    it.each([null, group])('deduplicates pending review items with group %s while retaining closed history', async (groupId) => {
      const insert = `INSERT INTO catalogue_review_items (media_group_id, subject_provider, subject_provider_id, reason)
        VALUES (${groupId ? `'${groupId}'` : 'NULL'}, 'anilist', 'branch', 'ambiguous_branch')`;
      await pg.exec(insert);
      await expect(pg.exec(insert)).rejects.toMatchObject({ code: '23505' });
      for (const status of ['accepted', 'rejected', 'resolved']) {
        await pg.exec(`UPDATE catalogue_review_items SET status = '${status}' WHERE status = 'pending'`);
        await pg.exec(insert);
      }
      expect((await pg.query('SELECT * FROM catalogue_review_items')).rows).toHaveLength(4);
      await expect(pg.exec("UPDATE catalogue_review_items SET reason = 'invalid'")).rejects.toMatchObject({ code: '22P02' });
      await expect(pg.exec("UPDATE catalogue_review_items SET status = 'invalid'")).rejects.toMatchObject({ code: '22P02' });
    });

    it('limits Fanart to logos and deduplicates provider assets', async () => {
      const insert = `INSERT INTO artwork_assets (id, media_group_id, provider, provider_asset_id, kind, url, first_seen_at, last_seen_at)
        VALUES ('${asset}', '${group}', 'fanart', 'logo-1', 'title_logo', '/logo.png', now(), now())`;
      await pg.exec(insert);
      await expect(pg.exec("UPDATE artwork_assets SET kind = 'cover'")).rejects.toMatchObject({ code: '23514' });
      await expect(pg.exec("UPDATE artwork_assets SET kind = 'backdrop'")).rejects.toMatchObject({ code: '23514' });
      await expect(pg.exec(insert.replace(`'${asset}'`, 'gen_random_uuid()'))).rejects.toMatchObject({ code: '23505' });
    });

    it('keeps an unavailable preference, then nulls it only on physical asset deletion', async () => {
      await pg.exec(`INSERT INTO artwork_assets (id, media_group_id, provider, provider_asset_id, kind, url, first_seen_at, last_seen_at)
        VALUES ('${asset}', '${group}', 'anilist', 'cover-1', 'cover', '/cover.png', now(), now());
        INSERT INTO user_artwork_preferences (user_id, media_group_id, cover_asset_id) VALUES ('${user}', '${group}', '${asset}');
        UPDATE artwork_assets SET is_available = false;`);
      expect((await pg.query('SELECT cover_asset_id FROM user_artwork_preferences')).rows).toEqual([{ cover_asset_id: asset }]);
      await expect(pg.exec(`INSERT INTO user_artwork_preferences (user_id, media_group_id) VALUES ('${user}', '${group}')`)).rejects.toMatchObject({ code: '23505' });
      await pg.exec('DELETE FROM artwork_assets');
      expect((await pg.query('SELECT cover_asset_id FROM user_artwork_preferences')).rows).toEqual([{ cover_asset_id: null }]);
    });

    it('deduplicates logical refresh jobs, validates provider/cadence/status, and indexes claims', async () => {
      const insert = `INSERT INTO metadata_refresh_jobs (provider, target_type, target_id, job_kind, cadence_tier)
        VALUES ('anizip', 'anime', '1', 'episodes', 'daily')`;
      await pg.exec(insert);
      await expect(pg.exec(insert)).rejects.toMatchObject({ code: '23505' });
      expect((await pg.query('SELECT status, attempts, priority FROM metadata_refresh_jobs')).rows)
        .toEqual([{ status: 'queued', attempts: 0, priority: 'background' }]);
      for (const column of ['provider', 'cadence_tier', 'status']) {
        await expect(pg.exec(`UPDATE metadata_refresh_jobs SET ${column} = 'invalid'`)).rejects.toMatchObject({ code: '22P02' });
      }
      await expect(pg.exec("UPDATE metadata_refresh_jobs SET priority = 'invalid'")).rejects.toMatchObject({ code: '23514' });
      const indexes = await pg.query<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE tablename = 'metadata_refresh_jobs'");
      expect(indexes.rows.some(r => r.indexdef.includes('(status, next_attempt_at, priority)'))).toBe(true);
    });

    it('stores normalized sync provenance without raw-payload or credential columns', async () => {
      await pg.exec(`INSERT INTO provider_sync_runs (provider, operation, target_id, outcome, http_status, retry_count, duration_ms, response_content_hash)
        VALUES ('fanart', 'artwork', 'fixture-id', 'succeeded', 200, 0, 12, 'fixture-hash')`);
      const result = await pg.query<Record<string, unknown>>('SELECT * FROM provider_sync_runs');
      expect(result.rows).toHaveLength(1);
      expect(Object.keys(result.rows[0])).not.toEqual(expect.arrayContaining(['payload']));
      expect(Object.keys(result.rows[0]).join(' ')).not.toMatch(/authorization|api_key|raw_payload|query/);
    });

    it('preserves relations/artwork when optional targets disappear and cascades owned rows', async () => {
      // Roll back destructive fixture operations so M1/M2 rows remain available to other tests.
      await pg.exec('BEGIN');
      try {
        await pg.exec(`
          INSERT INTO installments (id, continuity_track_id, sequence_number, title, format, status)
            VALUES ('${asset}', '${track}', 2, 'Sequel', 'TV', 'unknown');
          INSERT INTO media_relations (source_installment_id, target_provider, target_provider_id, target_installment_id, relation_type, classification, review_state, first_seen_at, last_seen_at)
            VALUES ('${installment}', 'anilist', '2', '${asset}', 'SEQUEL', 'related', 'not_required', now(), now());
          INSERT INTO artwork_assets (id, media_group_id, installment_id, source_mapping_id, provider, provider_asset_id, kind, url, first_seen_at, last_seen_at)
            VALUES ('${asset}', '${group}', '${asset}', '${asset}', 'anilist', '1', 'cover', '/cover.png', now(), now());
          INSERT INTO user_artwork_preferences (user_id, media_group_id, cover_asset_id) VALUES ('${user}', '${group}', '${asset}');
          INSERT INTO catalogue_review_items (media_group_id, subject_provider, subject_provider_id, reason, resolved_by)
            VALUES ('${group}', 'anilist', '1', 'mapping_conflict', '${user}');
          INSERT INTO metadata_refresh_jobs (provider, target_type, target_id, job_kind, cadence_tier, media_group_id)
            VALUES ('anilist', 'anime', '1', 'metadata', 'daily', '${group}');
          DELETE FROM installments WHERE id = '${asset}';
          DELETE FROM mapping_version_entries WHERE id = '${asset}';
        `);
        expect((await pg.query('SELECT target_installment_id FROM media_relations')).rows).toEqual([{ target_installment_id: null }]);
        expect((await pg.query('SELECT installment_id, source_mapping_id FROM artwork_assets')).rows)
          .toEqual([{ installment_id: null, source_mapping_id: null }]);
        await pg.exec(`DELETE FROM profiles WHERE id = '${user}'`);
        expect((await pg.query('SELECT * FROM user_artwork_preferences')).rows).toHaveLength(0);
        expect((await pg.query('SELECT resolved_by FROM catalogue_review_items')).rows).toEqual([{ resolved_by: null }]);
        await pg.exec(`DELETE FROM media_groups WHERE id = '${group}'`);
        for (const table of ['media_relations', 'artwork_assets', 'catalogue_review_items', 'metadata_refresh_jobs']) {
          expect((await pg.query(`SELECT * FROM ${table}`)).rows).toHaveLength(0);
        }
      } finally {
        await pg.exec('ROLLBACK');
      }
    });

    it('defines all preference asset FKs as SET NULL and owner/group FKs as CASCADE', async () => {
      const result = await pg.query<{ column_name: string; delete_action: string }>(`
        SELECT a.attname AS column_name, c.confdeltype AS delete_action
        FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
        WHERE c.conrelid = 'user_artwork_preferences'::regclass AND c.contype = 'f'`);
      expect(Object.fromEntries(result.rows.map(r => [r.column_name, r.delete_action]))).toEqual({
        user_id: 'c', media_group_id: 'c', title_logo_asset_id: 'n', cover_asset_id: 'n', backdrop_asset_id: 'n',
      });
    });
  });
});
