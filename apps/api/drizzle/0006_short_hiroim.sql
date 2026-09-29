CREATE TABLE "html_render_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_ref" text DEFAULT 'hrj_' || encode(gen_random_bytes(10), 'hex') NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"html_revision_no" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"output_key" text,
	"error_message" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "html_render_jobs_public_ref_unique" UNIQUE("public_ref"),
	CONSTRAINT "html_render_jobs_html_revision_no_check" CHECK ("html_render_jobs"."html_revision_no" >= 1),
	CONSTRAINT "html_render_jobs_status_check" CHECK ("html_render_jobs"."status" in ('queued', 'rendering', 'done', 'failed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "render_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_ref" text DEFAULT 'rnd_' || encode(gen_random_bytes(10), 'hex') NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"preset_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"provider_render_id" text,
	"output_key" text,
	"error_code" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"lease_owner" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"artifact_path" text,
	"progress" numeric DEFAULT 0 NOT NULL,
	"stage" text,
	"metrics_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"runtime_json" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "render_jobs_public_ref_unique" UNIQUE("public_ref"),
	CONSTRAINT "render_jobs_status_check" CHECK ("render_jobs"."status" in ('queued', 'planning', 'rendering', 'encoding', 'muxing', 'publishing', 'done', 'failed', 'cancelled')),
	CONSTRAINT "render_jobs_attempt_count_check" CHECK ("render_jobs"."attempt_count" >= 0),
	CONSTRAINT "render_jobs_progress_check" CHECK ("render_jobs"."progress" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "html_render_jobs" ADD CONSTRAINT "html_render_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "html_render_jobs" ADD CONSTRAINT "html_render_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "html_render_jobs" ADD CONSTRAINT "html_render_jobs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_revision_id_project_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."project_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "html_render_jobs_workspace_idx" ON "html_render_jobs" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "html_render_jobs_project_idx" ON "html_render_jobs" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "render_jobs_workspace_idempotency_uidx" ON "render_jobs" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "render_jobs_workspace_idx" ON "render_jobs" USING btree ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "render_jobs_lease_recovery_idx" ON "render_jobs" USING btree ("heartbeat_at") WHERE "render_jobs"."lease_owner" is not null and "render_jobs"."status" not in ('done', 'failed', 'cancelled');--> statement-breakpoint
CREATE INDEX "render_jobs_status_idx" ON "render_jobs" USING btree ("status","updated_at");