CREATE TYPE "public"."installment_status" AS ENUM('not_yet_released', 'releasing', 'finished', 'cancelled', 'hiatus', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."mapping_status" AS ENUM('draft', 'active', 'rejected', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('movie', 'series', 'anime');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('tmdb', 'anilist', 'tvdb', 'mal', 'anidb');--> statement-breakpoint
CREATE TYPE "public"."provider_target" AS ENUM('tv', 'movie', 'anime', 'episode');--> statement-breakpoint
CREATE TYPE "public"."release_state" AS ENUM('upcoming', 'airing', 'between_seasons', 'hiatus', 'future_unknown', 'ended');--> statement-breakpoint
CREATE TYPE "public"."track_type" AS ENUM('mainline', 'alternate', 'extras');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'friends_only', 'public');--> statement-breakpoint
CREATE TABLE "continuity_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_group_id" uuid NOT NULL,
	"type" "track_type" DEFAULT 'mainline' NOT NULL,
	"title" text,
	"is_canonical" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"installment_id" uuid NOT NULL,
	"episode_number" integer NOT NULL,
	"is_extra" boolean DEFAULT false NOT NULL,
	"title" text,
	"runtime_minutes" integer,
	"air_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "episodes_installment_num_unique" UNIQUE("installment_id","episode_number"),
	CONSTRAINT "episodes_num_check" CHECK ("episodes"."episode_number" >= 0),
	CONSTRAINT "episodes_runtime_check" CHECK ("episodes"."runtime_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"continuity_track_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"title" text NOT NULL,
	"format" text NOT NULL,
	"status" "installment_status" NOT NULL,
	"next_airing_episode" integer,
	"next_airing_time" timestamp with time zone,
	"start_date" date,
	"end_date" date,
	"total_episodes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "installments_track_seq_unique" UNIQUE("continuity_track_id","sequence_number"),
	CONSTRAINT "installments_seq_check" CHECK ("installments"."sequence_number" >= 0),
	CONSTRAINT "installments_eps_check" CHECK ("installments"."total_episodes" >= 0),
	CONSTRAINT "installments_date_order" CHECK ("installments"."start_date" IS NULL OR "installments"."end_date" IS NULL OR "installments"."start_date" <= "installments"."end_date")
);
--> statement-breakpoint
CREATE TABLE "mapping_version_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mapping_version_id" uuid NOT NULL,
	"media_group_id" uuid,
	"installment_id" uuid,
	"episode_id" uuid,
	"provider" "provider" NOT NULL,
	"target_type" "provider_target" NOT NULL,
	"provider_id" text NOT NULL,
	"confidence" integer DEFAULT 100 NOT NULL,
	"source" text NOT NULL,
	"unmatched_history" boolean DEFAULT false NOT NULL,
	"review_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mapping_version_entry_single_target" CHECK (( ("mapping_version_entries"."media_group_id" IS NOT NULL)::int + ("mapping_version_entries"."installment_id" IS NOT NULL)::int + ("mapping_version_entries"."episode_id" IS NOT NULL)::int ) = 1),
	CONSTRAINT "confidence_bounds" CHECK ("mapping_version_entries"."confidence" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "mapping_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_group_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "mapping_status" DEFAULT 'draft' NOT NULL,
	"review_required" boolean DEFAULT false NOT NULL,
	"activated_at" timestamp with time zone,
	"created_by" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" "media_type" NOT NULL,
	"release_state" "release_state" NOT NULL,
	"review_required" boolean DEFAULT false NOT NULL,
	"derived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_name_change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"change_type" varchar(20) NOT NULL,
	"old_name" varchar(32),
	"new_name" varchar(32) NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(32) NOT NULL,
	"display_name" varchar(32) NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"username_updated_at" timestamp with time zone,
	"display_name_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "username_format" CHECK ("profiles"."username" ~ '^[a-z0-9_.]+$' AND "profiles"."username" NOT LIKE '%..%' AND length("profiles"."username") >= 2 AND "profiles"."username" NOT IN ('admin', 'system', 'root', 'kureha')),
	CONSTRAINT "display_name_length" CHECK (length("profiles"."display_name") >= 1)
);
--> statement-breakpoint
CREATE TABLE "provider_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_group_id" uuid,
	"installment_id" uuid,
	"episode_id" uuid,
	"provider" "provider" NOT NULL,
	"target_type" "provider_target" NOT NULL,
	"provider_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_target_id_unq" UNIQUE("provider","target_type","provider_id"),
	CONSTRAINT "provider_mapping_single_target" CHECK (( ("provider_mappings"."media_group_id" IS NOT NULL)::int + ("provider_mappings"."installment_id" IS NOT NULL)::int + ("provider_mappings"."episode_id" IS NOT NULL)::int ) = 1)
);
--> statement-breakpoint
CREATE TABLE "release_state_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_group_id" uuid,
	"installment_id" uuid,
	"episode_id" uuid,
	"mapping_version_id" uuid,
	"source" text NOT NULL,
	"source_id" text NOT NULL,
	"evidence_kind" text NOT NULL,
	"raw_status" text,
	"precision" text NOT NULL,
	"exact_time" timestamp with time zone,
	"exact_date" date,
	"payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "release_state_evidence_single_target" CHECK (( ("release_state_evidence"."media_group_id" IS NOT NULL)::int + ("release_state_evidence"."installment_id" IS NOT NULL)::int + ("release_state_evidence"."episode_id" IS NOT NULL)::int ) = 1)
);
--> statement-breakpoint
ALTER TABLE "continuity_tracks" ADD CONSTRAINT "continuity_tracks_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installments" ADD CONSTRAINT "installments_continuity_track_id_continuity_tracks_id_fk" FOREIGN KEY ("continuity_track_id") REFERENCES "public"."continuity_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_version_entries" ADD CONSTRAINT "mapping_version_entries_mapping_version_id_mapping_versions_id_fk" FOREIGN KEY ("mapping_version_id") REFERENCES "public"."mapping_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_version_entries" ADD CONSTRAINT "mapping_version_entries_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_version_entries" ADD CONSTRAINT "mapping_version_entries_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_version_entries" ADD CONSTRAINT "mapping_version_entries_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_versions" ADD CONSTRAINT "mapping_versions_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_name_change_events" ADD CONSTRAINT "profile_name_change_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_mappings" ADD CONSTRAINT "provider_mappings_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_mappings" ADD CONSTRAINT "provider_mappings_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_mappings" ADD CONSTRAINT "provider_mappings_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_state_evidence" ADD CONSTRAINT "release_state_evidence_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_state_evidence" ADD CONSTRAINT "release_state_evidence_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_state_evidence" ADD CONSTRAINT "release_state_evidence_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_state_evidence" ADD CONSTRAINT "release_state_evidence_mapping_version_id_mapping_versions_id_fk" FOREIGN KEY ("mapping_version_id") REFERENCES "public"."mapping_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "continuity_tracks_one_mainline_idx" ON "continuity_tracks" USING btree ("media_group_id") WHERE "continuity_tracks"."type" = 'mainline';--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_version_entries_unq" ON "mapping_version_entries" USING btree ("mapping_version_id","provider","target_type","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_versions_one_active_idx" ON "mapping_versions" USING btree ("media_group_id") WHERE "mapping_versions"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_lower_idx" ON "profiles" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "unq_provider_mapping_group" ON "provider_mappings" USING btree ("provider","media_group_id") WHERE "provider_mappings"."media_group_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_provider_mapping_installment" ON "provider_mappings" USING btree ("provider","installment_id") WHERE "provider_mappings"."installment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_provider_mapping_episode" ON "provider_mappings" USING btree ("provider","episode_id") WHERE "provider_mappings"."episode_id" IS NOT NULL;