CREATE TABLE "asset_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"variant_kind" text NOT NULL,
	"r2_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"content_hash" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "asset_variants_r2_key_unique" UNIQUE("r2_key"),
	CONSTRAINT "asset_variants_variant_kind_check" CHECK ("asset_variants"."variant_kind" in ('thumbnail', 'proxy', 'waveform', 'poster', 'audio')),
	CONSTRAINT "asset_variants_byte_size_check" CHECK ("asset_variants"."byte_size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"r2_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"storage_bucket" text DEFAULT 'neonix-user-assets' NOT NULL,
	"original_filename" text,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp,
	"preview_key" text,
	"preview_status" text DEFAULT 'unsupported' NOT NULL,
	"source_duration_ms" bigint,
	"source_width" integer,
	"source_height" integer,
	"has_audio" boolean,
	"preview_version" integer,
	"preview_error" text,
	"media_status" text DEFAULT 'not_required' NOT NULL,
	CONSTRAINT "assets_r2_key_unique" UNIQUE("r2_key"),
	CONSTRAINT "assets_byte_size_check" CHECK ("assets"."byte_size" >= 0),
	CONSTRAINT "assets_kind_check" CHECK ("assets"."kind" in ('image', 'video', 'audio', 'font', 'other')),
	CONSTRAINT "assets_status_check" CHECK ("assets"."status" in ('uploading', 'ready', 'failed', 'deleting', 'deleted')),
	CONSTRAINT "assets_preview_status_check" CHECK ("assets"."preview_status" in ('pending', 'ready', 'failed', 'unsupported')),
	CONSTRAINT "assets_media_status_check" CHECK ("assets"."media_status" in ('not_required', 'queued', 'processing', 'ready', 'partial', 'failed')),
	CONSTRAINT "assets_preview_metadata_check" CHECK (("assets"."source_duration_ms" is null or "assets"."source_duration_ms" >= 0)
      and ("assets"."source_width" is null or "assets"."source_width" > 0)
      and ("assets"."source_height" is null or "assets"."source_height" > 0)
      and ("assets"."preview_version" is null or "assets"."preview_version" >= 1)
      and (("assets"."preview_status" in ('pending', 'ready') and "assets"."preview_key" is not null) or "assets"."preview_status" in ('failed', 'unsupported')))
);
--> statement-breakpoint
CREATE TABLE "media_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"idempotency_key" text NOT NULL,
	"source_integrity" text NOT NULL,
	"pipeline_version" integer DEFAULT 1 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"streams_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"derivatives_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"media_kind" text DEFAULT 'video' NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp,
	"last_error_code" text,
	"source_content_hash" text,
	CONSTRAINT "media_jobs_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "media_jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "media_jobs_status_check" CHECK ("media_jobs"."status" in ('queued', 'processing', 'retryable', 'ready', 'partial', 'failed')),
	CONSTRAINT "media_jobs_pipeline_version_check" CHECK ("media_jobs"."pipeline_version" >= 1),
	CONSTRAINT "media_jobs_attempt_count_check" CHECK ("media_jobs"."attempt_count" >= 0),
	CONSTRAINT "media_jobs_media_kind_check" CHECK ("media_jobs"."media_kind" in ('audio', 'video'))
);
--> statement-breakpoint
CREATE TABLE "object_deletion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"run_after" timestamp DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"locked_at" timestamp,
	"last_error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "object_deletion_jobs_entity_type_check" CHECK ("object_deletion_jobs"."entity_type" in ('asset', 'asset_variant', 'project_export', 'upload')),
	CONSTRAINT "object_deletion_jobs_status_check" CHECK ("object_deletion_jobs"."status" in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "object_deletion_jobs_attempt_count_check" CHECK ("object_deletion_jobs"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_assets" (
	"project_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"attached_by" text NOT NULL,
	"attached_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_assets_project_id_asset_id_pk" PRIMARY KEY("project_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"expected_byte_size" bigint,
	"expected_mime_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expected_preview_byte_size" bigint,
	"expected_preview_mime_type" text,
	"preview_key" text,
	CONSTRAINT "upload_sessions_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "upload_sessions_status_check" CHECK ("upload_sessions"."status" in ('pending', 'uploading', 'completed', 'expired', 'failed')),
	CONSTRAINT "upload_sessions_expected_byte_size_check" CHECK ("upload_sessions"."expected_byte_size" is null or "upload_sessions"."expected_byte_size" >= 0),
	CONSTRAINT "upload_sessions_expected_preview_byte_size_check" CHECK ("upload_sessions"."expected_preview_byte_size" is null or "upload_sessions"."expected_preview_byte_size" > 0),
	CONSTRAINT "upload_sessions_completed_check" CHECK (("upload_sessions"."status" <> 'completed') or "upload_sessions"."completed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "asset_variants" ADD CONSTRAINT "asset_variants_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_jobs" ADD CONSTRAINT "media_jobs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_attached_by_user_id_fk" FOREIGN KEY ("attached_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_variants_asset_kind_uidx" ON "asset_variants" USING btree ("asset_id","variant_kind");--> statement-breakpoint
CREATE INDEX "asset_variants_asset_idx" ON "asset_variants" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "assets_workspace_idx" ON "assets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "assets_workspace_status_idx" ON "assets" USING btree ("workspace_id","status","created_at" DESC NULLS LAST) WHERE "assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "assets_preview_status_idx" ON "assets" USING btree ("workspace_id","preview_status") WHERE "assets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "assets_media_status_idx" ON "assets" USING btree ("workspace_id","media_status","created_at" DESC NULLS LAST) WHERE "assets"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_font_assets_filename_uidx" ON "assets" USING btree ("workspace_id",lower(btrim("original_filename"))) WHERE "assets"."kind" = 'font' and "assets"."original_filename" is not null and "assets"."deleted_at" is null and "assets"."status" in ('uploading', 'ready');--> statement-breakpoint
CREATE UNIQUE INDEX "user_font_assets_content_hash_uidx" ON "assets" USING btree ("workspace_id","content_hash") WHERE "assets"."kind" = 'font' and "assets"."content_hash" not like 'pending:%' and "assets"."deleted_at" is null and "assets"."status" = 'ready';--> statement-breakpoint
CREATE INDEX "media_jobs_queue_idx" ON "media_jobs" USING btree ("status","created_at") WHERE "media_jobs"."status" in ('queued', 'processing');--> statement-breakpoint
CREATE INDEX "media_jobs_workspace_idx" ON "media_jobs" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "media_jobs_claim_idx" ON "media_jobs" USING btree ("status","lease_expires_at","created_at") WHERE "media_jobs"."status" in ('queued', 'retryable', 'processing');--> statement-breakpoint
CREATE UNIQUE INDEX "object_deletion_jobs_bucket_key_uidx" ON "object_deletion_jobs" USING btree ("storage_bucket","object_key");--> statement-breakpoint
CREATE INDEX "object_deletion_jobs_ready_idx" ON "object_deletion_jobs" USING btree ("run_after","created_at") WHERE "object_deletion_jobs"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "project_assets_asset_idx" ON "project_assets" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_expiry_idx" ON "upload_sessions" USING btree ("expires_at") WHERE "upload_sessions"."status" in ('pending', 'uploading');