-- One row per (user, title) the user is tracking
CREATE TABLE tracked_media (
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_type TEXT NOT NULL,           -- 'movie' | 'series' | 'anime'
  metadata_source TEXT NOT NULL DEFAULT 'tmdb',  -- 'tmdb' | 'tvdb'
  intent TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'paused' | 'watch_later' | 'dropped'
  added_at INTEGER NOT NULL,
  intent_changed_at INTEGER,          -- null if never changed from default
  total_episodes INTEGER,             -- null for movies; cached provider data
  release_state TEXT NOT NULL,        -- 'unreleased' | 'released' | 'ongoing' | 'ended'
  PRIMARY KEY (user_id, media_id)
);

-- One row per (user, title, episode) that's been marked watched
-- Movies use season_number = 0, episode_number = 0
CREATE TABLE watched_episodes (
  user_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  season_number INTEGER NOT NULL DEFAULT 0,
  episode_number INTEGER NOT NULL,
  watched_at INTEGER NOT NULL,        -- timestamp of most recent watch
  rewatch_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, media_id, season_number, episode_number),
  FOREIGN KEY (user_id, media_id) REFERENCES tracked_media(user_id, media_id)
);
