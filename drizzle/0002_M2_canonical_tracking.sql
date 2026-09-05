
CREATE TYPE "public"."intent" AS ENUM('active', 'paused', 'watch_later', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."tracking_action" AS ENUM('mark_episode', 'unmark_episode', 'mark_movie', 'unmark_movie', 'add_to_library', 'remove_from_library', 'set_intent', 'delete_tracking');--> statement-breakpoint
CREATE TABLE "canonical_watched_episodes" (
	"user_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"first_watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rewatch_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_watched_episodes_user_id_episode_id_pk" PRIMARY KEY("user_id","episode_id"),
	CONSTRAINT "canonical_watched_episodes_rewatch_count" CHECK ("canonical_watched_episodes"."rewatch_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "canonical_watched_movies" (
	"user_id" uuid NOT NULL,
	"media_group_id" uuid NOT NULL,
	"first_watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rewatch_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canonical_watched_movies_user_id_media_group_id_pk" PRIMARY KEY("user_id","media_group_id"),
	CONSTRAINT "canonical_watched_movies_rewatch_count" CHECK ("canonical_watched_movies"."rewatch_count" >= 1)
);
--> statement-breakpoint
CREATE TABLE "tracking_operations" (
	"user_id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"action" "tracking_action" NOT NULL,
	"request_hash" text NOT NULL,
	"result" jsonb,
	"completed_at" timestamp with time zone,
	CONSTRAINT "tracking_operations_user_id_operation_id_pk" PRIMARY KEY("user_id","operation_id")
);
--> statement-breakpoint
CREATE TABLE "user_media_state" (
	"user_id" uuid NOT NULL,
	"media_group_id" uuid NOT NULL,
	"in_library" boolean DEFAULT false NOT NULL,
	"intent" "intent" DEFAULT 'active' NOT NULL,
	"first_added_at" timestamp with time zone,
	"last_added_at" timestamp with time zone,
	"membership_changed_at" timestamp with time zone,
	"intent_changed_at" timestamp with time zone,
	"last_activity_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_media_state_user_id_media_group_id_pk" PRIMARY KEY("user_id","media_group_id")
);
--> statement-breakpoint
ALTER TABLE "tracked_media" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "watched_episodes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "tracked_media" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "watched_episodes" CASCADE;--> statement-breakpoint
ALTER TABLE "canonical_watched_episodes" ADD CONSTRAINT "canonical_watched_episodes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_watched_episodes" ADD CONSTRAINT "canonical_watched_episodes_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_watched_movies" ADD CONSTRAINT "canonical_watched_movies_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canonical_watched_movies" ADD CONSTRAINT "canonical_watched_movies_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_operations" ADD CONSTRAINT "tracking_operations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_media_state" ADD CONSTRAINT "user_media_state_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_media_state" ADD CONSTRAINT "user_media_state_media_group_id_media_groups_id_fk" FOREIGN KEY ("media_group_id") REFERENCES "public"."media_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mapping_versions" ADD CONSTRAINT "mapping_versions_media_group_id_version_number_unique" UNIQUE("media_group_id","version_number");