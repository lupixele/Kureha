import { boolean, check, foreignKey, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, unique, uniqueIndex, uuid, varchar, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { Intent, MetadataSource, TrackedMedia } from '../core/types';

// ENUMS

export const visibilityEnum = pgEnum('visibility', ['private', 'friends_only', 'public']);
export const releaseStateEnum = pgEnum('release_state', ['upcoming', 'airing', 'between_seasons', 'hiatus', 'future_unknown', 'ended']);
export const installmentStatusEnum = pgEnum('installment_status', ['not_yet_released', 'releasing', 'finished', 'cancelled', 'hiatus', 'unknown']);
export const providerEnum = pgEnum('provider', ['tmdb', 'anilist', 'tvdb', 'mal', 'anidb']);
export const providerTargetEnum = pgEnum('provider_target', ['tv', 'movie', 'anime', 'episode']);
export const trackTypeEnum = pgEnum('track_type', ['mainline', 'alternate', 'extras']);
export const mediaTypeEnum = pgEnum('media_type', ['movie', 'series', 'anime']);
export const mappingStatusEnum = pgEnum('mapping_status', ['draft', 'active', 'rejected', 'superseded']);

// IDENTITIES (M1 Canonical Schema)

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(), // Tied to auth.users (Supabase)
  username: varchar('username', { length: 32 }).notNull(), // lowercase Discord-style
  displayName: varchar('display_name', { length: 32 }).notNull(),
  visibility: visibilityEnum('visibility').notNull().default('private'),
  usernameUpdatedAt: timestamp('username_updated_at', { withTimezone: true }),
  displayNameUpdatedAt: timestamp('display_name_updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('profiles_username_lower_idx').on(sql`lower(${table.username})`),
  check('username_format', sql`${table.username} ~ '^[a-z0-9_.]+$' AND ${table.username} NOT LIKE '%..%' AND length(${table.username}) >= 2 AND ${table.username} NOT IN ('admin', 'system', 'root', 'kureha')`),
  check('display_name_length', sql`length(${table.displayName}) >= 1`)
]);

export const profileNameChangeEvents = pgTable('profile_name_change_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  changeType: varchar('change_type', { length: 20 }).notNull(), // 'username' or 'display_name'
  oldName: varchar('old_name', { length: 32 }),
  newName: varchar('new_name', { length: 32 }).notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mediaGroups = pgTable('media_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  type: mediaTypeEnum('type').notNull(),
  releaseState: releaseStateEnum('release_state').notNull(),
  reviewRequired: boolean('review_required').notNull().default(false),
  derivedAt: timestamp('derived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const continuityTracks = pgTable('continuity_tracks', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaGroupId: uuid('media_group_id').notNull().references(() => mediaGroups.id, { onDelete: 'cascade' }),
  type: trackTypeEnum('type').notNull().default('mainline'),
  title: text('title'),
  isCanonical: boolean('is_canonical').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('continuity_tracks_one_mainline_idx').on(table.mediaGroupId).where(sql`${table.type} = 'mainline'`)
]);

export const installments = pgTable('installments', {
  id: uuid('id').primaryKey().defaultRandom(),
  continuityTrackId: uuid('continuity_track_id').notNull().references(() => continuityTracks.id, { onDelete: 'cascade' }),
  sequenceNumber: integer('sequence_number').notNull(),
  title: text('title').notNull(),
  format: text('format').notNull(),
  status: installmentStatusEnum('status').notNull(),
  nextAiringEpisode: integer('next_airing_episode'),
  nextAiringTime: timestamp('next_airing_time', { withTimezone: true }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  totalEpisodes: integer('total_episodes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('installments_track_seq_unique').on(table.continuityTrackId, table.sequenceNumber),
  check('installments_seq_check', sql`${table.sequenceNumber} >= 0`),
  check('installments_eps_check', sql`${table.totalEpisodes} >= 0`),
  check('installments_date_order', sql`${table.startDate} IS NULL OR ${table.endDate} IS NULL OR ${table.startDate} <= ${table.endDate}`)
]);

export const episodes = pgTable('episodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  installmentId: uuid('installment_id').notNull().references(() => installments.id, { onDelete: 'cascade' }),
  episodeNumber: integer('episode_number').notNull(),
  isExtra: boolean('is_extra').notNull().default(false),
  title: text('title'),
  runtimeMinutes: integer('runtime_minutes'),
  airDate: date('air_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('episodes_installment_num_unique').on(table.installmentId, table.episodeNumber),
  check('episodes_num_check', sql`${table.episodeNumber} >= 0`),
  check('episodes_runtime_check', sql`${table.runtimeMinutes} > 0`)
]);

export const mappingVersions = pgTable('mapping_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaGroupId: uuid('media_group_id').notNull().references(() => mediaGroups.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  status: mappingStatusEnum('status').notNull().default('draft'),
  reviewRequired: boolean('review_required').notNull().default(false),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  createdBy: uuid('created_by'), // nullable for system-generated
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('mapping_versions_one_active_idx').on(table.mediaGroupId).where(sql`${table.status} = 'active'`)
]);

export const providerMappings = pgTable('provider_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaGroupId: uuid('media_group_id').references(() => mediaGroups.id, { onDelete: 'cascade' }),
  installmentId: uuid('installment_id').references(() => installments.id, { onDelete: 'cascade' }),
  episodeId: uuid('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  provider: providerEnum('provider').notNull(),
  targetType: providerTargetEnum('target_type').notNull(),
  providerId: text('provider_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('provider_target_id_unq').on(table.provider, table.targetType, table.providerId),
  uniqueIndex('unq_provider_mapping_group').on(table.provider, table.mediaGroupId).where(sql`${table.mediaGroupId} IS NOT NULL`),
  uniqueIndex('unq_provider_mapping_installment').on(table.provider, table.installmentId).where(sql`${table.installmentId} IS NOT NULL`),
  uniqueIndex('unq_provider_mapping_episode').on(table.provider, table.episodeId).where(sql`${table.episodeId} IS NOT NULL`),
  check('provider_mapping_single_target', sql`( (${table.mediaGroupId} IS NOT NULL)::int + (${table.installmentId} IS NOT NULL)::int + (${table.episodeId} IS NOT NULL)::int ) = 1`)
]);

export const mappingVersionEntries = pgTable('mapping_version_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  mappingVersionId: uuid('mapping_version_id').notNull().references(() => mappingVersions.id, { onDelete: 'cascade' }),
  mediaGroupId: uuid('media_group_id').references(() => mediaGroups.id, { onDelete: 'cascade' }),
  installmentId: uuid('installment_id').references(() => installments.id, { onDelete: 'cascade' }),
  episodeId: uuid('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  provider: providerEnum('provider').notNull(),
  targetType: providerTargetEnum('target_type').notNull(),
  providerId: text('provider_id').notNull(),
  confidence: integer('confidence').notNull().default(100),
  source: text('source').notNull(),
  unmatchedHistory: boolean('unmatched_history').notNull().default(false),
  reviewRequired: boolean('review_required').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('mapping_version_entries_unq').on(table.mappingVersionId, table.provider, table.targetType, table.providerId),
  check('mapping_version_entry_single_target', sql`( (${table.mediaGroupId} IS NOT NULL)::int + (${table.installmentId} IS NOT NULL)::int + (${table.episodeId} IS NOT NULL)::int ) = 1`),
  check('confidence_bounds', sql`${table.confidence} BETWEEN 0 AND 100`)
]);

export const releaseStateEvidence = pgTable('release_state_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  mediaGroupId: uuid('media_group_id').references(() => mediaGroups.id, { onDelete: 'cascade' }),
  installmentId: uuid('installment_id').references(() => installments.id, { onDelete: 'cascade' }),
  episodeId: uuid('episode_id').references(() => episodes.id, { onDelete: 'cascade' }),
  mappingVersionId: uuid('mapping_version_id').references(() => mappingVersions.id, { onDelete: 'set null' }),
  source: text('source').notNull(),
  sourceId: text('source_id').notNull(),
  evidenceKind: text('evidence_kind').notNull(),
  rawStatus: text('raw_status'),
  precision: text('precision').notNull(),
  exactTime: timestamp('exact_time', { withTimezone: true }),
  exactDate: date('exact_date'),
  payload: jsonb('payload'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (table) => [
  check('release_state_evidence_single_target', sql`( (${table.mediaGroupId} IS NOT NULL)::int + (${table.installmentId} IS NOT NULL)::int + (${table.episodeId} IS NOT NULL)::int ) = 1`)
]);

// LEGACY (Pre-M1 compatibility layers for tests & tracking logic)
// Types redefined temporarily here if they differ from original core/types to avoid importing broken deps
export type ReleaseStateLegacy = 'unreleased' | 'released' | 'ongoing' | 'ended';

export const trackedMedia = pgTable(
  'tracked_media',
  {
    userId: text('user_id').notNull(),
    mediaId: text('media_id').notNull(),
    mediaType: text('media_type').notNull().$type<TrackedMedia['mediaType']>(),
    metadataSource: text('metadata_source').notNull().default('tmdb').$type<MetadataSource>(),
    intent: text('intent').notNull().default('active').$type<Intent>(),
    addedAt: integer('added_at').notNull(),
    intentChangedAt: integer('intent_changed_at'),
    totalEpisodes: integer('total_episodes'),
    releaseState: text('release_state').notNull().$type<ReleaseStateLegacy>(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mediaId] }),
  ],
);

export const watchedEpisodes = pgTable(
  'watched_episodes',
  {
    userId: text('user_id').notNull(),
    mediaId: text('media_id').notNull(),
    seasonNumber: integer('season_number').notNull().default(0),
    episodeNumber: integer('episode_number').notNull(),
    watchedAt: integer('watched_at').notNull(),
    rewatchCount: integer('rewatch_count').notNull().default(1),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.mediaId, table.seasonNumber, table.episodeNumber],
    }),
    foreignKey({
      columns: [table.userId, table.mediaId],
      foreignColumns: [trackedMedia.userId, trackedMedia.mediaId],
    }),
  ],
);

export type TrackedMediaRow = typeof trackedMedia.$inferSelect;
export type NewTrackedMediaRow = typeof trackedMedia.$inferInsert;
export type WatchedEpisodeRow = typeof watchedEpisodes.$inferSelect;
export type NewWatchedEpisodeRow = typeof watchedEpisodes.$inferInsert;

// Types for new M1 identities
export type ProfileRow = typeof profiles.$inferSelect;
export type ProfileNameChangeEventRow = typeof profileNameChangeEvents.$inferSelect;
export type MediaGroupRow = typeof mediaGroups.$inferSelect;
export type ContinuityTrackRow = typeof continuityTracks.$inferSelect;
export type InstallmentRow = typeof installments.$inferSelect;
export type EpisodeRow = typeof episodes.$inferSelect;
export type MappingVersionRow = typeof mappingVersions.$inferSelect;
export type ProviderMappingRow = typeof providerMappings.$inferSelect;
export type MappingVersionEntryRow = typeof mappingVersionEntries.$inferSelect;
export type ReleaseStateEvidenceRow = typeof releaseStateEvidence.$inferSelect;
