import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Database Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create an in-memory database for testing the schema
    db = new Database(':memory:');

    // Load schema
    const schemaSql = fs.readFileSync(path.join(__dirname, '../src/core/schema.sql'), 'utf8');
    db.exec(schemaSql);
  });

  afterEach(() => {
    db.close();
  });

  it('should create tracked_media table successfully', () => {
    const stmt = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='tracked_media';
    `);
    const table = stmt.get();
    expect(table).toBeDefined();
  });

  it('should create watched_episodes table successfully', () => {
    const stmt = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='watched_episodes';
    `);
    const table = stmt.get();
    expect(table).toBeDefined();
  });

  it('should enforce foreign key constraint on watched_episodes', () => {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    const insertEpisode = db.prepare(`
      INSERT INTO watched_episodes (user_id, media_id, season_number, episode_number, watched_at, rewatch_count)
      VALUES ('test-user', 'movie-1', 0, 0, 123456789, 1)
    `);

    // Should fail because there is no corresponding tracked_media
    expect(() => insertEpisode.run()).toThrowError(/FOREIGN KEY constraint failed/);

    // Now add the tracked_media
    const insertMedia = db.prepare(`
      INSERT INTO tracked_media (user_id, media_id, media_type, added_at, release_state)
      VALUES ('test-user', 'movie-1', 'movie', 123456789, 'released')
    `);
    insertMedia.run();

    // Now it should succeed
    expect(() => insertEpisode.run()).not.toThrow();
  });

  it('should enforce primary key uniqueness on tracked_media', () => {
    const insertMedia = db.prepare(`
      INSERT INTO tracked_media (user_id, media_id, media_type, added_at, release_state)
      VALUES ('test-user', 'movie-1', 'movie', 123456789, 'released')
    `);
    insertMedia.run();

    expect(() => insertMedia.run()).toThrowError(/UNIQUE constraint failed: tracked_media.user_id, tracked_media.media_id/);
  });

  it('should enforce primary key uniqueness on watched_episodes', () => {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    const insertMedia = db.prepare(`
      INSERT INTO tracked_media (user_id, media_id, media_type, added_at, release_state)
      VALUES ('test-user', 'movie-1', 'movie', 123456789, 'released')
    `);
    insertMedia.run();

    const insertEpisode = db.prepare(`
      INSERT INTO watched_episodes (user_id, media_id, season_number, episode_number, watched_at, rewatch_count)
      VALUES ('test-user', 'movie-1', 1, 1, 123456789, 1)
    `);
    insertEpisode.run();

    expect(() => insertEpisode.run()).toThrowError(/UNIQUE constraint failed: watched_episodes.user_id, watched_episodes.media_id, watched_episodes.season_number, watched_episodes.episode_number/);
  });
});
