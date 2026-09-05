CREATE TYPE "public"."artwork_kind" AS ENUM('title_logo', 'cover', 'backdrop');--> statement-breakpoint
CREATE TYPE "public"."artwork_provider" AS ENUM('anilist', 'tmdb', 'fanart');--> statement-breakpoint
CREATE TYPE "public"."catalogue_review_reason" AS ENUM('ambiguous_branch', 'uncertain_anime', 'mapping_conflict', 'provider_conflict', 'unmatched_episode', 'schema_drift');--> statement-breakpoint
CREATE TYPE "public"."catalogue_review_status" AS ENUM('pending', 'accepted', 'rejected', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."refresh_cadence_tier" AS ENUM('airing_15m', 'upcoming_6h', 'daily', 'weekly', 'monthly', 'on_demand');--> statement-breakpoint
CREATE TYPE "public"."refresh_job_provider" AS ENUM('anilist', 'tmdb', 'anizip', 'fanart');--> statement-breakpoint
CREATE TYPE "public"."refresh_job_status" AS ENUM('queued', 'running', 'retry_wait', 'succeeded', 'dead');--> statement-breakpoint
CREATE TABLE "artwork_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_group_id" uuid NOT NULL,
	"installment_id" uuid,
	"provider" "artwork_provider" NOT NULL,
	"kind" "artwork_kind" NOT NULL,
	"provider_asset_id" text NOT NULL,
	"url" text NOT NULL,
	"language" text,
	"vote_score" double precision,
	"width" integer,
	"height" integer,
	"source_mapping_id" uuid,
	"payload_hash" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"last_successful_refresh_at" timestamp with time zone,
	"is_available" boolean DEFAULT true NOT NULL,
	CONSTRAINT "artwork_assets_provider_asset_kind_unique" UNIQUE("provider","provider_asset_id","kind"),
	CONSTRAINT "artwork_assets_fanart_logo_only" CHECK ("artwork_assets"."provider" <> 'fanart' OR "artwork_assets"."kind" = 'title_logo')
);
--> statement-breakpoint
CREATE TABLE "catalogue_review_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_group_id" uuid,
	"subject_provider" "provider" NOT NULL,
	"subject_provider_id" text NOT NULL,
	"reason" "catalogue_review_reason" NOT NULL,
	"status" "catalogue_review_status" DEFAULT 'pending' NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "media_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_installment_id" uuid NOT NULL,
	"target_provider" "provider" NOT NULL,
	"target_provider_id" text NOT NULL,
	"target_installment_id" uuid,
	"relation_type" text NOT NULL,
	"classification" text NOT NULL,
	"review_state" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_relations_edge_unique" UNIQUE("source_installment_id","target_provider","target_provider_id","relation_type"),
	CONSTRAINT "media_relations_classification_check" CHECK ("media_relations"."classification" IN ('mainline_candidate', 'extra', 'alternate', 'related', 'ignored')),
	CONSTRAINT "media_relations_review_state_check" CHECK ("media_relations"."review_state" IN ('not_required', 'pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "metadata_refresh_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "refresh_job_provider" NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"job_kind" text NOT NULL,
	"media_group_id" uuid,
	"priority" text DEFAULT 'background' NOT NULL,
	"cadence_tier" "refresh_cadence_tier" NOT NULL,
	"status" "refresh_job_status" DEFAULT 'queued' NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"error_code" text,
	"error_message" text,
	"last_succeeded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metadata_refresh_jobs_logical_key_unique" UNIQUE("provider","target_type","target_id","job_kind"),
	CONSTRAINT "metadata_refresh_jobs_priority_check" CHECK ("metadata_refresh_jobs"."priority" IN ('interactive', 'background'))
);
--> statement-breakpoint
CREATE TABLE "provider_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "refresh_job_provider" NOT NULL,
	"operation" text NOT NULL,
	"target_id" text NOT NULL,
	"outcome" text NOT NULL,
	"http_status" integer,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer NOT NULL,
	"response_content_hash" text,
	"error_class" text,
	"error_code" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_artwork_preferences" (
	"user_id" uuid NOT NULL,
	"media_group_id" uuid NOT NULL,
	"title_logo_asset_id" uuid,
	"cover_asset_id" uuid,
	"backdrop_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_artwork_preferences_user_id_media_group_id_pk" PRIMARY KEY("user_id","media_group_id")
);
--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "metadata_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "installments" ADD COLUMN "metadata_payload_hash" text;--> statement-breakpoint
ALTER TABLE "media_groups" ADD COLUMN "metadata_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_groups" ADD COLUMN "metadata_payload_hash" text;--> statement-breakpoint
ALTER TABLE "release_state_evidence" ADD COLUMN "payload_hash" text;--> statement-breakpoint
ALTER TABLE "artwork_assets" ADD CONSTRAINT "artwork_assets_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_assets" ADD CONSTRAINT "artwork_assets_installment_id_installments_id_fk" FOREIGN KEY ("installment_id") REFERENCES "public"."installments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_assets" ADD CONSTRAINT "artwork_assets_source_mapping_id_mapping_version_entries_id_fk" FOREIGN KEY ("source_mapping_id") REFERENCES "public"."mapping_version_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_review_items" ADD CONSTRAINT "catalogue_review_items_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalogue_review_items" ADD CONSTRAINT "catalogue_review_items_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relations" ADD CONSTRAINT "media_relations_source_installment_id_installments_id_fk" FOREIGN KEY ("source_installment_id") REFERENCES "public"."installments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_relations" ADD CONSTRAINT "media_relations_target_installment_id_installments_id_fk" FOREIGN KEY ("target_installment_id") REFERENCES "public"."installments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metadata_refresh_jobs" ADD CONSTRAINT "metadata_refresh_jobs_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artwork_preferences" ADD CONSTRAINT "user_artwork_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artwork_preferences" ADD CONSTRAINT "user_artwork_preferences_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artwork_preferences" ADD CONSTRAINT "user_artwork_preferences_title_logo_asset_id_artwork_assets_id_fk" FOREIGN KEY ("title_logo_asset_id") REFERENCES "public"."artwork_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artwork_preferences" ADD CONSTRAINT "user_artwork_preferences_cover_asset_id_artwork_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."artwork_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_artwork_preferences" ADD CONSTRAINT "user_artwork_preferences_backdrop_asset_id_artwork_assets_id_fk" FOREIGN KEY ("backdrop_asset_id") REFERENCES "public"."artwork_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_review_items_open_group_idx" ON "catalogue_review_items" USING btree ("reason","subject_provider","subject_provider_id","media_group_id") WHERE "catalogue_review_items"."status" = 'pending' AND "catalogue_review_items"."media_group_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_review_items_open_ungrouped_idx" ON "catalogue_review_items" USING btree ("reason","subject_provider","subject_provider_id") WHERE "catalogue_review_items"."status" = 'pending' AND "catalogue_review_items"."media_group_id" IS NULL;--> statement-breakpoint
CREATE INDEX "metadata_refresh_jobs_claim_idx" ON "metadata_refresh_jobs" USING btree ("status","next_attempt_at","priority");