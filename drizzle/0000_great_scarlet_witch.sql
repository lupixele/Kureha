CREATE TABLE "tracked_media" (
	"user_id" text NOT NULL,
	"media_id" text NOT NULL,
	"media_type" text NOT NULL,
	"metadata_source" text DEFAULT 'tmdb' NOT NULL,
	"intent" text DEFAULT 'active' NOT NULL,
	"added_at" integer NOT NULL,
	"intent_changed_at" integer,
	"total_episodes" integer,
	"release_state" text NOT NULL,
	CONSTRAINT "tracked_media_user_id_media_id_pk" PRIMARY KEY("user_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "watched_episodes" (
	"user_id" text NOT NULL,
	"media_id" text NOT NULL,
	"season_number" integer DEFAULT 0 NOT NULL,
	"episode_number" integer NOT NULL,
	"watched_at" integer NOT NULL,
	"rewatch_count" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "watched_episodes_user_id_media_id_season_number_episode_number_pk" PRIMARY KEY("user_id","media_id","season_number","episode_number")
);
--> statement-breakpoint
ALTER TABLE "watched_episodes" ADD CONSTRAINT "watched_episodes_user_id_media_id_tracked_media_user_id_media_id_fk" FOREIGN KEY ("user_id","media_id") REFERENCES "public"."tracked_media"("user_id","media_id") ON DELETE no action ON UPDATE no action;